/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
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
  CallbackPriority,
  NodeZIndexState,
} from "../utils/canvas-constants";
import GridLayer from "./layers/GridLayer";
import NodeLayer from "./layers/NodeLayer";
import ConnectionLayer from "./layers/ConnectionLayer";
import InteractionLayer from "./layers/InteractionLayer";
import CanvasEffects from "./layers/CanvasEffects";

type DesignerMode = 'workflow' | 'architecture'

// Props expected from WorkflowDesigner
interface WorkflowCanvasProps {
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
  onPortDragEnd: (targetNodeId?: string, targetPortId?: string) => void
  canDropOnPort?: (targetNodeId: string, targetPortId: string, portType?: 'input' | 'output') => boolean
  canDropOnNode?: (targetNodeId: string) => boolean
  onTransformChange?: (transform: d3.ZoomTransform) => void
  onZoomLevelChange?: (k: number) => void
  onRegisterZoomBehavior?: (zoom: d3.ZoomBehavior<SVGSVGElement, unknown>) => void
}

function WorkflowCanvas(props: Readonly<WorkflowCanvasProps>) {
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

  // Refs used throughout
  const nodePositionCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const gridCacheRef = useRef<{ lastRenderTime: number; key?: string } | null>(null)
  const nodeLayerRef = useRef<SVGGElement | null>(null)
  const selectionCacheRef = useRef<Map<string, d3.Selection<SVGGElement, unknown, null, undefined>>>(new Map())
  const draggedElementRef = useRef<d3.Selection<any, any, any, any> | null>(null)
  const draggedNodeElementRef = useRef<SVGGElement | null>(null)
  const allNodeElementsRef = useRef<Map<string, SVGGElement>>(new Map())
  const dragStateCleanupRef = useRef<NodeJS.Timeout | null>(null)
  const connectionUpdateQueueRef = useRef<Set<string>>(new Set())
  const visualUpdateQueueRef = useRef<Set<string>>(new Set())
  const rafIdRef = useRef<number | null>(null)
  const rafScheduledRef = useRef<boolean>(false)
  const batchedVisualUpdateRef = useRef<number | null>(null)
  const batchedConnectionUpdateRef = useRef<number | null>(null)
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

  // Shared icon registry for architecture mode icons (<defs>/<symbol>/<use> reuse)
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

  // Enhanced RAF scheduling system with priority queues
  const rafCallbackQueueRef = useRef<
    Array<{ callback: () => void; priority: CallbackPriority }>
  >([]);

  const processRAFQueue = useCallback((frameStart?: number) => {
    if (rafCallbackQueueRef.current.length === 0) {
      rafScheduledRef.current = false;
      rafIdRef.current = null;
      return;
    }

    const start = typeof frameStart === 'number' ? frameStart : performance.now();
    const FRAME_BUDGET = 16.67;
    const deadline = start + FRAME_BUDGET;

    const prio = (p: CallbackPriority) => {
      if (p === 'high') return 3
      if (p === 'normal') return 2
      return 1
    };

    while (rafCallbackQueueRef.current.length > 0 && performance.now() < deadline) {
      // pick the highest priority item
      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < rafCallbackQueueRef.current.length; i++) {
        const score = prio(rafCallbackQueueRef.current[i].priority);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      const [item] = rafCallbackQueueRef.current.splice(bestIdx, 1);
      try {
        item.callback();
      } catch (error) {
        console.warn('RAF callback error:', error);
      }
    }

    if (rafCallbackQueueRef.current.length > 0) {
      rafIdRef.current = requestAnimationFrame(processRAFQueue);
    } else {
      rafScheduledRef.current = false;
      rafIdRef.current = null;
    }
  }, []);

  const scheduleRAF = useCallback(
    (callback: () => void, priority: CallbackPriority = "normal") => {
      rafCallbackQueueRef.current.push({ callback, priority });

      if (!rafScheduledRef.current) {
        rafScheduledRef.current = true;
        rafIdRef.current = requestAnimationFrame(processRAFQueue);
      }
    },
    [processRAFQueue]
  );

  // Enhanced Z-Index Management with change detection to reduce DOM manipulation
  const lastZIndexStateRef = useRef<Map<string, NodeZIndexState>>(new Map());

  const organizeNodeZIndex = useCallback(
    (immediate = false) => {
      const nodeLayer = nodeLayerRef.current;
      if (!nodeLayer || allNodeElementsRef.current.size === 0) return;

      const executeZIndexUpdate = () => {
        const normalNodes: SVGGElement[] = [];
        const selectedNodes: SVGGElement[] = [];
        const draggingNodes: SVGGElement[] = [];
        const currentState = new Map<string, NodeZIndexState>();
        let hasChanges = false;

        allNodeElementsRef.current.forEach((element, nodeId) => {
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
        scheduleRAF(executeZIndexUpdate, "high"); // Z-index updates are high priority for visual feedback
      }
    },
  [isNodeSelected, scheduleRAF, isDragging, getDraggedNodeId]
  );

  // Optimized immediate node dragging z-index management
  const setNodeAsDragging = useCallback(
    (nodeId: string) => {
      const element = allNodeElementsRef.current.get(nodeId);
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

  // Track last updated paths removed; hook handles caching

  // Track current drag positions to prevent position conflicts
  const currentDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );

  // removed obsolete canBottomPortAcceptConnection (logic is owned by node hook)

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

  // Legacy endpoint detection removed - no longer needed since legacy badges are removed

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

  // Removed manual trimPathForArrow. Arrow clearance is now handled in utils
  // via calculateArrowAdjustedPosition and box projections.

  // Connection path is provided by useConnectionPaths hook (see alias above)

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

  // Removed local bottom port layout; use calculatePortPosition for accuracy across modes/variants

  // Enhanced visual feedback system with batching and caching
  const processBatchedVisualUpdates = useCallback(() => {
    if (visualUpdateQueueRef.current.size === 0) return;
    const start = performance.now();
    if (!(window as any).__wfAdaptive) {
      (window as any).__wfAdaptive = { vBudget: 4, lastDuration: 0 };
    }
    const adaptive = (window as any).__wfAdaptive as {
      vBudget: number;
      lastDuration: number;
    };
    const MAX_MS = adaptive.vBudget;
    for (const nodeId of Array.from(visualUpdateQueueRef.current)) {
      if (performance.now() - start > MAX_MS) break;
      const element = allNodeElementsRef.current.get(nodeId);
      if (!element) {
        visualUpdateQueueRef.current.delete(nodeId);
        continue;
      }
      const nodeElement = d3.select(element);
      const nodeBackground = nodeElement.select(".node-background");
      nodeElement
        .style("opacity", 0.9)
        .style("filter", "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))");
      nodeBackground.attr("stroke", "#2196F3").attr("stroke-width", 3);
      visualUpdateQueueRef.current.delete(nodeId);
    }
    if (visualUpdateQueueRef.current.size > 0) {
      scheduleRAF(processBatchedVisualUpdates, "normal");
      batchedVisualUpdateRef.current = 1 as unknown as number;
    } else {
      batchedVisualUpdateRef.current = null;
    }
    const duration = performance.now() - start;
    adaptive.lastDuration = duration;
    const usage = duration / MAX_MS;
    if (usage < 0.6 && adaptive.vBudget < 6) adaptive.vBudget += 0.25;
    else if (usage > 0.9 && adaptive.vBudget > 2) adaptive.vBudget -= 0.25;
  }, [scheduleRAF]);

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

  // Defer useNodeRendering invocation until after helper callbacks are declared

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

      // Applied blue drag visual style immediately

      // Also queue for batched processing as backup
      visualUpdateQueueRef.current.add(nodeId);

      // Start batched processing if not already running
      if (!batchedVisualUpdateRef.current) {
        scheduleRAF(processBatchedVisualUpdates, "normal");
        batchedVisualUpdateRef.current = 1 as unknown as number;
      }
    },
  [processBatchedVisualUpdates, scheduleRAF]
  );

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

  // Batched connection update system for better performance
  const processBatchedConnectionUpdates = useCallback(() => {
    if (connectionUpdateQueueRef.current.size === 0) return;

    // PERFORMANCE: Use cached DOM selections to avoid repeated queries
    const connectionLayer = getCachedSelection("connectionLayer");
    if (!connectionLayer) return;

    // PERFORMANCE: Optimized batching - process more items but with time slicing
    const nodesToProcess = Array.from(connectionUpdateQueueRef.current);
    const startTime = performance.now();
    if (!(window as any).__wfConnAdaptive) {
      (window as any).__wfConnAdaptive = { cBudget: 8, lastDuration: 0 };
    }
    const connAdaptive = (window as any).__wfConnAdaptive as {
      cBudget: number;
      lastDuration: number;
    };
    const maxProcessingTime = connAdaptive.cBudget;
    // Time-slice processing counter removed as it's not used for reporting

    for (const nodeId of nodesToProcess) {
      // Time-slice processing to avoid blocking main thread
      if (performance.now() - startTime > maxProcessingTime) break;

      const affectedConnections = nodeConnectionsMap.get(nodeId) || [];
      if (affectedConnections.length === 0) {
        connectionUpdateQueueRef.current.delete(nodeId);
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

      connectionUpdateQueueRef.current.delete(nodeId);
    }

    // Schedule next batch if there are more connections to process
    if (connectionUpdateQueueRef.current.size > 0) {
      scheduleRAF(processBatchedConnectionUpdates, "normal");
      batchedConnectionUpdateRef.current = 1 as unknown as number;
    } else {
      batchedConnectionUpdateRef.current = null;
    }
    const duration = performance.now() - startTime;
    connAdaptive.lastDuration = duration;
    const usage = duration / maxProcessingTime;
    if (usage < 0.55 && connAdaptive.cBudget < 10) connAdaptive.cBudget += 0.5;
    else if (usage > 0.9 && connAdaptive.cBudget > 4)
      connAdaptive.cBudget -= 0.5;
  }, [nodeConnectionsMap, getConnectionPath, getCachedSelection, scheduleRAF]);

  const updateDraggedNodePosition = useCallback(
    (nodeId: string, newX: number, newY: number) => {
      // Always update node position immediately for smooth dragging
      if (draggedElementRef.current) {
        draggedElementRef.current.attr(
          "transform",
          `translate(${newX}, ${newY})`
        );
      }

      // Store current drag position
      currentDragPositionsRef.current.set(nodeId, { x: newX, y: newY });
      // Sync with connection paths hook for live path updates during drag
      updateConnDragPos(nodeId, { x: newX, y: newY });

      // Throttle connection updates to improve performance
      const now = Date.now();
      if (now - lastDragUpdateRef.current < dragUpdateThrottle) {
        return;
      }
      lastDragUpdateRef.current = now;

      // Queue connection updates for batched processing
      const affectedConnections = nodeConnectionsMap.get(nodeId) || [];
      if (affectedConnections.length > 0) {
        connectionUpdateQueueRef.current.add(nodeId);

        // Start batched processing if not already running
        if (!batchedConnectionUpdateRef.current) {
          scheduleRAF(processBatchedConnectionUpdates, "normal");
          batchedConnectionUpdateRef.current = 1 as unknown as number;
        }
      }
    },
    [
      nodeConnectionsMap,
      processBatchedConnectionUpdates,
      dragUpdateThrottle,
  updateConnDragPos,
  scheduleRAF,
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

  // Node layer (memoized wrapper around useNodeRendering)
  

  // Initialize flag once the SVG layers are present (nodes are now rendered by useNodeRendering)
  useEffect(() => {
    if (isInitialized) return
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const nodeLayer = svg.select<SVGGElement>('.node-layer')
    if (!nodeLayer.empty()) setIsInitialized(true)
  }, [isInitialized, svgRef])

  // Enhanced cache management with memory optimization
  const clearAllCaches = useCallback(() => {
    // Clear connection path cache in hook
    clearConnCache();
    nodePositionCacheRef.current.clear();
    // Removed: lastConnectionPathsRef (replaced by hook cache)
    currentDragPositionsRef.current.clear();
    clearAllDragPositions();
    connectionUpdateQueueRef.current.clear();
    visualUpdateQueueRef.current.clear();
    lastZIndexStateRef.current.clear();
    rafCallbackQueueRef.current = [];
    if (batchedConnectionUpdateRef.current) {
      cancelAnimationFrame(batchedConnectionUpdateRef.current);
      batchedConnectionUpdateRef.current = null;
    }
    if (batchedVisualUpdateRef.current) {
      cancelAnimationFrame(batchedVisualUpdateRef.current);
      batchedVisualUpdateRef.current = null;
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    rafScheduledRef.current = false;
  }, [clearConnCache, clearAllDragPositions]);

  // Clear caches when nodes change
  useEffect(() => {
    clearAllCaches();
  }, [nodes, clearAllCaches]);

  // Clear connection paths when connections change
  useEffect(() => {
    clearConnCache();
  }, [connections, clearConnCache]);

  // Immediate z-index organization for selection changes
  useEffect(() => {
    if (!isDragging && isInitialized) {
      // Use immediate update for selection changes to ensure proper layering
      const nodeLayer = nodeLayerRef.current;
      if (!nodeLayer || allNodeElementsRef.current.size === 0) return;

      const normalNodes: SVGGElement[] = [];
      const selectedNodes: SVGGElement[] = [];
      const draggingNodes: SVGGElement[] = [];

      allNodeElementsRef.current.forEach((element, nodeId) => {
        if (!nodeLayer.contains(element)) return;

  const isNodeDragging = isDragging && nodeId === getDraggedNodeId();
        const isSelected = isNodeSelected(nodeId);

        if (isNodeDragging) {
          draggingNodes.push(element);
        } else if (isSelected) {
          selectedNodes.push(element);
        } else {
          normalNodes.push(element);
        }
      });

      // Reorder DOM elements immediately: normal → selected → dragging
      const orderedElements = [
        ...normalNodes,
        ...selectedNodes,
        ...draggingNodes,
      ];

      orderedElements.forEach((element) => {
        if (nodeLayer.contains(element) && nodeLayer.lastChild !== element) {
          nodeLayer.appendChild(element);
        }
      });
    }
  }, [selectedNodes, isNodeSelected, isInitialized, isDragging, getDraggedNodeId]);

  // Monitor drag state changes to clean up DOM classes
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // If we're not dragging, remove all dragging classes
    if (!isDragging) {
      svg.selectAll(".node.dragging").classed("dragging", false);
      // Clear draggedElementRef when not dragging
      if (draggedElementRef.current) {
        draggedElementRef.current = null;
      }
    }
  }, [isDragging, svgRef]);

  // Legacy nodes effect removed. Nodes, ports, and side/bottom ports are rendered via useNodeRendering hook.

  // Connections rendered via memoized layer

  // (migrated) root SVG events now handled by useCanvasEvents

  // Grid is managed in a memoized layer

  // Remove duplicate CSS since hover styles are already in globals.css

  // Visual state effect - handle selection and connection states with z-index management
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return;

    const svg = d3.select(svgRef.current);
    const mainNodeLayer = svg.select(".node-layer");
    const connectionLayer = svg.select(".connection-layer");

    // Update node visual states only
    mainNodeLayer.selectAll(".node").each(function (d: any) {
      const nodeElement = d3.select(this);
      const isSelected = isNodeSelected(d.id);
      const isDragging = nodeElement.classed("dragging");
      const nodeBackground = nodeElement.select(".node-background");

      nodeElement.classed("selected", isSelected);

      if (!isDragging) {
        if (isSelected) {
          nodeElement.style(
            "filter",
            "drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))"
          );
          nodeBackground.attr("stroke", "#2196F3").attr("stroke-width", 3);
        } else {
          nodeElement.style("filter", "none");
          nodeBackground
            .attr("stroke", getNodeColor(d.type, d.status))
            .attr("stroke-width", 2);
        }
      }
    });

    // Ensure proper z-index after visual state changes (but only if not dragging)
    if (!isDragging) {
      organizeNodeZIndex(true); // Use immediate execution to ensure proper layering
    }

    // Update connection selection state only - don't touch hover state
    connectionLayer.selectAll(".connection").each(function (d: any) {
      const connectionGroup = d3.select(this as SVGGElement);
      const pathElement = connectionGroup.select(".connection-path");
      const isSelected = selectedConnection?.id === d.id;
      const isCurrentlyHovered = connectionGroup.classed("connection-hover");

      // Update selection class
      connectionGroup.classed("connection-selected", isSelected);

      // Production selection effects removed - using CSS-based styling

      // Only update visual attributes if not currently hovered
      if (!isCurrentlyHovered) {
        if (isSelected) {
          pathElement
            .attr("stroke", "#2196F3")
            .attr("stroke-width", 3)
            .attr("marker-end", getConnectionMarker(d, "selected"));
        } else {
          pathElement
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("marker-end", getConnectionMarker(d, "default"));
        }
      }
    });
  }, [
    selectedNodes,
    selectedConnection?.id,
    isInitialized,
    isDragging,
    getConnectionMarker,
    isNodeSelected,
    organizeNodeZIndex,
    svgRef,
  ]);

  // Connection state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select("g");

    // Handle connection preview
    g.selectAll(".connection-preview").remove();

    if (isConnecting && connectionStart) {
      console.log("🔄 Connection effect - preview update:", {
        isConnecting,
        connectionStart,
        connectionPreview,
      });
      const sourceNode = nodeMap.get(connectionStart.nodeId);
      if (sourceNode && connectionPreview) {
        console.log(
          "🔄 Rendering preview in effect from:",
          sourceNode.id,
          "to:",
          connectionPreview
        );
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

        // Arrow clearance handled by preview path utilities; no manual trim needed

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
      } else {
        console.log("🔄 Effect not rendering preview:", {
          sourceNode: !!sourceNode,
          connectionPreview: !!connectionPreview,
        });
      }
    }

  // Port visual states are managed by usePortInteractions hook

    // Fixed: Added all required dependencies to prevent stale closures
    // Uses memoized functions where possible to prevent infinite re-renders
  }, [
    isConnecting,
    connectionPreview,
    connectionStart,
    nodeVariant,
    isInitialized,
    workflowContextState.designerMode,
    nodeMap,
    nodes, // Required for hover detection and port highlighting
    svgRef,
    getConfigurableDimensions,
  ]);

  // REMOVED: Architecture mode port visibility JavaScript management
  // CSS now handles all port visibility states automatically:
  // - Base state: .canvas-container.architecture-mode .port-group (hidden)
  // - Hover state: .canvas-container.architecture-mode .node:hover .port-group (visible)
  // - Connecting state: .canvas-container .workflow-canvas.connecting .port-group (visible)
  // This prevents inline style conflicts with CSS class-based styling

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

      console.log("🧹 Cleaned up port highlighting after connection ended");
    }
  }, [isConnecting, isInitialized, svgRef]);

  // Removed canvasTransform-tied grid update to avoid dependency storms; handled by useGridEffect

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
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
  // Clear batched markers; central RAF loop will stop when queue empties
  batchedVisualUpdateRef.current = null;
  batchedConnectionUpdateRef.current = null;
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
      <NodeLayer
        svgRef={svgRef}
        nodes={nodes}
        connections={connections}
        isDragging={isDragging}
        designerMode={workflowContextState.designerMode as DesignerMode | undefined}
        isNodeSelected={isNodeSelected}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDrag={onNodeDrag}
        onPortClick={onPortClick}
        onPlusButtonClick={onPlusButtonClick}
        onPortDragStart={onPortDragStart}
        onPortDrag={onPortDrag}
        onPortDragEnd={onPortDragEnd}
        canDropOnNode={canDropOnNode}
        isContextDragging={isContextDragging}
        getDraggedNodeId={getDraggedNodeId}
        startDragging={startDragging}
        updateDragPosition={updateDragPosition}
        endDragging={endDragging}
        setDropFeedback={setDropFeedback}
        applyDragVisualStyle={applyDragVisualStyle}
        updateDraggedNodePosition={updateDraggedNodePosition}
        resetNodeVisualStyle={resetNodeVisualStyle}
        setNodeAsDragging={setNodeAsDragging}
        organizeNodeZIndex={organizeNodeZIndex}
        getConfigurableDimensions={(n: any) => (getConfigurableDimensions as any)(n)}
        getArchitectureIconSvg={getArchitectureIconSvg}
        isServicesArchitectureNode={isServicesArchitectureNode}
        getPortHighlightClass={getPortHighlightClass}
        getConfigurablePortPositions={getConfigurablePortPositions}
        draggedElementRef={draggedElementRef as any}
        draggedNodeElementRef={draggedNodeElementRef}
        allNodeElementsRef={allNodeElementsRef}
        dragStateCleanupRef={dragStateCleanupRef}
        currentDragPositionsRef={currentDragPositionsRef}
        connectionUpdateQueueRef={connectionUpdateQueueRef}
        visualUpdateQueueRef={visualUpdateQueueRef}
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

// Custom comparator: ensure re-render when nodes/connections content changes even if array refs are reused
function workflowCanvasPropsAreEqual(prev: Readonly<WorkflowCanvasProps>, next: Readonly<WorkflowCanvasProps>) {
  // Quick checks on primitives first
  if (prev.showGrid !== next.showGrid) return false;
  if (prev.nodeVariant !== next.nodeVariant) return false;
  if (prev.isConnecting !== next.isConnecting) return false;

  // Canvas transform
  const pt = prev.canvasTransform;
  const nt = next.canvasTransform;
  if (pt.k !== nt.k || pt.x !== nt.x || pt.y !== nt.y) return false;

  // Selected connection id
  const prevSelConnId = prev.selectedConnection?.id || null;
  const nextSelConnId = next.selectedConnection?.id || null;
  if (prevSelConnId !== nextSelConnId) return false;

  // Selected nodes size (Set reference may be stable across mutations)
  if (prev.selectedNodes.size !== next.selectedNodes.size) return false;

  // Fingerprints for nodes and connections by IDs (sorted) to detect content changes
  const prevNodeFp = prev.nodes
    .map((n) => `${n.id}@${Math.round((n as any).x ?? 0)},${Math.round((n as any).y ?? 0)}#${(n as any).inputs?.length ?? 0}:${(n as any).outputs?.length ?? 0}`)
    .sort()
    .join('|');
  const nextNodeFp = next.nodes
    .map((n) => `${n.id}@${Math.round((n as any).x ?? 0)},${Math.round((n as any).y ?? 0)}#${(n as any).inputs?.length ?? 0}:${(n as any).outputs?.length ?? 0}`)
    .sort()
    .join('|');
  if (prevNodeFp !== nextNodeFp) return false;

  const prevConnIds = prev.connections.map((c) => c.id ?? `${c.sourceNodeId}->${c.targetNodeId}`).sort().join('|');
  const nextConnIds = next.connections.map((c) => c.id ?? `${c.sourceNodeId}->${c.targetNodeId}`).sort().join('|');
  if (prevConnIds !== nextConnIds) return false;

  // If we get here, consider equal enough to skip re-render
  return true;
}

export default React.memo(WorkflowCanvas, workflowCanvasPropsAreEqual);
export const CanvasCore = WorkflowCanvas;
