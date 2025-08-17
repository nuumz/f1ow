/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { useStableLayerCallbacks } from "../hooks/useStableCallbacks";
import * as d3 from "d3";
import type {
  WorkflowNode,
  Connection,
  NodeVariant,
  NodePort,
  CanvasTransform,
} from "../types";
import { useWorkflowContext } from "../contexts/WorkflowContext";
import {
  getNodeColor,
  getPortColor,
  getNodeShape,
  getShapeAwareDimensions,
  NODE_WIDTH,
  NODE_MIN_HEIGHT,
} from "../utils/node-utils";
import { createIconRegistry } from "../utils/icon-registry";
import { useConnectionPaths } from "../hooks/useConnectionPaths";
import { usePortInteractions } from "../hooks/usePortInteractions";
import { getModeAwareConnectionMarker, getArrowMarkerForMode } from "../utils/marker-utils";
import { calculateConnectionPreviewPath } from "../utils/connection-utils";
import { useCanvasD3Setup } from "../hooks/useCanvasD3Setup";
import {
  PERFORMANCE_CONSTANTS,
  NodeZIndexState,
} from "../utils/canvas-constants";
import { rafCoordinator, scheduleConnectionUpdate, scheduleVisualUpdate } from "../utils/raf-coordinator";

// Optimized layer imports
import GridLayer from "./layers/GridLayer";
import OptimizedNodeLayer from "./layers/OptimizedNodeLayer";
import ConnectionLayer from "./layers/ConnectionLayer";
import InteractionLayer from "./layers/InteractionLayer";
import CanvasEffects from "./layers/CanvasEffects";

import type { NodeLayerConfig, NodeLayerRefs } from "./layers/OptimizedNodeLayer";

type DesignerMode = 'workflow' | 'architecture'

// Props expected from WorkflowDesigner
interface OptimizedWorkflowCanvasProps {
  svgRef: React.RefObject<SVGSVGElement>
  nodes: WorkflowNode[]
  connections: Connection[]
  showGrid: boolean
  canvasTransform: CanvasTransform
  nodeVariant: NodeVariant
  selectedNodes: Set<string>
  selectedConnection: Connection | null
  isNodeSelected: (nodeId: string) => boolean
  isConnecting: boolean
  connectionStart: { nodeId: string; portId: string; type: 'input' | 'output' } | null
  connectionPreview: { x: number; y: number } | null
  onNodeClick: (node: WorkflowNode, multi?: boolean) => void
  onNodeDoubleClick: (node: WorkflowNode, event?: any) => void
  onNodeDrag: (nodeId: string, x: number, y: number) => void
  onConnectionClick: (connection: Connection) => void
  onPortClick: (nodeId: string, portId: string, type: 'input' | 'output') => void
  onCanvasClick?: (e: any) => void
  onCanvasMouseMove?: (x: number, y: number) => void
  onPlusButtonClick?: (nodeId: string, portId: string) => void
  onPortDragStart: (nodeId: string, portId: string, type: 'input' | 'output') => void
  onPortDrag: (x: number, y: number) => void
  onPortDragEnd: (targetNodeId?: string, targetPortId?: string, canvasX?: number, canvasY?: number) => void
  canDropOnPort?: (targetNodeId: string, targetPortId: string, portType?: 'input' | 'output') => boolean
  canDropOnNode?: (targetNodeId: string) => boolean
  onTransformChange?: (transform: d3.ZoomTransform) => void
  onZoomLevelChange?: (k: number) => void
  onRegisterZoomBehavior?: (zoom: d3.ZoomBehavior<SVGSVGElement, unknown>) => void
}

function OptimizedWorkflowCanvas(props: Readonly<OptimizedWorkflowCanvasProps>) {
  const {
    svgRef,
    nodes,
    connections,
    showGrid,
    canvasTransform,
    nodeVariant,
    selectedNodes,
    selectedConnection,
    isNodeSelected,
    isConnecting,
    connectionStart,
    connectionPreview,
    onNodeClick,
    onNodeDoubleClick,
    onNodeDrag,
    onConnectionClick,
    onPortClick,
    onPortDragStart,
    onPortDrag,
    onPortDragEnd,
    canDropOnPort,
    canDropOnNode,
    onTransformChange,
    onZoomLevelChange,
    onRegisterZoomBehavior,
    onCanvasClick,
    onCanvasMouseMove,
    onPlusButtonClick,
  } = props

  // Workflow context (for designerMode + dragging helpers)
  const {
    state: workflowContextState,
    isDragging: isContextDragging,
    getDraggedNodeId,
    startDragging,
    updateDragPosition,
    endDragging,
  } = useWorkflowContext()

  const isDragging = isContextDragging()

  // Constants
  const MAX_CACHE_SIZE = PERFORMANCE_CONSTANTS.MAX_CACHE_SIZE
  const CACHE_CLEANUP_THRESHOLD = PERFORMANCE_CONSTANTS.CACHE_CLEANUP_THRESHOLD
  const GRID_CACHE_DURATION = PERFORMANCE_CONSTANTS.GRID_CACHE_DURATION

  // Optimized refs - reduced from multiple individual refs
  const nodePositionCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const gridCacheRef = useRef<{ lastRenderTime: number; key?: string } | null>(null)
  const nodeLayerRef = useRef<SVGGElement | null>(null)
  const selectionCacheRef = useRef<Map<string, d3.Selection<SVGGElement, unknown, null, undefined>>>(new Map())
  
  // Consolidated refs for node layer
  const nodeLayerRefs = useRef<NodeLayerRefs>({
    draggedElementRef: useRef<d3.Selection<any, any, any, any> | null>(null),
    draggedNodeElementRef: useRef<SVGGElement | null>(null),
    allNodeElementsRef: useRef<Map<string, SVGGElement>>(new Map()),
    dragStateCleanupRef: useRef<NodeJS.Timeout | null>(null),
    currentDragPositionsRef: useRef<Map<string, { x: number; y: number }>>(new Map()),
    connectionUpdateQueueRef: useRef<Set<string>>(new Set()),
    visualUpdateQueueRef: useRef<Set<string>>(new Set()),
  });

  const [isInitialized, setIsInitialized] = useState(false)

  // Centralized native event cleanup registry
  const eventCleanupRef = useRef<Array<() => void>>([])
  const registerEventCleanup = useCallback((cleanup: () => void) => {
    eventCleanupRef.current.push(cleanup)
  }, [])

  // Small generic LRU+TTL cache factory to prevent duplicated implementations
  function createLRUCache<V>(max = 1000, ttlMs = 5 * 60 * 1000) {
    type Entry = { value: V; ts: number }
    const cache = new Map<string, Entry>()
    return {
      get(key: string): V | undefined {
        const e = cache.get(key)
        if (!e) return undefined
        if (performance.now() - e.ts > ttlMs) {
          cache.delete(key)
          return undefined
        }
        cache.delete(key)
        cache.set(key, { value: e.value, ts: performance.now() })
        return e.value
      },
      set(key: string, value: V) {
        if (cache.has(key)) cache.delete(key)
        cache.set(key, { value, ts: performance.now() })
        if (cache.size > max) {
          const it = cache.keys().next()
          if (!it.done) cache.delete(it.value)
        }
      },
      clear() { cache.clear() }
    }
  }

  // Keep handy selection lookups cached per frame
  const getCachedSelection = useCallback(
    (key: string) => {
      const cached = selectionCacheRef.current.get(key)
      if (cached && !cached.empty()) return cached
      const svgEl = svgRef.current
      if (!svgEl) return null
      const svg = d3.select(svgEl)
      let sel: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
      if (key === "connectionLayer") sel = svg.select<SVGGElement>(".connection-layer")
      else if (key === "nodeLayer") sel = svg.select<SVGGElement>(".node-layer")
      else if (key === "gridLayer") sel = svg.select<SVGGElement>(".grid-layer")
      if (sel && !sel.empty()) {
        selectionCacheRef.current.set(key, sel)
        return sel
      }
      return null
    },
    [svgRef]
  )

  // Architecture icons via shared symbol registry (<defs>/<symbol>/<use>)
  const { getArchitectureIconSvg } = useMemo(() => createIconRegistry(svgRef), [svgRef])

  const isServicesArchitectureNode = useCallback((node: any) => {
    const services = new Set<string>(['http', 'service', 'api', 'database'])
    return services.has(node?.type)
  }, [])

  // Minimal grid renderer with cache timestamping (stable, no deps)
  const createGrid = useCallback(
    (
      gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
      width: number,
      height: number
    ) => {
      const now = performance.now()
      gridCacheRef.current ??= { lastRenderTime: 0 }
      // Throttle redraws
      if (now - gridCacheRef.current.lastRenderTime < 200 && !gridLayer.empty()) {
        return
      }

      const gridNode = gridLayer.node()
      const svgEl = gridNode?.ownerSVGElement
      if (!svgEl) return

      const svgSel = d3.select(svgEl)
      // Ensure defs exists
      let defsSel: d3.Selection<SVGDefsElement, unknown, null, undefined> = svgSel.select<SVGDefsElement>('defs')
      if (defsSel.empty()) {
        defsSel = svgSel.append<SVGDefsElement>('defs')
      }

      // Base dot grid pattern (original id) + a subtle major grid overlay
      const patternId = 'workflow-grid' // keep original id for base dots
      const majorPatternId = 'workflow-grid-major'
      const size = 20
      const majorStep = 5 // every 5 dots
      const color = '#dee0e4' // base dots
      const majorColor = '#dee0e4' // slightly darker for major dots
      const opacity = 0.8
  const majorOpacity = 0.9

      // Create pattern only once
      // Base dots
      let patternSel: d3.Selection<SVGPatternElement, unknown, null, undefined> = defsSel.select<SVGPatternElement>(`#${patternId}`)
      if (patternSel.empty()) {
        patternSel = defsSel
          .append<SVGPatternElement>('pattern')
          .attr('id', patternId)
          .attr('patternUnits', 'userSpaceOnUse')
          .attr('width', size)
          .attr('height', size)
      }
      // Ensure content exists and attributes are up to date
      patternSel.attr('width', size).attr('height', size)
      let baseCircle: d3.Selection<SVGCircleElement, unknown, null, undefined> = patternSel.select<SVGCircleElement>('circle.base-dot')
      if (baseCircle.empty()) {
        baseCircle = patternSel.append<SVGCircleElement>('circle').attr('class', 'base-dot')
      }
      baseCircle
        .attr('cx', size / 2)
        .attr('cy', size / 2)
        .attr('r', 0.8)
        .attr('fill', color)
        .attr('opacity', opacity)

      // Major dots overlay
      let majorPatternSel: d3.Selection<SVGPatternElement, unknown, null, undefined> = defsSel.select<SVGPatternElement>(`#${majorPatternId}`)
      if (majorPatternSel.empty()) {
        majorPatternSel = defsSel
          .append<SVGPatternElement>('pattern')
          .attr('id', majorPatternId)
          .attr('patternUnits', 'userSpaceOnUse')
          .attr('width', size * majorStep)
          .attr('height', size * majorStep)
      }
      majorPatternSel.attr('width', size * majorStep).attr('height', size * majorStep)
      let majorCircle: d3.Selection<SVGCircleElement, unknown, null, undefined> = majorPatternSel.select<SVGCircleElement>('circle.major-dot')
      if (majorCircle.empty()) {
        majorCircle = majorPatternSel.append<SVGCircleElement>('circle').attr('class', 'major-dot')
      }
      majorCircle
        .attr('cx', (size * majorStep) / 2)
        .attr('cy', (size * majorStep) / 2)
        .attr('r', 1.2)
        .attr('fill', majorColor)
        .attr('opacity', majorOpacity)

      // Clear grid layer contents (not defs) and apply pattern fill
      gridLayer.selectAll('*').remove()
      // Base dots
      gridLayer
        .append('rect')
        .attr('class', 'grid-pattern-rect base')
        .attr('x', -50000)
        .attr('y', -50000)
        .attr('width', 100000)
        .attr('height', 100000)
        .attr('fill', `url(#${patternId})`)

      // Major dots overlay
      gridLayer
        .append('rect')
        .attr('class', 'grid-pattern-rect major')
        .attr('x', -50000)
        .attr('y', -50000)
        .attr('width', 100000)
        .attr('height', 100000)
        .attr('fill', `url(#${majorPatternId})`)

      // Store current viewport size (keeps args used for linting and allows debugging)
      gridLayer.attr('data-grid-size', `${Math.round(width)}x${Math.round(height)}`)

      gridCacheRef.current.lastRenderTime = now
    },
    []
  )

  // Marker resolver wrapper for connections
  const getConnectionMarker = useCallback(
    (_: Connection, state: 'default' | 'hover' | 'selected' = 'default') =>
      getModeAwareConnectionMarker(workflowContextState.designerMode, state),
    [workflowContextState.designerMode]
  )

  // Helper used by usePortInteractions (optional debounce-capable)
  const updatePortHighlighting = useCallback(
    (
      _portKey: string,
      canDrop: boolean,
      portGroup: d3.Selection<SVGGElement, unknown, null, undefined>
    ) => {
      portGroup.classed('can-dropped', canDrop)
    },
    []
  )

  // Base SVG layers + zoom binding
  const currentTransformRef = useRef<d3.ZoomTransform | CanvasTransform>({ x: canvasTransform.x, y: canvasTransform.y, k: canvasTransform.k })
  const layers = useCanvasD3Setup({
    svgRef,
    canvasTransform,
    onRegisterZoomBehavior,
    onTransformChange,
    onZoomLevelChange,
    isConnecting,
    connectionStart,
    onPortDrag,
    currentTransformRef,
  })

  // Keep nodeLayerRef in sync with created layers
  useEffect(() => {
    nodeLayerRef.current = layers.nodes
    if (!isInitialized && layers.nodes) setIsInitialized(true)
  }, [layers.nodes, isInitialized])

  // Connection paths API
  const {
    getConnectionPath,
    updateDragPosition: updateConnDragPos,
    clearAllDragPositions,
    clearCache: clearConnCache,
  } = useConnectionPaths(nodes, nodeVariant, workflowContextState.designerMode as DesignerMode | undefined)

  // Enhanced cache and memory management utilities (connection path cache handled by hook)
  const cleanupCaches = useCallback(() => {
    // Clean node position cache if too large (reduced logging)
    if (nodePositionCacheRef.current.size > CACHE_CLEANUP_THRESHOLD) {
      const keysToDelete = Array.from(
        nodePositionCacheRef.current.keys()
      ).slice(0, nodePositionCacheRef.current.size - MAX_CACHE_SIZE);
      keysToDelete.forEach((key) => nodePositionCacheRef.current.delete(key));
      if (process.env.NODE_ENV === "development") {
        console.log(
          `🧹 Cleaned position cache: ${keysToDelete.length} entries`
        );
      }
    }

    // Reset grid cache if expired (no logging needed)
    const now = performance.now();
    if (
      gridCacheRef.current &&
      now - gridCacheRef.current.lastRenderTime > GRID_CACHE_DURATION * 2
    ) {
      gridCacheRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Constants don't need to be included in dependencies

  // Schedule regular cache cleanup every 30 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupCaches, 30000);
    return () => clearInterval(cleanupInterval);
  }, [cleanupCaches]);

  // Enhanced Z-Index Management with change detection to reduce DOM manipulation
  const lastZIndexStateRef = useRef<Map<string, NodeZIndexState>>(new Map());

  const organizeNodeZIndex = useCallback(
    (immediate = false) => {
      const nodeLayer = nodeLayerRef.current;
      if (!nodeLayer || nodeLayerRefs.current.allNodeElementsRef.current.size === 0) return;

      const executeZIndexUpdate = () => {
        const normalNodes: SVGGElement[] = [];
        const selectedNodes: SVGGElement[] = [];
        const draggingNodes: SVGGElement[] = [];
        const currentState = new Map<string, NodeZIndexState>();
        let hasChanges = false;

        nodeLayerRefs.current.allNodeElementsRef.current.forEach((element, nodeId) => {
          if (!nodeLayer.contains(element)) return;

          const isNodeDragging = isDragging && nodeId === getDraggedNodeId();
          const isSelected = isNodeSelected(nodeId);

          let state: NodeZIndexState;
          if (isNodeDragging) {
            draggingNodes.push(element);
            state = "dragging";
          } else if (isSelected) {
            selectedNodes.push(element);
            state = "selected";
          } else {
            normalNodes.push(element);
            state = "normal";
          }

          currentState.set(nodeId, state);

          // Check if state changed
          if (lastZIndexStateRef.current.get(nodeId) !== state) {
            hasChanges = true;
          }
        });

        // Only reorder DOM if there are actual changes
        if (
          hasChanges ||
          lastZIndexStateRef.current.size !== currentState.size
        ) {
          // Reorder DOM elements: normal → selected → dragging
          const orderedElements = [
            ...normalNodes,
            ...selectedNodes,
            ...draggingNodes,
          ];

          // Use document fragment for batch DOM operations
          const fragment = document.createDocumentFragment();
          orderedElements.forEach((element) => {
            fragment.appendChild(element);
          });
          nodeLayer.appendChild(fragment);

          lastZIndexStateRef.current = currentState;
        }
      };

      if (immediate) {
        executeZIndexUpdate();
      } else {
        scheduleVisualUpdate("z-index-update", executeZIndexUpdate);
      }
    },
    [isNodeSelected, isDragging, getDraggedNodeId]
  );

  // Optimized immediate node dragging z-index management
  const setNodeAsDragging = useCallback(
    (nodeId: string) => {
      const element = nodeLayerRefs.current.allNodeElementsRef.current.get(nodeId);
      const nodeLayer = nodeLayerRef.current;

      if (element && nodeLayer) {
        // Mark state as changed and trigger immediate z-index organization
        lastZIndexStateRef.current.set(nodeId, "dragging");
        organizeNodeZIndex(true); // Use immediate execution
      }
    },
    [organizeNodeZIndex]
  );

  // Optimized node lookup with memoization
  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Stable reference for selectedNodes to prevent unnecessary re-renders
  const selectedNodesRef = useRef(selectedNodes);
  selectedNodesRef.current = selectedNodes;

  // Throttle drag updates for better performance
  const lastDragUpdateRef = useRef(0);
  const dragUpdateThrottle = 16; // ~60fps for better performance balance

  // Helper function to check if a port has multiple connections
  const hasMultipleConnections = useCallback(
    (nodeId: string, portId: string, portType: "input" | "output") => {
      if (portType === "input") {
        return (
          connections.filter(
            (conn) =>
              conn.targetNodeId === nodeId && conn.targetPortId === portId
          ).length > 1
        );
      } else {
        return (
          connections.filter(
            (conn) =>
              conn.sourceNodeId === nodeId && conn.sourcePortId === portId
          ).length > 1
        );
      }
    },
    [connections]
  );

  // Enhanced port highlighting for architecture mode
  const getPortHighlightClass = useCallback(
    (nodeId: string, portId: string, portType: "input" | "output") => {
      if (workflowContextState.designerMode !== "architecture") return "";

      const isMultiple = hasMultipleConnections(nodeId, portId, portType);
      const classes = [];

      if (isMultiple) {
        classes.push("has-multiple-connections");
      }

      return classes.join(" ");
    },
    [workflowContextState.designerMode, hasMultipleConnections]
  );

  // Helper function to create a filled polygon from a path with thickness
  const createFilledPolygonFromPath = useCallback(
    (pathString: string, thickness: number = 6): string => {
      if (!pathString) return "";

      try {
        // Create a temporary SVG path element in memory to get path data
        const tempSvg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
        );
        tempSvg.style.position = "absolute";
        tempSvg.style.visibility = "hidden";
        tempSvg.style.width = "1px";
        tempSvg.style.height = "1px";

        const tempPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        tempPath.setAttribute("d", pathString);
        tempSvg.appendChild(tempPath);

        // Add to SVG container temporarily (not body)
        const svgContainer = svgRef.current;
        if (!svgContainer) return pathString;
        svgContainer.appendChild(tempSvg);

        // Get total length and sample points along the path
        const pathLength = tempPath.getTotalLength();
        const numSamples = Math.max(20, Math.floor(pathLength / 10)); // Sample every 10 pixels
        const points: Array<{ x: number; y: number }> = [];

        for (let i = 0; i <= numSamples; i++) {
          const distance = (i / numSamples) * pathLength;
          const point = tempPath.getPointAtLength(distance);
          points.push({ x: point.x, y: point.y });
        }

        // Remove temporary SVG
        svgContainer.removeChild(tempSvg);

        if (points.length < 2) return pathString;

        // Calculate perpendicular offsets for each point
        const leftPoints: Array<{ x: number; y: number }> = [];
        const rightPoints: Array<{ x: number; y: number }> = [];

        for (let i = 0; i < points.length; i++) {
          const curr = points[i];
          let dx = 0,
            dy = 0;

          if (i === 0) {
            // First point - use direction to next point
            const next = points[i + 1];
            dx = next.x - curr.x;
            dy = next.y - curr.y;
          } else if (i === points.length - 1) {
            // Last point - use direction from previous point
            const prev = points[i - 1];
            dx = curr.x - prev.x;
            dy = curr.y - prev.y;
          } else {
            // Middle points - use average of directions
            const prev = points[i - 1];
            const next = points[i + 1];
            dx = next.x - prev.x;
            dy = next.y - prev.y;
          }

          // Normalize direction vector
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            dx /= len;
            dy /= len;
          } else {
            dx = 0;
            dy = 1;
          }

          // Calculate perpendicular vector (rotate 90 degrees)
          const perpX = -dy * thickness;
          const perpY = dx * thickness;

          // Add offset points on both sides
          leftPoints.push({ x: curr.x + perpX, y: curr.y + perpY });
          rightPoints.push({ x: curr.x - perpX, y: curr.y - perpY });
        }

        // Build the polygon path
        let polygonPath = `M ${leftPoints[0].x} ${leftPoints[0].y}`;

        // Trace left side
        for (let i = 1; i < leftPoints.length; i++) {
          polygonPath += ` L ${leftPoints[i].x} ${leftPoints[i].y}`;
        }

        // Add arc at the end
        const endRadius = thickness;
        polygonPath += ` A ${endRadius} ${endRadius} 0 0 1 ${
          rightPoints[rightPoints.length - 1].x
        } ${rightPoints[rightPoints.length - 1].y}`;

        // Trace right side (in reverse)
        for (let i = rightPoints.length - 2; i >= 0; i--) {
          polygonPath += ` L ${rightPoints[i].x} ${rightPoints[i].y}`;
        }

        // Add arc at the start and close path
        polygonPath += ` A ${endRadius} ${endRadius} 0 0 1 ${leftPoints[0].x} ${leftPoints[0].y}`;
        polygonPath += " Z";

        return polygonPath;
      } catch (error) {
        console.warn("Error creating filled polygon:", error);
        return pathString;
      }
    },
    [svgRef]
  );

  // Memoized configurable dimensions calculation (shape-aware)
  const getConfigurableDimensions = useMemo(() => {
    const dimCache = createLRUCache<any>(1000, 5 * 60 * 1000)
    return (node: WorkflowNode) => {
      const cacheKey = `${node.id}-${nodeVariant}-${
        workflowContextState.designerMode || "workflow"
      }`;
      const cached = dimCache.get(cacheKey)
      if (cached) return cached

      const shapeDimensions = getShapeAwareDimensions(node)

      // Architecture mode: fixed rounded-square sizing + right-side labels
      if (workflowContextState.designerMode === "architecture") {
        const ARCH_SIZE = 56 // square size (reduced from 64)
        const result = {
          ...shapeDimensions,
          width: ARCH_SIZE,
          height: ARCH_SIZE,
          iconOffset: { x: 0, y: 0 },
          labelOffset: { x: 0, y: 0 }, // label positioning is handled later (to the right)
          portRadius: 5,
          iconSize: 28,
          fontSize: 14,
        }
        dimCache.set(cacheKey, result)
        return result
      }

      // Adjust dimensions based on variant (workflow mode)
      const result =
        nodeVariant === "compact"
          ? {
              ...shapeDimensions,
              width: shapeDimensions.width * 0.8,
              height: shapeDimensions.height * 0.8,
              portRadius: shapeDimensions.portRadius || 6,
            }
          : {
              ...shapeDimensions,
              portRadius: shapeDimensions.portRadius || 6,
            }

      dimCache.set(cacheKey, result)
      return result
    }
  }, [nodeVariant, workflowContextState.designerMode])

  // Memoized port positions calculation using configurable dimensions
  const getConfigurablePortPositions = useMemo(() => {
    const portPosCache = createLRUCache<any>(1000, 5 * 60 * 1000)

    const calcRectOrSquare = (
      dimensions: any,
      portCount: number,
      portType: 'input' | 'output'
    ) => {
      const positions: Array<{ x: number; y: number }> = []
      const spacing = dimensions.height / (portCount + 1)
      for (let i = 0; i < portCount; i++) {
        const y = -dimensions.height / 2 + spacing * (i + 1)
        const x = portType === 'input' ? -dimensions.width / 2 : dimensions.width / 2
        positions.push({ x, y })
      }
      return positions
    }

    const calcCircle = (dimensions: any, portCount: number) => {
      const positions: Array<{ x: number; y: number }> = []
      const angleStep = (Math.PI * 2) / portCount
      const radius = Math.min(dimensions.width, dimensions.height) / 2
      for (let i = 0; i < portCount; i++) {
        const angle = angleStep * i
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        positions.push({ x, y })
      }
      return positions
    }

    const calcDiamond = (
      dimensions: any,
      portCount: number,
      portType: 'input' | 'output'
    ) => {
      const positions: Array<{ x: number; y: number }> = []
      const halfWidth = dimensions.width / 2
      const effectiveHalfHeight = (dimensions.height / 2) * 0.75
      const effectiveHeight = effectiveHalfHeight * 2
      const spacing = Math.min(25, effectiveHeight / (portCount + 1))
      const startY = -((portCount - 1) * spacing) / 2
      for (let i = 0; i < portCount; i++) {
        const y = startY + i * spacing
        const widthAtY = Math.max(
          0,
          halfWidth *
            (1 - Math.min(1, Math.abs(y) / Math.max(1e-6, effectiveHalfHeight)))
        )
        const x = (portType === 'input' ? -1 : 1) * widthAtY
        positions.push({ x, y })
      }
      return positions
    }

    return (node: WorkflowNode, portType: "input" | "output") => {
      const cacheKey = `${node.id}-${portType}-${nodeVariant}-${
        workflowContextState.designerMode || "workflow"
      }`;

      const cached = portPosCache.get(cacheKey);
      if (cached) return cached;

      const shape = getNodeShape(node.type);
      const dimensions = getConfigurableDimensions(node);
      const portCount =
        portType === "input" ? node.inputs.length : node.outputs.length;

      let positions: Array<{ x: number; y: number }>
      switch (shape) {
        case 'rectangle':
        case 'square':
          positions = calcRectOrSquare(dimensions, portCount, portType)
          break
        case 'circle':
          positions = calcCircle(dimensions, portCount)
          break
        case 'diamond':
          positions = calcDiamond(dimensions, portCount, portType)
          break
        default:
          positions = calcRectOrSquare(dimensions, portCount, portType)
      }

      portPosCache.set(cacheKey, positions);
      return positions;
    };
  }, [
    nodeVariant,
    workflowContextState.designerMode,
    getConfigurableDimensions,
  ]);

  // Memoized connection lookup for better drag performance
  const nodeConnectionsMap = useMemo(() => {
    const map = new Map<string, Connection[]>();
    connections.forEach((conn) => {
      // Index by source node
      if (!map.has(conn.sourceNodeId)) {
        map.set(conn.sourceNodeId, []);
      }
      map.get(conn.sourceNodeId)!.push(conn);

      // Index by target node (if different from source)
      if (conn.targetNodeId !== conn.sourceNodeId) {
        if (!map.has(conn.targetNodeId)) {
          map.set(conn.targetNodeId, []);
        }
        map.get(conn.targetNodeId)!.push(conn);
      }
    });
    return map;
  }, [connections]);

  // Optimized batched connection update system using RAF coordinator
  const processBatchedConnectionUpdates = useCallback(() => {
    if (nodeLayerRefs.current.connectionUpdateQueueRef.current.size === 0) return;

    // PERFORMANCE: Use cached DOM selections to avoid repeated queries
    const connectionLayer = getCachedSelection("connectionLayer");
    if (!connectionLayer) return;

    // PERFORMANCE: Optimized batching - process more items but with time slicing
    const nodesToProcess = Array.from(nodeLayerRefs.current.connectionUpdateQueueRef.current);
  // Coordinator controls time budget centrally

    for (const nodeId of nodesToProcess) {
      const affectedConnections = nodeConnectionsMap.get(nodeId) || [];
      if (affectedConnections.length === 0) {
        nodeLayerRefs.current.connectionUpdateQueueRef.current.delete(nodeId);
        continue;
      }

      // PERFORMANCE: Batch DOM operations together
      const connectionElements = affectedConnections
        .map((conn) => ({
          conn,
          element: connectionLayer.select(`[data-connection-id="${conn.id}"]`),
        }))
        .filter(({ element }) => !element.empty());

      // Update all paths in a single batch
      connectionElements.forEach(({ conn, element }) => {
        const pathElement = element.select(".connection-path");
        const newPath = getConnectionPath(conn, true);
        pathElement.attr("d", newPath);
      });

      nodeLayerRefs.current.connectionUpdateQueueRef.current.delete(nodeId);
    }
  }, [nodeConnectionsMap, getConnectionPath, getCachedSelection]);

  const updateDraggedNodePosition = useCallback(
    (nodeId: string, newX: number, newY: number) => {
      // Always update node position immediately for smooth dragging
      if (nodeLayerRefs.current.draggedElementRef.current) {
        nodeLayerRefs.current.draggedElementRef.current.attr(
          "transform",
          `translate(${newX}, ${newY})`
        );
      }

      // Store current drag position
      nodeLayerRefs.current.currentDragPositionsRef.current.set(nodeId, { x: newX, y: newY });
      // Sync with connection paths hook for live path updates during drag
      updateConnDragPos(nodeId, { x: newX, y: newY });

      // Throttle connection updates to improve performance
      const now = Date.now();
      if (now - lastDragUpdateRef.current < dragUpdateThrottle) {
        return;
      }
      lastDragUpdateRef.current = now;

      // Queue connection updates for coordinated RAF processing with deduplication
      const affectedConnections = nodeConnectionsMap.get(nodeId) || [];
      if (affectedConnections.length > 0) {
        const wasEmpty = nodeLayerRefs.current.connectionUpdateQueueRef.current.size === 0;
        nodeLayerRefs.current.connectionUpdateQueueRef.current.add(nodeId);
        
        // Only schedule RAF task if this is the first item in queue to prevent duplicates
        if (wasEmpty) {
          scheduleConnectionUpdate('batched-conn-updates', processBatchedConnectionUpdates);
        }
      }
    },
    [
      nodeConnectionsMap,
      processBatchedConnectionUpdates,
      dragUpdateThrottle,
      updateConnDragPos,
    ]
  );

  const resetNodeVisualStyle = useCallback(
    (nodeElement: any, nodeId: string) => {
      const isSelected = isNodeSelected(nodeId);
      const nodeBackground = nodeElement.select(".node-background");
      const node = nodeMap.get(nodeId);

      if (isSelected) {
        nodeElement
          .style("opacity", 1)
          .style("filter", "drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))");
        nodeBackground.attr("stroke", "#2196F3").attr("stroke-width", 3);
      } else {
        nodeElement.style("opacity", 1).style("filter", "none");
        if (node) {
          nodeBackground
            .attr("stroke", getNodeColor(node.type, node.status))
            .attr("stroke-width", 2);
        }
      }
    },
    [isNodeSelected, nodeMap]
  );

  // Enhanced visual feedback system with coordinated RAF
  const processBatchedVisualUpdates = useCallback(() => {
    if (nodeLayerRefs.current.visualUpdateQueueRef.current.size === 0) return;
    
    for (const nodeId of Array.from(nodeLayerRefs.current.visualUpdateQueueRef.current)) {
      const element = nodeLayerRefs.current.allNodeElementsRef.current.get(nodeId);
      if (!element) {
        nodeLayerRefs.current.visualUpdateQueueRef.current.delete(nodeId);
        continue;
      }
      const nodeElement = d3.select(element);
      const nodeBackground = nodeElement.select(".node-background");
      nodeElement
        .style("opacity", 0.9)
        .style("filter", "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))");
      nodeBackground.attr("stroke", "#2196F3").attr("stroke-width", 3);
      nodeLayerRefs.current.visualUpdateQueueRef.current.delete(nodeId);
    }
  }, []);

  const applyDragVisualStyle = useCallback(
    (nodeElement: any, nodeId: string) => {
      // CRITICAL: Apply visual styling IMMEDIATELY during drag start for stable feedback
      const nodeBackground = nodeElement.select(".node-background");

      // Apply drag visual style immediately
      nodeElement
        .style("opacity", 0.9)
        .style("filter", "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))");

      // Always use blue border when dragging (regardless of selection state)
      nodeBackground.attr("stroke", "#2196F3").attr("stroke-width", 3);

      // Queue for batched processing with deduplication
      const wasEmpty = nodeLayerRefs.current.visualUpdateQueueRef.current.size === 0;
      nodeLayerRefs.current.visualUpdateQueueRef.current.add(nodeId);
      
      // Only schedule RAF task if this is the first item in queue to prevent duplicates
      if (wasEmpty) {
        scheduleVisualUpdate('batched-visual-updates', processBatchedVisualUpdates);
      }
    },
    [processBatchedVisualUpdates]
  );

  // Unified drop state management
  const setDropFeedback = useCallback(
    (
      nodeElement: d3.Selection<SVGGElement, unknown, null, undefined>,
      show: boolean
    ) => {
      if (!nodeElement) return;

      // Set node-level feedback
      nodeElement.classed("can-drop-node", show);
      nodeElement.select(".node-background").classed("can-drop", show);

      // CRITICAL: Only manage port highlighting when explicitly showing feedback
      // Don't remove port highlighting during drag leave when still connecting
      if (show && isConnecting && connectionStart) {
        nodeElement
          .selectAll(".input-port-group")
          .classed("can-dropped", function (d: unknown) {
            const portData = d as NodePort;
            const typedPortData = portData as NodePort & { nodeId: string };
            const nodeId = (nodeElement.datum() as WorkflowNode)?.id;

            if (!nodeId || !connectionStart) return false;

            // Use canDropOnPort for validation
            return canDropOnPort
              ? canDropOnPort(nodeId, typedPortData.id)
              : false;
          });
      }
      // REMOVED: Don't remove port highlighting during drag leave - let CSS handle visibility
      // This prevents port drop targets from disappearing when dragging out of nodes
    },
    [isConnecting, connectionStart, canDropOnPort]
  );

  // Hook: manage live port visuals (hover/validation) during connection drags
  usePortInteractions({
    svgRef,
    isConnecting,
    connectionStart,
    canDropOnPort,
    designerMode: workflowContextState.designerMode as DesignerMode | undefined,
    getConfigurableDimensions: (nodeData: unknown) => {
      const dims = (getConfigurableDimensions as (n: any) => any)(nodeData)
      return { portRadius: dims.portRadius }
    },
    getPortColor,
    updatePortHighlighting,
  })

  // Create stable callback groups using useStableLayerCallbacks to prevent layer re-renders
  const { callbacks: nodeLayerCallbacks, context: nodeLayerContext, visuals: nodeLayerVisuals, utils: nodeLayerUtils } = useStableLayerCallbacks(
    {
      isNodeSelected,
      onNodeClick,
      onNodeDoubleClick,
      onNodeDrag,
      onPortClick,
      onPlusButtonClick,
      onPortDragStart,
      onPortDrag,
      onPortDragEnd,
      canDropOnNode,
    },
    {
      isContextDragging,
      getDraggedNodeId,
      startDragging,
      updateDragPosition,
      endDragging,
    },
    {
      setDropFeedback,
      applyDragVisualStyle,
      updateDraggedNodePosition,
      resetNodeVisualStyle,
      setNodeAsDragging,
      organizeNodeZIndex,
    },
    {
      getConfigurableDimensions,
      getArchitectureIconSvg,
      isServicesArchitectureNode,
      getPortHighlightClass,
      getConfigurablePortPositions,
    }
  );

  const nodeLayerConfig: NodeLayerConfig = useMemo(() => ({
    svgRef,
    nodes,
    connections,
    isDragging,
    designerMode: workflowContextState.designerMode as DesignerMode | undefined,
  }), [svgRef, nodes, connections, isDragging, workflowContextState.designerMode]);

  // Enhanced cache management with memory optimization
  const clearAllCaches = useCallback(() => {
    // Clear connection path cache in hook
    clearConnCache();
    nodePositionCacheRef.current.clear();
    clearAllDragPositions();
    nodeLayerRefs.current.connectionUpdateQueueRef.current.clear();
    nodeLayerRefs.current.visualUpdateQueueRef.current.clear();
    lastZIndexStateRef.current.clear();
    rafCoordinator.cancelAll();
  }, [clearConnCache, clearAllDragPositions]);

  // Clear caches when nodes change
  useEffect(() => {
    clearAllCaches();
  }, [nodes, clearAllCaches]);

  // Clear connection paths when connections change
  useEffect(() => {
    clearConnCache();
  }, [connections, clearConnCache]);

  // Initialize flag once the SVG layers are present
  useEffect(() => {
    if (isInitialized) return
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const nodeLayer = svg.select<SVGGElement>('.node-layer')
    if (!nodeLayer.empty()) setIsInitialized(true)
  }, [isInitialized, svgRef])

  // Connection state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select("g");

    // Handle connection preview
    g.selectAll(".connection-preview").remove();

    if (isConnecting && connectionStart) {
      const sourceNode = nodeMap.get(connectionStart.nodeId);
      if (sourceNode && connectionPreview) {
        // Compute hover target box if mouse is over a node group
        const hoveredNode = nodes.find((n) => {
          const dims = getConfigurableDimensions(n as any);
          const w = dims.width || NODE_WIDTH;
          const h = dims.height || NODE_MIN_HEIGHT;
          const left = n.x - w / 2;
          const top = n.y - h / 2;
          return (
            connectionPreview.x >= left &&
            connectionPreview.x <= left + w &&
            connectionPreview.y >= top &&
            connectionPreview.y <= top + h
          );
        });
        const hoverTargetBox = hoveredNode
          ? (() => {
              const dims = getConfigurableDimensions(hoveredNode as any);
              const w = dims.width || NODE_WIDTH;
              const h = dims.height || NODE_MIN_HEIGHT;
              return {
                x: hoveredNode.x - w / 2,
                y: hoveredNode.y - h / 2,
                width: w,
                height: h,
              };
            })()
          : undefined;

        let previewPath = calculateConnectionPreviewPath(
          sourceNode,
          connectionStart.portId,
          connectionPreview,
          nodeVariant,
          undefined,
          workflowContextState.designerMode || "workflow",
          hoverTargetBox
        );

        // Determine preview marker consistent with final connection markers
        const isWorkflowMode = workflowContextState.designerMode === "workflow";
        const previewMarker = getArrowMarkerForMode(isWorkflowMode, "default");

        g.append("path")
          .attr("class", "connection-preview")
          .attr("d", previewPath)
          .attr("stroke", "#2196F3")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5")
          .attr("stroke-linecap", "round")
          .attr("fill", "none")
          .attr("marker-end", previewMarker)
          .attr("pointer-events", "none")
          .style("opacity", 0.7);
      }
    }
  }, [
    isConnecting,
    connectionPreview,
    connectionStart,
    nodeVariant,
    isInitialized,
    workflowContextState.designerMode,
    nodeMap,
    nodes,
    svgRef,
    getConfigurableDimensions,
  ]);

  // Connection cleanup effect - clear port highlighting when connection ends
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return;

    // Clear all port highlighting when connection ends
    if (!isConnecting) {
      const svg = d3.select(svgRef.current);

      // Remove can-dropped class from all port groups
      svg.selectAll(".input-port-group").classed("can-dropped", false);
      svg.selectAll(".output-port-group").classed("can-dropped", false);
      svg.selectAll(".port-group").classed("can-dropped", false);
    }
  }, [isConnecting, isInitialized, svgRef]);

  // Wire optional canvas-level native events
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const controller = new AbortController()
    const { signal } = controller
    const clickHandler = (e: Event) => {
      ;(onCanvasClick as unknown as (e: Event) => void | undefined)?.(e)
    }
    const moveHandler = (e: Event) => {
      if (!onCanvasMouseMove) return
      const evt = e as MouseEvent
      const svg = svgEl
      const pt = svg.createSVGPoint()
      pt.x = evt.clientX
      pt.y = evt.clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const inv = ctm.inverse()
      const loc = pt.matrixTransform(inv)
      onCanvasMouseMove(loc.x, loc.y)
    }
    if (onCanvasClick) svgEl.addEventListener('click', clickHandler, { signal })
    if (onCanvasMouseMove) svgEl.addEventListener('mousemove', moveHandler, { signal })
    // Track cleanup centrally
    registerEventCleanup(() => controller.abort())
    return () => {
      controller.abort()
    }
  }, [svgRef, onCanvasClick, onCanvasMouseMove, registerEventCleanup])

  // Cleanup effect
  useEffect(() => {
    return () => {
      rafCoordinator.cancelAll();
      // Clear connection path cache managed by hook
      clearConnCache();
      gridCacheRef.current = null;
      // Run registered native event cleanups
      try {
        eventCleanupRef.current.forEach((fn) => {
          try { fn() } catch { /* noop */ }
        })
      } finally {
        eventCleanupRef.current = []
      }
    };
  }, [clearConnCache]);

  return (
    <>
      <GridLayer
        svgRef={svgRef}
        isInitialized={isInitialized}
        showGrid={showGrid}
        createGrid={createGrid}
        gridCacheRef={gridCacheRef}
      />
      <ConnectionLayer
        svgRef={svgRef}
        connections={connections}
        designerMode={workflowContextState.designerMode as DesignerMode | undefined}
        nodeMap={nodeMap}
        onConnectionClick={onConnectionClick}
        getConnectionPath={(c) => getConnectionPath(c)}
        getConnectionMarker={getConnectionMarker}
        createFilledPolygonFromPath={createFilledPolygonFromPath}
      />
      <OptimizedNodeLayer
        config={nodeLayerConfig}
        callbacks={nodeLayerCallbacks}
        context={nodeLayerContext}
        visuals={nodeLayerVisuals}
        utils={nodeLayerUtils}
        refs={nodeLayerRefs.current}
      />
      <CanvasEffects
        svgRef={svgRef}
        isInitialized={isInitialized}
        isDragging={isDragging}
        selectedNodes={selectedNodes}
        selectedConnectionId={selectedConnection?.id}
        isNodeSelected={isNodeSelected}
        getConnectionMarker={getConnectionMarker}
      />
      <InteractionLayer
        svgRef={svgRef}
        onCanvasClick={onCanvasClick}
        onCanvasMouseMove={onCanvasMouseMove}
        registerEventCleanup={registerEventCleanup}
      />
    </>
  );
}

export default React.memo(OptimizedWorkflowCanvas);