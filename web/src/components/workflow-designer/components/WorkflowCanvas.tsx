/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import * as d3 from "d3";
import type { WorkflowNode, Connection, NodeVariant, NodePort } from "../types";
import { useWorkflowContext } from "../contexts/WorkflowContext";
import { getVisibleCanvasBounds } from "../utils/canvas-utils";
import {
  getNodeColor,
  getPortColor,
  getNodeIcon,
  getNodeShape,
  getShapeAwareDimensions,
  getNodeShapePath,
  getPortPositions,
  NodeTypes,
} from "../utils/node-utils";
// Removed unused import: getNodeDimensions
import {
  calculateConnectionPreviewPath,
  calculatePortPosition, // Still needed for bottom ports
  getConnectionGroupInfo,
  generateModeAwareConnectionPath,
} from "../utils/connection-utils";
// Grid performance utilities
import {
  GridPerformanceMonitor,
  GridOptimizer,
} from "../utils/grid-performance";
// Production connection imports removed - simplified to use standard connection paths
// Connection config imports removed - simplified architecture

// Type aliases for better maintainability
type CallbackPriority = "high" | "normal" | "low";
type NodeZIndexState = "normal" | "selected" | "dragging";

export interface WorkflowCanvasProps {
  // SVG ref
  svgRef: React.RefObject<SVGSVGElement>;

  // Data
  nodes: WorkflowNode[];
  connections: Connection[];

  // Canvas state
  showGrid: boolean;
  canvasTransform: { x: number; y: number; k: number };

  // Node rendering configuration
  nodeVariant?: NodeVariant;

  // Selection state
  selectedNodes: Set<string>;
  selectedConnection: Connection | null;
  isNodeSelected: (nodeId: string) => boolean;

  // Connection state
  isConnecting: boolean;
  connectionStart: {
    nodeId: string;
    portId: string;
    type: "input" | "output";
  } | null;
  connectionPreview: { x: number; y: number } | null;

  // Event handlers
  onNodeClick: (node: WorkflowNode, ctrlKey: boolean) => void;
  onNodeDoubleClick: (node: WorkflowNode) => void;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  onConnectionClick: (connection: Connection) => void;
  onPortClick: (
    nodeId: string,
    portId: string,
    portType: "input" | "output"
  ) => void;
  onCanvasClick: () => void;
  onCanvasMouseMove: (x: number, y: number) => void;

  // Drag & Drop handlers
  onPortDragStart: (
    nodeId: string,
    portId: string,
    portType: "input" | "output"
  ) => void;
  onPortDrag: (x: number, y: number) => void;
  onPortDragEnd: (
    targetNodeId?: string,
    targetPortId?: string,
    canvasX?: number,
    canvasY?: number
  ) => void;

  // Drop validation
  canDropOnPort: (
    targetNodeId: string,
    targetPortId: string,
    targetPortType?: "input" | "output"
  ) => boolean;
  canDropOnNode: (targetNodeId: string) => boolean;

  // Plus button handler for bottom ports
  onPlusButtonClick?: (nodeId: string, portId: string) => void;

  // Canvas transform
  onTransformChange: (transform: d3.ZoomTransform) => void;
  onZoomLevelChange?: (zoomLevel: number) => void;
  onRegisterZoomBehavior?: (
    zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>
  ) => void;
}

const WorkflowCanvas = React.memo(function WorkflowCanvas({
  svgRef,
  nodes,
  connections,
  showGrid,
  canvasTransform,
  nodeVariant = "standard",
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
  onCanvasClick,
  onCanvasMouseMove,
  onPortDragStart,
  onPortDrag,
  onPortDragEnd,
  canDropOnPort,
  canDropOnNode,
  onPlusButtonClick,
  onTransformChange,
  onZoomLevelChange,
  onRegisterZoomBehavior,
}: WorkflowCanvasProps) {
  // Get dragging state and designer mode from context
  const {
    state: workflowContextState,
    isDragging: isContextDragging,
    getDraggedNodeId,
    startDragging,
    updateDragPosition,
    endDragging,
  } = useWorkflowContext();

  // Production connection system removed - simplified to use standard paths

  // Debug controls removed - production connection system simplified

  // Remove hover state from React - manage it directly in D3
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Performance state
  const [isInitialized, setIsInitialized] = useState(false);
  const rafIdRef = useRef<number | null>(null);
  const rafScheduledRef = useRef<boolean>(false);

  // Enhanced drag performance state
  const connectionUpdateQueueRef = useRef<Set<string>>(new Set());
  const batchedConnectionUpdateRef = useRef<number | null>(null);
  const visualUpdateQueueRef = useRef<Set<string>>(new Set());
  const batchedVisualUpdateRef = useRef<number | null>(null);

  // PERFORMANCE: D3 selection caching to avoid repeated DOM queries
  const d3SelectionCacheRef = useRef<{
    svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    nodeLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
    connectionLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
    gridLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
    lastUpdate?: number;
  }>({});

  // DRAG STATE: Store drag connection data independent of React state
  const dragConnectionDataRef = useRef<{
    nodeId: string;
    portId: string;
    type: "input" | "output";
  } | null>(null);

  // PORT HIGHLIGHTING: Debounce port highlighting to prevent flickering
  // Legacy timeout-based port highlighting removed; kept ref placeholder eliminated for cleanliness
  const lastPortHighlightStateRef = useRef<Map<string, boolean>>(new Map());

  // Debounced port highlighting to prevent flickering
  const pendingPortHighlightsRef = useRef<
    Array<{
      key: string;
      canDrop: boolean;
      group: d3.Selection<any, any, any, any>;
    }>
  >([]);
  const highlightRafRef = useRef<number | null>(null);

  const flushPortHighlights = useCallback(() => {
    const items = pendingPortHighlightsRef.current;
    if (items.length === 0) return;
    for (const item of items) {
      item.group.classed("can-dropped", item.canDrop);
      lastPortHighlightStateRef.current.set(item.key, item.canDrop);
    }
    pendingPortHighlightsRef.current = [];
    highlightRafRef.current = null;
  }, []);

  const scheduleHighlightFlush = useCallback(() => {
    if (highlightRafRef.current != null) return;
    highlightRafRef.current = requestAnimationFrame(flushPortHighlights);
  }, [flushPortHighlights]);

  const updatePortHighlighting = useCallback(
    (
      portKey: string,
      canDrop: boolean,
      portGroup: d3.Selection<any, any, any, any>
    ) => {
      const lastState = lastPortHighlightStateRef.current.get(portKey);
      if (lastState === canDrop) return;
      pendingPortHighlightsRef.current.push({
        key: portKey,
        canDrop,
        group: portGroup,
      });
      scheduleHighlightFlush();
    },
    [scheduleHighlightFlush]
  );

  // Cleanup timeout on unmount
  // No timeout-based highlight cleanup needed now (rAF based)
  useEffect(
    () => () => {
      if (highlightRafRef.current)
        cancelAnimationFrame(highlightRafRef.current);
    },
    []
  );

  // PERFORMANCE: Cached D3 selection getter
  const getCachedSelection = useCallback(
    (type: "svg" | "nodeLayer" | "connectionLayer" | "gridLayer") => {
      if (!svgRef.current) return null;

      const now = performance.now();
      const cache = d3SelectionCacheRef.current;
      const cacheAge = now - (cache.lastUpdate || 0);

      // Invalidate cache after 1 second or if selections are empty
      if (cacheAge > 1000 || !cache[type] || cache[type]!.empty()) {
        const svg = d3.select(svgRef.current);
        cache.svg = svg;
        cache.nodeLayer = svg.select(".node-layer");
        cache.connectionLayer = svg.select(".connection-layer");
        cache.gridLayer = svg.select(".grid-layer");
        cache.lastUpdate = now;
      }

      return cache[type] || null;
    },
    [svgRef]
  );

  // Cleanup timeouts and RAF callbacks on unmount
  useEffect(() => {
    const updateTimeout = updateTimeoutRef.current;
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (batchedConnectionUpdateRef.current) {
        cancelAnimationFrame(batchedConnectionUpdateRef.current);
      }
      if (batchedVisualUpdateRef.current) {
        cancelAnimationFrame(batchedVisualUpdateRef.current);
      }
      // Production connection manager cleanup removed
    };
  }, []);

  // Enhanced connection system initialization removed - simplified to standard paths

  // Enhanced connection manager viewport updates removed

  // Performance monitoring removed - simplified architecture

  // Track current transform with ref for immediate access
  const currentTransformRef = useRef(canvasTransform);

  // Helper functions to reduce cognitive complexity
  const getArrowMarkerForMode = useCallback(
    (isWorkflowMode: boolean, state: "default" | "selected" | "hover") => {
      if (isWorkflowMode) {
        switch (state) {
          case "selected":
            return "url(#arrowhead-workflow-selected)";
          case "hover":
            return "url(#arrowhead-workflow-hover)";
          default:
            return "url(#arrowhead-workflow)";
        }
      } else {
        switch (state) {
          case "selected":
            return "url(#arrowhead-architecture-selected)";
          case "hover":
            return "url(#arrowhead-architecture-hover)";
          default:
            return "url(#arrowhead-architecture)";
        }
      }
    },
    []
  );

  const getLeftArrowMarker = useCallback(
    (state: "default" | "selected" | "hover") => {
      switch (state) {
        case "selected":
          return "url(#arrowhead-left-selected)";
        case "hover":
          return "url(#arrowhead-left-hover)";
        default:
          return "url(#arrowhead-left)";
      }
    },
    []
  );

  /**
   * Helper function to determine connection direction and appropriate arrow marker
   * Now includes mode-specific styling for workflow vs architecture modes
   */
  const getConnectionMarker = useCallback(
    (
      connection: Connection,
      state: "default" | "selected" | "hover" = "default"
    ) => {
      const sourceNode = nodes.find((n) => n.id === connection.sourceNodeId);
      const targetNode = nodes.find((n) => n.id === connection.targetNodeId);

      if (!sourceNode || !targetNode) return "url(#arrowhead)";

      const isWorkflowMode = workflowContextState.designerMode === "workflow";
      const isSourceBottomPort = sourceNode.bottomPorts?.some(
        (p) => p.id === connection.sourcePortId
      );

      if (isSourceBottomPort) {
        const isLeftToRight = targetNode.x > sourceNode.x;
        return isLeftToRight
          ? getArrowMarkerForMode(isWorkflowMode, state)
          : getLeftArrowMarker(state);
      }

      return getArrowMarkerForMode(isWorkflowMode, state);
    },
    [
      nodes,
      workflowContextState.designerMode,
      getArrowMarkerForMode,
      getLeftArrowMarker,
    ]
  );
  useEffect(() => {
    currentTransformRef.current = canvasTransform;
  }, [canvasTransform]);

  // Drag state with context integration
  const draggedElementRef = useRef<d3.Selection<any, any, any, any> | null>(
    null
  );
  const draggedNodeElementRef = useRef<SVGGElement | null>(null);
  const nodeLayerRef = useRef<SVGGElement | null>(null);
  const allNodeElementsRef = useRef<Map<string, SVGGElement>>(new Map());

  // Enhanced dragging state management for stability with context integration
  const dragStateCleanupRef = useRef<NodeJS.Timeout | null>(null);

  // Use context-based dragging state
  const isDragging = isContextDragging();
  const draggedNodeId = getDraggedNodeId();

  // Cache refs for performance with size limits to prevent memory leaks
  const connectionPathCacheRef = useRef<Map<string, string>>(new Map());
  const gridCacheRef = useRef<{
    transform: string;
    pattern: string;
    lastRenderTime: number;
    viewport: { width: number; height: number };
    bounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      width: number;
      height: number;
    };
  } | null>(null);
  const nodePositionCacheRef = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );

  // Grid performance monitoring using centralized utilities
  const gridPerformanceRef = useRef<GridPerformanceMonitor | null>(null);

  // Initialize grid performance monitor
  useEffect(() => {
    if (!gridPerformanceRef.current) {
      gridPerformanceRef.current = new GridPerformanceMonitor();

      // Start development monitoring if in dev mode
      // Development performance monitoring hook removed for production bundle slimming
    }
  }, []);

  // Cache size limits to prevent memory issues
  const MAX_CACHE_SIZE = 1000;
  const CACHE_CLEANUP_THRESHOLD = 1200;
  const GRID_CACHE_DURATION = 30000; // 30 seconds cache for grid patterns (maximized for >80% hit rate)

  // High-performance pattern-based grid creation with enhanced caching and performance monitoring
  const createGrid = useCallback(
    (
      gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
      transform: { x: number; y: number; k: number },
      viewportWidth: number,
      viewportHeight: number
    ) => {
      const startTime = performance.now();

      if (!showGrid) {
        gridLayer.selectAll("*").remove();
        gridCacheRef.current = null;
        return;
      }

      // Use GridOptimizer for intelligent grid calculations
      const baseGridSize = 20;

      // Use GridOptimizer to determine if grid should be shown
      if (!GridOptimizer.shouldShowGrid(transform.k)) {
        gridLayer.selectAll("*").remove();
        gridCacheRef.current = null;
        return;
      }

      // PERFORMANCE OPTIMIZATION: Maximized cache key tolerance for >80% hit rate
      const roundedTransform = {
        x: Math.round(transform.x / 100) * 100, // Further increased tolerance to 100px for maximum cache hits
        y: Math.round(transform.y / 100) * 100, // Further increased tolerance to 100px for maximum cache hits
        k: Math.round(transform.k * 5) / 5, // Reduced precision to 0.2 steps for maximum cache efficiency
      };

      const transformString = `${roundedTransform.x},${roundedTransform.y},${roundedTransform.k}`;
      const viewportString = `${Math.round(viewportWidth / 400) * 400}x${
        Math.round(viewportHeight / 400) * 400
      }`;
      const cacheKey = `${transformString}:${viewportString}`;

      const cached = gridCacheRef.current;
      const now = performance.now();

      // CRITICAL FIX: Simplified cache validation - remove brittle DOM checks that cause false misses
      // Only validate cache existence, time, and transform - let recreation handle DOM inconsistencies
      const isCacheValid =
        cached &&
        cached.transform === cacheKey &&
        now - cached.lastRenderTime < GRID_CACHE_DURATION &&
        Math.abs(cached.viewport.width - viewportWidth) < 500 && // Maximum tolerance to boost cache hits
        Math.abs(cached.viewport.height - viewportHeight) < 500; // Maximum tolerance to boost cache hits

      if (isCacheValid) {
        gridPerformanceRef.current?.recordCacheHit();
        // Minimal logging - only log every 100th cache hit to reduce noise
        if (process.env.NODE_ENV === "development") {
          const metrics = gridPerformanceRef.current?.getMetrics();
          if (metrics && metrics.cacheHits % 100 === 0) {
            console.log("🎯 Grid Cache Hit (every 100th)", {
              cacheKey,
              totalHits: metrics.cacheHits,
              hitRate: `${metrics.cacheHitRate.toFixed(1)}%`,
            });
          }
        }
        return;
      }

      // PERFORMANCE DEBUGGING: Simplified cache miss analysis
      if (cached) {
        // Only log significant cache misses to reduce noise even further
        if (process.env.NODE_ENV === "development") {
          const metrics = gridPerformanceRef.current?.getMetrics();
          if (metrics && metrics.cacheMisses % 100 === 0) {
            console.log("🔄 Grid Cache Miss (every 100th)", {
              cacheKey,
              cachedKey: cached.transform,
              reason:
                cached.transform !== cacheKey
                  ? "transform-mismatch"
                  : "time-expired",
              totalMisses: metrics.cacheMisses,
            });
          }
        }
      }

      // Cache miss - regenerate grid
      gridPerformanceRef.current?.recordCacheMiss();

      // Use GridOptimizer for intelligent dot properties calculation
      const dotProperties = GridOptimizer.calculateDotProperties(transform.k);
      const { radius: dotRadius, opacity: dotOpacity } = dotProperties;

      // Get or create the pattern definition
      const svg = gridLayer.node()?.closest("svg");
      if (!svg) {
        console.warn("🚨 Grid: No SVG parent found");
        return;
      }

      const svgSelection = d3.select(svg);
      if (!svgSelection) {
        console.warn("🚨 Grid: No SVG selection available");
        return;
      }
      let defs = svgSelection.select<SVGDefsElement>("defs");
      if (defs.empty()) {
        defs = svgSelection.insert<SVGDefsElement>("defs", ":first-child");
      }

      // Use GridOptimizer for intelligent pattern ID generation
      const patternId = GridOptimizer.generatePatternId(transform.k);
      const pattern = defs.select(`#${patternId}`);

      // Create new pattern for this zoom level if doesn't exist
      if (pattern.empty()) {
        const newPattern = defs
          .append("pattern")
          .attr("id", patternId)
          .attr("patternUnits", "userSpaceOnUse")
          .attr("width", baseGridSize)
          .attr("height", baseGridSize);

        newPattern
          .append("circle")
          .attr("cx", baseGridSize / 2)
          .attr("cy", baseGridSize / 2)
          .attr("class", "pattern-dot")
          .attr("r", dotRadius / transform.k)
          .attr("fill", "#d1d5db")
          .attr("opacity", dotOpacity);
      } else {
        // Update existing pattern
        defs
          .select(`#${patternId}`)
          .attr("width", baseGridSize)
          .attr("height", baseGridSize)
          .select(".pattern-dot")
          .attr("r", dotRadius / transform.k)
          .attr("opacity", dotOpacity);
      }

      // PERFORMANCE: Selective clearing - only remove grid elements, preserve other content
      gridLayer.selectAll(".grid-pattern-rect").remove();

      // Clean up unused patterns to prevent memory leaks
      if (cached && cached.pattern && cached.pattern !== patternId) {
        const oldPattern = svgSelection.select(`#${cached.pattern}`);
        if (!oldPattern.empty()) {
          oldPattern.remove();
        }
      }

      // Enhanced bounds calculation with intelligent padding using GridOptimizer
      const padding = GridOptimizer.calculateIntelligentPadding(transform.k);
      const bounds = getVisibleCanvasBounds(
        transform,
        viewportWidth,
        viewportHeight,
        padding
      );

      // Validate bounds to prevent invalid rectangles
      if (bounds.width <= 0 || bounds.height <= 0) {
        console.warn("🚨 Grid: Invalid bounds calculated", bounds);
        return;
      }

      // Create optimized single rectangle with pattern
      gridLayer
        .append("rect")
        .attr("class", "grid-pattern-rect")
        .attr("x", bounds.minX)
        .attr("y", bounds.minY)
        .attr("width", bounds.width)
        .attr("height", bounds.height)
        .attr("fill", `url(#${patternId})`)
        .style("pointer-events", "none")
        .style("will-change", "transform");

      // Enhanced cache with all necessary data and performance tracking
      const renderTime = performance.now() - startTime;

      // Update performance tracking using centralized monitor
      gridPerformanceRef.current?.recordRender(renderTime);

      gridCacheRef.current = {
        transform: cacheKey,
        pattern: patternId,
        lastRenderTime: now,
        viewport: { width: viewportWidth, height: viewportHeight },
        bounds: bounds,
      };

      // Reduced performance logging - only show summary every 100 renders
      if (
        process.env.NODE_ENV === "development" &&
        gridPerformanceRef.current
      ) {
        const metrics = gridPerformanceRef.current.getMetrics();

        // Only log detailed performance every 100 renders to reduce noise
        if (metrics.renderCount % 100 === 0) {
          console.log("🔍 Grid Performance Summary (every 100 renders)", {
            renderTime: `${renderTime.toFixed(2)}ms`,
            avgRenderTime: `${metrics.avgRenderTime.toFixed(2)}ms`,
            cacheHitRate: `${metrics.cacheHitRate.toFixed(1)}%`,
            totalRenders: metrics.renderCount,
          });
        }

        // Only show performance warnings every 50 poor performances
        const report = gridPerformanceRef.current.getPerformanceReport();
        if (
          (report.status === "warning" || report.status === "poor") &&
          metrics.renderCount % 50 === 0
        ) {
          console.warn(
            `🚨 Grid Performance ${report.status.toUpperCase()} (every 50th):`,
            report.summary
          );
        }
      }
    },
    [showGrid]
  );

  // Enhanced cache and memory management utilities
  const cleanupCaches = useCallback(() => {
    // Clean connection path cache if too large (reduced logging)
    if (connectionPathCacheRef.current.size > CACHE_CLEANUP_THRESHOLD) {
      const keysToDelete = Array.from(
        connectionPathCacheRef.current.keys()
      ).slice(0, connectionPathCacheRef.current.size - MAX_CACHE_SIZE);
      keysToDelete.forEach((key) => connectionPathCacheRef.current.delete(key));
      if (process.env.NODE_ENV === "development") {
        console.log(
          `🧹 Cleaned connection cache: ${keysToDelete.length} entries`
        );
      }
    }

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
  }, []);

  // Schedule regular cache cleanup every 30 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupCaches, 30000);
    return () => clearInterval(cleanupInterval);
  }, [cleanupCaches]);

  // Enhanced RAF scheduling system with priority queues
  const rafCallbackQueueRef = useRef<
    Array<{ callback: () => void; priority: CallbackPriority }>
  >([]);

  const processRAFQueue = useCallback(() => {
    if (rafCallbackQueueRef.current.length === 0) {
      rafScheduledRef.current = false;
      rafIdRef.current = null;
      return;
    }

    // Sort callbacks by priority (high -> normal -> low)
    const sortedCallbacks = [...rafCallbackQueueRef.current].sort((a, b) => {
      const priorities = { high: 3, normal: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });

    // Process high priority callbacks first, with a limit to prevent blocking
    const highPriorityCallbacks = sortedCallbacks
      .filter((item) => item.priority === "high")
      .slice(0, 3);
    const otherCallbacks = sortedCallbacks
      .filter((item) => item.priority !== "high")
      .slice(0, 2);

    const callbacksToProcess = [...highPriorityCallbacks, ...otherCallbacks];

    // Execute callbacks
    callbacksToProcess.forEach((item) => {
      try {
        item.callback();
      } catch (error) {
        console.warn("RAF callback error:", error);
      }
    });

    // Remove processed callbacks
    rafCallbackQueueRef.current = rafCallbackQueueRef.current.filter(
      (item) => !callbacksToProcess.includes(item)
    );

    // Schedule next frame if there are more callbacks
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

          const isNodeDragging = isDragging && nodeId === draggedNodeId;
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
    [isNodeSelected, scheduleRAF, isDragging, draggedNodeId]
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

  // Track last updated paths to prevent unnecessary redraws
  const lastConnectionPathsRef = useRef<Map<string, string>>(new Map());

  // Track current drag positions to prevent position conflicts
  const currentDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );

  /**
   * Function to check if a bottom port can accept additional connections
   * Based on business rules for different port types:
   * - ai-model: Single connection only (no plus button when connected)
   * - memory: Single connection only (no plus button when connected)
   * - tool: Multiple connections allowed (always show plus button)
   * - Other array types: Multiple connections allowed
   * - Other single types: Single connection only
   */
  const canBottomPortAcceptConnection = useCallback(
    (
      nodeId: string,
      portId: string,
      connections: Connection[],
      designerMode?: "workflow" | "architecture"
    ) => {
      // Get the node to check its bottom ports configuration
      const node = nodeMap.get(nodeId);
      if (!node?.bottomPorts) return false;

      const port = node.bottomPorts.find((p) => p.id === portId);
      if (!port) return false;

      // Count existing connections for this port
      const existingConnections = connections.filter(
        (conn) => conn.sourceNodeId === nodeId && conn.sourcePortId === portId
      );

      // In architecture mode, be more permissive for legacy system support
      if (designerMode === "architecture") {
        // Allow multiple connections to most ports in architecture mode
        // This supports legacy systems with multiple endpoints
        switch (portId) {
          case "ai-model":
            // Even AI Model ports can have multiple connections in architecture mode
            // (e.g., different model versions or fallback models)
            return true;

          case "memory":
            // Memory ports can connect to multiple stores in architecture mode
            return true;

          case "tool":
            // Tool port: Always allows multiple connections
            return true;

          default:
            // In architecture mode, allow multiple connections for all ports
            // This supports legacy systems with multiple endpoints
            return true;
        }
      }

      // Original workflow mode logic (stricter validation)
      switch (portId) {
        case "ai-model":
          // AI Model port: Only allows 1 connection (can replace existing)
          // Show plus button only when no connection exists
          return existingConnections.length === 0;

        case "memory":
          // Memory port: Typically allows only 1 connection
          return existingConnections.length === 0;

        case "tool":
          // Tool port: Allows multiple connections (array of tools)
          return true;

        default:
          // For other ports, check if dataType suggests multiple connections
          if (port.dataType === "array") {
            // Array types can accept multiple connections
            return true;
          } else {
            // Single value types typically allow only one connection
            return existingConnections.length === 0;
          }
      }
    },
    [nodeMap]
  );

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

  // Cache cleanup utility to prevent memory leaks
  const cleanupConnectionCache = useCallback(() => {
    const cache = connectionPathCacheRef.current;
    const size = cache.size;
    if (size <= MAX_CACHE_SIZE) return;

    // Probabilistic trimming: mild over target triggers lightweight random pruning
    const overBy = size - MAX_CACHE_SIZE;
    const pressureRatio = Math.min(1, overBy / (MAX_CACHE_SIZE * 0.5)); // 0..1 scaling
    const baseSample = 0.02 + pressureRatio * 0.08; // 2%-10% sample each cleanup

    let removed = 0;
    // Iterate insertion order; randomly delete entries based on probability until under soft cap (MAX_CACHE_SIZE * 0.95)
    const softTarget = Math.floor(MAX_CACHE_SIZE * 0.95);
    for (const key of cache.keys()) {
      if (cache.size <= softTarget) break;
      if (Math.random() < baseSample) {
        cache.delete(key);
        removed++;
      }
    }

    // Hard emergency trim if still far above (safety net) - remove oldest directly
    if (cache.size > CACHE_CLEANUP_THRESHOLD) {
      const emergencyTarget = MAX_CACHE_SIZE;
      for (const key of cache.keys()) {
        if (cache.size <= emergencyTarget) break;
        cache.delete(key);
        removed++;
      }
    }

    if (removed > 0 && process.env.NODE_ENV === "development") {
      // Lightweight dev log (gated)
      console.log(
        `🧹 Probabilistic cache trim removed=${removed} size=${
          cache.size
        } pressure=${pressureRatio.toFixed(2)}`
      );
    }
  }, [MAX_CACHE_SIZE, CACHE_CLEANUP_THRESHOLD]);


  // Helper function to create a filled polygon from a path with thickness
  const createFilledPolygonFromPath = useCallback((pathString: string, thickness: number = 6): string => {
    if (!pathString) return '';
    
    try {
      // Create a temporary SVG path element in memory to get path data
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tempSvg.style.position = 'absolute';
      tempSvg.style.visibility = 'hidden';
      tempSvg.style.width = '1px';
      tempSvg.style.height = '1px';
      
      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('d', pathString);
      tempSvg.appendChild(tempPath);
      
      // Add to SVG container temporarily (not body)
      const svgContainer = svgRef.current;
      if (!svgContainer) return pathString;
      svgContainer.appendChild(tempSvg);
      
      // Get total length and sample points along the path
      const pathLength = tempPath.getTotalLength();
      const numSamples = Math.max(20, Math.floor(pathLength / 10)); // Sample every 10 pixels
      const points: Array<{x: number, y: number}> = [];
      
      for (let i = 0; i <= numSamples; i++) {
        const distance = (i / numSamples) * pathLength;
        const point = tempPath.getPointAtLength(distance);
        points.push({ x: point.x, y: point.y });
      }
      
      // Remove temporary SVG
      svgContainer.removeChild(tempSvg);
      
      if (points.length < 2) return pathString;
      
      // Calculate perpendicular offsets for each point
      const leftPoints: Array<{x: number, y: number}> = [];
      const rightPoints: Array<{x: number, y: number}> = [];
      
      for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        let dx = 0, dy = 0;
        
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
      polygonPath += ` A ${endRadius} ${endRadius} 0 0 1 ${rightPoints[rightPoints.length - 1].x} ${rightPoints[rightPoints.length - 1].y}`;
      
      // Trace right side (in reverse)
      for (let i = rightPoints.length - 2; i >= 0; i--) {
        polygonPath += ` L ${rightPoints[i].x} ${rightPoints[i].y}`;
      }
      
      // Add arc at the start and close path
      polygonPath += ` A ${endRadius} ${endRadius} 0 0 1 ${leftPoints[0].x} ${leftPoints[0].y}`;
      polygonPath += ' Z';
      
      return polygonPath;
    } catch (error) {
      console.warn('Error creating filled polygon:', error);
      return pathString;
    }
  }, [svgRef]);

  // Helper function to trim connection path to prevent arrow overlap
  const trimPathForArrow = useCallback((pathString: string, trimLength: number = 4): string => {
    if (!pathString || trimLength <= 0) return pathString;
    
    try {
      // Create a temporary SVG path element to get path data
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tempSvg.style.position = 'absolute';
      tempSvg.style.visibility = 'hidden';
      tempSvg.style.width = '1px';
      tempSvg.style.height = '1px';
      
      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('d', pathString);
      tempSvg.appendChild(tempPath);
      
      // Add to SVG container temporarily
      const svgContainer = svgRef.current;
      if (!svgContainer) return pathString;
      svgContainer.appendChild(tempSvg);
      
      // Get total length and calculate new end point
      const pathLength = tempPath.getTotalLength();
      if (pathLength <= trimLength * 2) {
        svgContainer.removeChild(tempSvg);
        return pathString;
      }
      
      // Get the point that is trimLength away from the end
      const newEndLength = pathLength - trimLength;
      const newEndPoint = tempPath.getPointAtLength(newEndLength);
      
      // Remove temporary SVG
      svgContainer.removeChild(tempSvg);
      
      // Parse the original path and modify the end point
      const pathCommands = pathString.match(/[MLCQSATHVZmlcqsathvz][^MLCQSATHVZmlcqsathvz]*/g);
      if (!pathCommands || pathCommands.length < 2) return pathString;
      
      // Replace the last command with a line to the new end point
      const modifiedCommands = pathCommands.slice(0, -1);
      modifiedCommands.push(`L ${newEndPoint.x} ${newEndPoint.y}`);
      
      return modifiedCommands.join(' ');
    } catch (error) {
      console.warn('Error trimming path for arrow:', error);
      return pathString;
    }
  }, [svgRef]);

  // Memoized connection path calculation with drag position support and memory management
  const getConnectionPath = useCallback(
    (connection: Connection, useDragPositions = false) => {
      const cacheKey = `${connection.id}-${connection.sourceNodeId}-${
        connection.sourcePortId
      }-${connection.targetNodeId}-${connection.targetPortId}-${nodeVariant}${
        useDragPositions ? "-drag" : ""
      }`;

      // Skip cache for drag positions to ensure real-time updates
      if (!useDragPositions) {
        const cached = connectionPathCacheRef.current.get(cacheKey);
        if (cached) return cached;
      }

      let sourceNode = nodeMap.get(connection.sourceNodeId);
      let targetNode = nodeMap.get(connection.targetNodeId);
      if (!sourceNode || !targetNode) return "";

      // Use current drag positions if available
      if (useDragPositions) {
        const sourceDragPos = currentDragPositionsRef.current.get(
          connection.sourceNodeId
        );
        const targetDragPos = currentDragPositionsRef.current.get(
          connection.targetNodeId
        );
        
        if (sourceDragPos) {
          sourceNode = {
            ...sourceNode,
            x: sourceDragPos.x,
            y: sourceDragPos.y,
          } as any;
        }
        if (targetDragPos) {
          targetNode = {
            ...targetNode,
            x: targetDragPos.x,
            y: targetDragPos.y,
          } as any;
        }
      }

      // Always compute a single unified path using mode-aware generator (respects virtual side-ports)
      // If using drag positions, create a transient nodes array with overrides for the two nodes
      const nodesForPath = useDragPositions
        ? nodes.map((n) =>
            n.id === sourceNode!.id
              ? (sourceNode as WorkflowNode)
              : n.id === targetNode!.id
              ? (targetNode as WorkflowNode)
              : n
          )
        : nodes;

      const rawPath = generateModeAwareConnectionPath(
        {
          sourceNodeId: connection.sourceNodeId,
          sourcePortId: connection.sourcePortId,
          targetNodeId: connection.targetNodeId,
          targetPortId: connection.targetPortId,
        },
        nodesForPath,
        nodeVariant,
        workflowContextState.designerMode || "workflow"
      );

      // Trim path to prevent arrow marker from overlapping with target node
      const path = trimPathForArrow(rawPath, 8);

      if (!useDragPositions) {
        connectionPathCacheRef.current.set(cacheKey, path);

        // Periodic cache cleanup to prevent memory leaks
        if (connectionPathCacheRef.current.size > CACHE_CLEANUP_THRESHOLD) {
          cleanupConnectionCache();
        }
      }
      return path;
    },
    [
      nodeMap,
      nodeVariant,
      cleanupConnectionCache,
      workflowContextState.designerMode,
      nodes,
      trimPathForArrow,
    ]
  );

  // Memoized configurable dimensions calculation (shape-aware)
  const getConfigurableDimensions = useMemo(() => {
    const dimensionsCache = new Map<string, any>();

    return (node: WorkflowNode) => {
      const cacheKey = `${node.id}-${nodeVariant}`;
      const cached = dimensionsCache.get(cacheKey);
      if (cached) return cached;

      const shapeDimensions = getShapeAwareDimensions(node);

      // Adjust dimensions based on variant
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
            };

      dimensionsCache.set(cacheKey, result);
      return result;
    };
  }, [nodeVariant]);

  // Helper function to calculate optimal bottom port positioning
  // Uses either 80% of node width OR node width minus 40px (whichever is smaller)
  const calculateBottomPortLayout = useCallback(
    (nodeData: any, portIndex: number) => {
      const dimensions = getConfigurableDimensions(nodeData);
      const nodeWidth = dimensions.width || 200;
      const nodeHeight = dimensions.height || 80;
      const portCount = nodeData.bottomPorts?.length || 0;

      if (portCount === 0) return { x: 0, y: nodeHeight / 2 };

      // Use the smaller of: 80% width OR (width - 40px)
      // This ensures proper spacing for both narrow and wide nodes
      const usableWidth = Math.min(nodeWidth * 0.8, nodeWidth - 70);

      if (portCount === 1) {
        // Single port: center it
        return {
          x: 0,
          y: nodeHeight / 2,
        };
      } else if (portCount === 2) {
        // Two ports: optimized positioning for visual balance
        const spacing = usableWidth / 3; // Divide available space into thirds
        const positions = [-spacing, spacing]; // Place at 1/3 and 2/3 positions
        return {
          x: positions[portIndex] || 0,
          y: nodeHeight / 2,
        };
      } else if (portCount === 3) {
        // Three ports: center one, balance others
        const halfWidth = usableWidth / 2;
        const positions = [-halfWidth, 0, halfWidth];
        return {
          x: positions[portIndex] || 0,
          y: nodeHeight / 2,
        };
      } else {
        // Multiple ports (4+): distribute evenly with optimal spacing
        const spacing = usableWidth / (portCount - 1);
        const x = -usableWidth / 2 + spacing * portIndex;
        return {
          x: x,
          y: nodeHeight / 2,
        };
      }
    },
    [getConfigurableDimensions]
  );

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
      batchedVisualUpdateRef.current = requestAnimationFrame(
        processBatchedVisualUpdates
      );
    } else {
      batchedVisualUpdateRef.current = null;
    }
    const duration = performance.now() - start;
    adaptive.lastDuration = duration;
    const usage = duration / MAX_MS;
    if (usage < 0.6 && adaptive.vBudget < 6) adaptive.vBudget += 0.25;
    else if (usage > 0.9 && adaptive.vBudget > 2) adaptive.vBudget -= 0.25;
  }, []);

  // Unified drop state management
  const setDropFeedback = useCallback(
    (nodeElement: any, show: boolean) => {
      if (!nodeElement) return;

      // Set node-level feedback
      nodeElement.classed("can-drop-node", show);
      nodeElement.select(".node-background").classed("can-drop", show);

      // CRITICAL: Only manage port highlighting when explicitly showing feedback
      // Don't remove port highlighting during drag leave when still connecting
      if (show && isConnecting && connectionStart) {
        nodeElement
          .selectAll(".input-port-group")
          .classed("can-dropped", function (this: any, portData: any) {
            const typedPortData = portData as NodePort & { nodeId: string };
            const nodeId = nodeElement.datum()?.id;

            if (!nodeId || !connectionStart) return false;

            // Use canDropOnPort for validation
            return canDropOnPort(nodeId, typedPortData.id);
          });
      }
      // REMOVED: Don't remove port highlighting during drag leave - let CSS handle visibility
      // This prevents port drop targets from disappearing when dragging out of nodes
    },
    [isConnecting, connectionStart, canDropOnPort]
  );

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
        batchedVisualUpdateRef.current = requestAnimationFrame(
          processBatchedVisualUpdates
        );
      }
    },
    [processBatchedVisualUpdates]
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
      batchedConnectionUpdateRef.current = requestAnimationFrame(
        processBatchedConnectionUpdates
      );
    } else {
      batchedConnectionUpdateRef.current = null;
    }
    const duration = performance.now() - startTime;
    connAdaptive.lastDuration = duration;
    const usage = duration / maxProcessingTime;
    if (usage < 0.55 && connAdaptive.cBudget < 10) connAdaptive.cBudget += 0.5;
    else if (usage > 0.9 && connAdaptive.cBudget > 4)
      connAdaptive.cBudget -= 0.5;
  }, [nodeConnectionsMap, getConnectionPath, getCachedSelection]); // Include required dependencies

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
          batchedConnectionUpdateRef.current = requestAnimationFrame(
            processBatchedConnectionUpdates
          );
        }
      }
    },
    [nodeConnectionsMap, processBatchedConnectionUpdates, dragUpdateThrottle]
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

  // Enhanced cache management with memory optimization
  const clearAllCaches = useCallback(() => {
    connectionPathCacheRef.current.clear();
    nodePositionCacheRef.current.clear();
    lastConnectionPathsRef.current.clear();
    currentDragPositionsRef.current.clear();
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
  }, []);

  // Clear caches when nodes change
  useEffect(() => {
    clearAllCaches();
  }, [nodes, clearAllCaches]);

  // Clear connection paths when connections change
  useEffect(() => {
    lastConnectionPathsRef.current.clear();
  }, [connections]);

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

        const isNodeDragging = isDragging && nodeId === draggedNodeId;
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
  }, [selectedNodes, isNodeSelected, isInitialized, isDragging, draggedNodeId]);

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
  }, [isDragging, draggedNodeId, svgRef]);

  // Main D3 rendering effect - split into smaller, focused effects
  useEffect(() => {
    if (!svgRef.current) return;

    // Copy refs at the start of the effect for cleanup
    const currentSvgRef = svgRef.current;
    const connectionPathCache = connectionPathCacheRef.current;
    const allNodeElements = allNodeElementsRef.current;

    const svg = d3.select(currentSvgRef);
    // Initialize or reuse defs
    let defs = svg.select<any>("defs");
    if (defs.empty()) {
      defs = svg.append("defs");
    } else {
      // Clear existing markers to avoid duplication
      defs.selectAll("*").remove();
    }

    // Background rect (ensure single)
    let bg = svg.select<any>("rect.svg-canvas-background");
    if (bg.empty()) {
      bg = svg.append("rect").attr("class", "svg-canvas-background");
    }
    bg.attr("width", "100%").attr("height", "100%").attr("fill", "#f7f7f7");

    // Arrow markers with direction-aware positioning and optimized refX
  const createArrowMarker = (
      id: string,
      color: string,
      size = 14,
      direction: "right" | "left" = "right"
    ) => {
      const marker = defs
        .append("marker")
        .attr("id", id)
        .attr("markerWidth", size)
        .attr("markerHeight", size)
        .attr("orient", "auto")
        .attr("markerUnits", "userSpaceOnUse");

  // Pad to keep arrow tip clearly before the path end to avoid overlaying port shapes
  // Use a larger proportional pad so even bigger markers won't overlap ports
  const pad = Math.max(5, Math.round(size * 0.5));

      if (direction === "right") {
        // Right-pointing arrow (default)
        // Align the TIP slightly before the endpoint using padding
        marker
          .attr("refX", size - pad)
          .attr("refY", size / 2)
          .append("polygon")
          .attr("points", `0,0 ${size},${size / 2} 0,${size}`)
          .attr("fill", color)
          .attr("stroke", "none");
      } else {
        // Left-pointing arrow
        // Align the TIP slightly before the endpoint using padding
        marker
          .attr("refX", pad)
          .attr("refY", size / 2)
          .append("polygon")
          .attr("points", `${size},0 0,${size / 2} ${size},${size}`)
          .attr("fill", color)
          .attr("stroke", "none");
      }
    };

    // Create directional arrow markers
    createArrowMarker("arrowhead", "#666");
    createArrowMarker("arrowhead-selected", "#2196F3");
    createArrowMarker("arrowhead-hover", "#1976D2", 18);
    createArrowMarker("arrowhead-left", "#666", 14, "left");
    createArrowMarker("arrowhead-left-selected", "#2196F3", 14, "left");
    createArrowMarker("arrowhead-left-hover", "#1976D2", 18, "left");

    // Mode-specific arrow markers for workflow mode
    createArrowMarker("arrowhead-workflow", "#2563eb", 14);
    createArrowMarker("arrowhead-workflow-selected", "#059669", 16);
    createArrowMarker("arrowhead-workflow-hover", "#1d4ed8", 18);

    // Mode-specific arrow markers for architecture mode
    createArrowMarker("arrowhead-architecture", "#7c3aed", 15);
    createArrowMarker("arrowhead-architecture-selected", "#dc2626", 18);
    createArrowMarker("arrowhead-architecture-hover", "#6d28d9", 20);

    // Layer hierarchy (ensure single instances)
    let g = svg.select<any>("g.canvas-root");
    if (g.empty()) {
      g = svg.append("g").attr("class", "canvas-root");
    }
    let gridLayer = g.select<any>("g.grid-layer");
    if (gridLayer.empty()) {
      gridLayer = g
        .append("g")
        .attr("class", "grid-layer")
        .style("pointer-events", "none");
    }
    let mainNodeLayer = g.select<any>("g.node-layer");
    if (mainNodeLayer.empty()) {
      mainNodeLayer = g.append("g").attr("class", "node-layer");
    }
    let connectionLayer = g.select<any>("g.connection-layer");
    if (connectionLayer.empty()) {
      connectionLayer = g.append("g").attr("class", "connection-layer");
    }
    // const labelLayer = g.append('g').attr('class', 'label-layer') // No longer needed

    // Store node layer reference
    nodeLayerRef.current = mainNodeLayer.node() as SVGGElement;

    // Note: Grid creation moved to separate useEffect to prevent disappearing during drag

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 4])
      .on("zoom", (event) => {
        const transform = event.transform;
        const prevK = currentTransformRef.current.k;

        // Resolve current canvas root every time to avoid stale selection when layers are re-created
        if (svgRef.current) {
          const rootSel = d3.select(svgRef.current).select<SVGGElement>('g.canvas-root')
          if (!rootSel.empty()) {
            rootSel.attr('transform', transform.toString())
          }
        }
        !!onZoomLevelChange &&
          prevK != transform.k &&
          onZoomLevelChange(transform.k);

        // Get fresh dimensions for grid update during zoom
        if (svgRef.current && showGrid) {
          const rect = svgRef.current.getBoundingClientRect()
          const rootSel = d3.select(svgRef.current).select<SVGGElement>('g.canvas-root')
          const curGridLayer = rootSel.select<SVGGElement>('g.grid-layer')
          if (!curGridLayer.empty()) {
            createGrid(curGridLayer as any, transform, rect.width, rect.height)
          }
        }

        onTransformChange(transform);

        // Keep connection preview endpoint pinned to cursor during canvas pan/zoom
        // This ensures the preview path updates visually while dragging the canvas
        if (isConnecting && connectionStart && svgRef.current) {
          const srcEvt: any = (event as any).sourceEvent;
          if (srcEvt) {
            // Compute cursor position relative to canvas coordinates using current zoom transform
            const [screenX, screenY] = d3.pointer(
              srcEvt,
              svgRef.current as any
            );
            const [canvasX, canvasY] = transform.invert([screenX, screenY]);
            onPortDrag(canvasX, canvasY);
          }
        }

        // Force nodes to re-render on zoom change by updating their visual state
        if (Math.abs(transform.k - prevK) > 0.01) {
          mainNodeLayer.selectAll(".node").each(function (this: any, d: any) {
            const node = d3.select(this);
            // Force update by re-applying transform
            node.attr("transform", `translate(${d.x}, ${d.y})`);
          });
        }

        // Update ref after consumers have used previous value for comparisons
        currentTransformRef.current = transform;
      });

    // Bind zoom only once (skip if already initialized)
    if (svg.attr("data-zoom-init") !== "true") {
      svg.call(zoom);
      svg.attr("data-zoom-init", "true");
    }

    // Register zoom behavior for programmatic control
    onRegisterZoomBehavior?.(zoom);

    // Set initial transform (not in dependencies to avoid infinite loop)
    svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate(canvasTransform.x, canvasTransform.y)
        .scale(canvasTransform.k)
    );

    // Optimized drag functions

    function dragStarted(this: any, event: any, d: WorkflowNode) {
      const nodeElement = d3.select(this);
      const dragData = d as any;
      const domNode = this as SVGGElement;

      // Clear any pending state cleanup
      if (dragStateCleanupRef.current) {
        clearTimeout(dragStateCleanupRef.current);
        dragStateCleanupRef.current = null;
      }

      const svgElement = svgRef.current!;
      const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgElement);
      const transform = d3.zoomTransform(svgElement);
      const [canvasX, canvasY] = transform.invert([mouseX, mouseY]);

      // Use context-based dragging state
      startDragging(d.id, { x: canvasX, y: canvasY });

      // Force apply dragging class with protection against removal
      nodeElement.classed("dragging", true);

      // Store reference to prevent class removal during updates
      draggedElementRef.current = nodeElement;
      draggedNodeElementRef.current = domNode;

      // Apply dragging visual style and ensure proper z-index
      applyDragVisualStyle(nodeElement, d.id);
      // Set z-index immediately to ensure dragged node is on top
      setNodeAsDragging(d.id);

      // Additional protection: force class persistence
      setTimeout(() => {
        if (draggedElementRef.current && getDraggedNodeId() === d.id) {
          draggedElementRef.current.classed("dragging", true);
        }
      }, 0);

      dragData.dragStartX = canvasX;
      dragData.dragStartY = canvasY;
      dragData.initialX = d.x;
      dragData.initialY = d.y;
      dragData.hasDragged = false;
      dragData.dragStartTime = Date.now();
    }

    function dragged(this: any, event: any, d: WorkflowNode) {
      const dragData = d as any;
      if (dragData.initialX === undefined || dragData.initialY === undefined)
        return;

      const svgElement = svgRef.current!;
      const sourceEvent = event.sourceEvent || event;
      const [mouseX, mouseY] = d3.pointer(sourceEvent, svgElement);
      const transform = d3.zoomTransform(svgElement);
      const [currentCanvasX, currentCanvasY] = transform.invert([
        mouseX,
        mouseY,
      ]);

      const deltaX = currentCanvasX - dragData.dragStartX;
      const deltaY = currentCanvasY - dragData.dragStartY;

      // Update context with current drag position
      updateDragPosition(currentCanvasX, currentCanvasY);

      // Mark as dragged if movement is significant - increase threshold for better click detection
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        dragData.hasDragged = true;
      }

      // Ensure dragging class is maintained during drag operation
      const nodeElement = d3.select(this);
      if (!nodeElement.classed("dragging")) {
        nodeElement.classed("dragging", true);
      }

      const newX = dragData.initialX + deltaX;
      const newY = dragData.initialY + deltaY;

      // Throttle visual updates with debounced RAF
      updateDraggedNodePosition(d.id, newX, newY);

      // Notify parent component
      onNodeDrag(d.id, newX, newY);
    }

    function dragEnded(this: any, event: any, d: WorkflowNode) {
      const dragData = d as any;
      const hasDragged = dragData.hasDragged;
      const dragDuration = Date.now() - (dragData.dragStartTime || 0);
      const nodeElement = d3.select(this);

      // Clean up drag state
      delete dragData.dragStartX;
      delete dragData.dragStartY;
      delete dragData.initialX;
      delete dragData.initialY;
      delete dragData.hasDragged;
      delete dragData.dragStartTime;

      // Only end dragging if we're still in drag state to prevent premature cleanup
      const currentDraggedNodeId = getDraggedNodeId();
      const isCurrentlyDragging = isContextDragging();

      // Always end dragging first, then clean up DOM
      if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
        endDragging();
      }

      // ALWAYS remove dragging class after drag ends, regardless of state
      nodeElement.classed("dragging", false);

      // Clear draggedElementRef if it points to this element
      if (
        draggedElementRef.current &&
        draggedElementRef.current.node() === this
      ) {
        draggedElementRef.current = null;
      }

      // Clear drag position tracking and remove from update queues
      currentDragPositionsRef.current.delete(d.id);
      connectionUpdateQueueRef.current.delete(d.id);
      visualUpdateQueueRef.current.delete(d.id);

      // Reset visual styles
      resetNodeVisualStyle(nodeElement, d.id);

      // Reorganize z-index immediately after drag ends to restore proper order
      organizeNodeZIndex(true); // Use immediate execution to ensure proper layering

      // If no significant drag occurred, treat as click
      if (!hasDragged && event.sourceEvent && dragDuration < 500) {
        const ctrlKey = event.sourceEvent.ctrlKey || event.sourceEvent.metaKey;
        onNodeClick(d, ctrlKey);
      }
    }

    // Optimized connection rendering with caching
    const connectionPaths = connectionLayer
      .selectAll(".connection")
      .data(connections, (d: any) => d.id);

    connectionPaths.exit().remove();
    const connectionEnter = connectionPaths
      .enter()
      .append("g")
      .attr("class", "connection")
      .attr("data-connection-id", (d: any) => d.id)
      // Guardrail: prevent the group from capturing events; only hitbox should be interactive
      .style("pointer-events", "none");

    // Add invisible hitbox for better hover detection (especially for dashed lines)
    connectionEnter
      .append("path")
      .attr("class", "connection-hitbox")
      .attr("d", (d: any) => {
        const path = getConnectionPath(d);
        return createFilledPolygonFromPath(path, 8);
      })
      // Use filled shape for hover detection
      .attr("fill", "rgba(0, 0, 0, 0.01)")
      .attr("stroke", "none")
      .style("pointer-events", "all")
      .style("cursor", "pointer")
      // Let hitbox scale with zoom to match visible path width exactly
      .on("click", (event: any, d: any) => {
        event.stopPropagation();
        onConnectionClick(d);
      })
  .on("mouseenter", function (this: any, _event: any, d: Connection) {
        // Get the connection group (parent g element)
        const connectionGroup = d3.select(this.parentNode as SVGGElement);
        const connectionPath = connectionGroup.select(".connection-path");
        const isSelected = selectedConnection?.id === d.id;

        // Clear any pending timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }

        // Apply hover immediately for non-selected connections
        if (!isSelected && !connectionPath.empty()) {
          connectionGroup.classed("connection-hover", true);
          // Force immediate visual update on the visible path
          connectionPath
            .interrupt() // Stop any ongoing transitions
            .attr("stroke", "#1976D2")
            .attr("stroke-width", 3)
            .attr("marker-end", getConnectionMarker(d, "hover"));
          // Keep hitbox at fixed width for consistent hover area
        }
      })
  .on("mouseleave", function (this: any, _event: any, d: Connection) {
        const connectionGroup = d3.select(this.parentNode as SVGGElement);
        const connectionPath = connectionGroup.select(".connection-path");
        const isSelected = selectedConnection?.id === d.id;

        // Debug logging
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 Connection hover leave:', {
            connectionId: d.id,
            isSelected,
            event: _event.type
          });
        }

        // Remove hover class
        connectionGroup.classed("connection-hover", false);

        // Delay the visual reset to prevent flickering
        if (!isSelected && !connectionPath.empty()) {
          hoverTimeoutRef.current = setTimeout(() => {
            if (!connectionGroup.classed("connection-hover")) {
              connectionPath
                .interrupt() // Stop any ongoing transitions
                .attr("stroke", "white")
                .attr("stroke-width", 2)
                .attr("marker-end", getConnectionMarker(d, "default"));
              // Keep hitbox at fixed width for consistent hover area
            }
          }, 50); // Small delay to prevent flicker on quick mouse movements
        }
      });

    // Add visible connection path (no interaction events, use hitbox instead)
    connectionEnter
      .append("path")
      .attr("class", "connection-path")
      .attr("fill", "none")
      .style("pointer-events", "none") // Disable events on visible path
      .each(function () {
        // Connection animation removed - simplified approach
      });

    // Add connection labels (only in architecture mode for multiple connections)
    connectionEnter
      .append("text")
      .attr("class", "connection-label")
      .attr("font-size", 10)
      .attr("font-weight", "bold")
      .attr("fill", "#555")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("pointer-events", "none")
      .style("display", "none"); // Initially hidden

    const connectionUpdate = connectionEnter.merge(connectionPaths as any);

  // Guardrail on update as well to ensure only hitbox captures events
  connectionUpdate.style("pointer-events", "none");

    // Update hitbox path (invisible but wide for better hover detection)
    connectionUpdate
      .select(".connection-hitbox")
      .attr("d", (d: any) => {
        const path = getConnectionPath(d);
        return createFilledPolygonFromPath(path, 8);
      })
      .attr("fill", "rgba(0, 0, 0, 0.01)")
      .attr("stroke", "none")
      .style("pointer-events", "all")
      .style("cursor", "pointer")
      // Let hitbox scale with zoom to match visible path width exactly
      .style("display", (d: any) => {
        // Hide hitbox for secondary connections in all modes (single visible path per A->B)
        const groupInfo = getConnectionGroupInfo(d.id, connections);
        if (groupInfo.isMultiple && groupInfo.index > 0) {
          return "none";
        }
        return "block";
      });

    // Update visible path with enhanced features
    connectionUpdate
      .select(".connection-path")
      .attr("d", (d: any) => getConnectionPath(d))
      .attr("stroke", "white") // Default stroke - CSS will override for selection/hover
      .attr("stroke-width", 2) // Default width - CSS will override for selection/hover
      .attr("marker-end", (d: any) => getConnectionMarker(d, "default")) // Dynamic marker based on direction
  // Ensure only the hitbox receives pointer events
  .style("pointer-events", "none")
      .style("display", (d: any) => {
        // Hide secondary connections (show only primary) in all modes
        const groupInfo = getConnectionGroupInfo(d.id, connections);
        if (groupInfo.isMultiple && groupInfo.index > 0) {
          return "none";
        }
        return "block";
      })
      .each(function () {
        // Production effects removed - using CSS-based styling
      })
      .attr("class", (d: any) => {
        const groupInfo = getConnectionGroupInfo(d.id, connections);
        let classes = "connection-path";

        if (groupInfo.isMultiple) {
          classes += " multiple-connection";
          if (groupInfo.index === 1) classes += " secondary";
          if (groupInfo.index === 2) classes += " tertiary";
        }

        return classes;
      });

    // Update connection labels
    connectionUpdate
      .select(".connection-label")
      .style("display", (d: any) => {
        // Show labels only in architecture mode for multiple connections
        if (workflowContextState.designerMode !== "architecture") return "none";

        const groupInfo = getConnectionGroupInfo(d.id, connections);
        // Only show count badge for the first connection in the group
        return groupInfo.isMultiple && groupInfo.index === 0 ? "block" : "none";
      })
      .attr("x", (d: any) => {
        // Position label at midpoint of connection
        const sourceNode = nodeMap.get(d.sourceNodeId);
        const targetNode = nodeMap.get(d.targetNodeId);
        if (!sourceNode || !targetNode) return 0;

        return (sourceNode.x + targetNode.x) / 2;
      })
      .attr("y", (d: any) => {
        // Position label at midpoint of connection
        const sourceNode = nodeMap.get(d.sourceNodeId);
        const targetNode = nodeMap.get(d.targetNodeId);
        if (!sourceNode || !targetNode) return 0;

        // Position label close to the connection line (minimal offset)
        const yOffset = -8; // Small offset above the connection line

        return (sourceNode.y + targetNode.y) / 2 + yOffset;
      })
      .text((d: any) => {
        // Generate descriptive labels for different connection types
        const sourceNode = nodeMap.get(d.sourceNodeId);
        const targetNode = nodeMap.get(d.targetNodeId);
        const groupInfo = getConnectionGroupInfo(d.id, connections);

        if (!sourceNode || !targetNode || !groupInfo.isMultiple) return "";

        // For architecture mode, show connection count badge
        if (workflowContextState.designerMode === "architecture") {
          return `${groupInfo.total} connections`;
        }

        // Generate meaningful labels based on port types and node types
        const sourcePort = sourceNode.outputs?.find(
          (p) => p.id === d.sourcePortId
        );
        const targetPort = targetNode.inputs?.find(
          (p) => p.id === d.targetPortId
        );

        if (sourcePort && targetPort) {
          // Use port labels if available
          if (sourcePort.label && targetPort.label) {
            return `${sourcePort.label} → ${targetPort.label}`;
          }
        }

        // Fallback to endpoint numbering
        return `Endpoint ${groupInfo.index + 1}`;
      });

    // Render connection preview
    if (isConnecting && connectionStart) {
      console.log("🎯 Connection preview check:", {
        isConnecting,
        connectionStart,
        connectionPreview,
      });
      const sourceNode = nodes.find((n) => n.id === connectionStart.nodeId);
      if (sourceNode && connectionPreview) {
        console.log(
          "🎯 Rendering connection preview from:",
          sourceNode.id,
          "to:",
          connectionPreview
        );
        // Compute hover target box if mouse is over a node group
        const hoveredNode = nodes.find((n) => {
          const dims = getShapeAwareDimensions(n as any)
          const w = (dims.width || 200)
          const h = (dims.height || 80)
          const left = n.x - w / 2
          const top = n.y - h / 2
          return (
            connectionPreview.x >= left &&
            connectionPreview.x <= left + w &&
            connectionPreview.y >= top &&
            connectionPreview.y <= top + h
          )
        })
        const hoverTargetBox = hoveredNode
          ? (() => {
              const dims = getShapeAwareDimensions(hoveredNode as any)
              const w = (dims.width || 200)
              const h = (dims.height || 80)
              return { x: hoveredNode.x - w / 2, y: hoveredNode.y - h / 2, width: w, height: h }
            })()
          : undefined

        const previewPath = calculateConnectionPreviewPath(
          sourceNode,
          connectionStart.portId,
          connectionPreview,
          nodeVariant,
          undefined,
          workflowContextState.designerMode || "workflow",
          hoverTargetBox
        );

        // Determine preview marker based on source port type and direction
        const isSourceBottomPort = sourceNode.bottomPorts?.some(
          (p) => p.id === connectionStart.portId
        );
        const isLeftToRight = connectionPreview.x > sourceNode.x;
        let previewMarker = "url(#arrowhead)";

        if (isSourceBottomPort && !isLeftToRight) {
          previewMarker = "url(#arrowhead-left)";
        }

        g.append("path")
          .attr("class", "connection-preview")
          .attr("d", previewPath)
          .attr("stroke", "#2196F3")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5")
          .attr("fill", "none")
          .attr("marker-end", previewMarker)
          .attr("pointer-events", "none")
          .style("opacity", 0.7);
      } else {
        console.log("🎯 Not rendering preview:", {
          sourceNode: !!sourceNode,
          connectionPreview: !!connectionPreview,
        });
      }
    }

    // Render nodes
    const nodeSelection = mainNodeLayer
      .selectAll(".node")
      .data(nodes, (d: any) => d.id);

    nodeSelection
      .exit()
      .each(function (d: any) {
        // Clean up from our centralized management
        allNodeElementsRef.current.delete(d.id);
      })
      .remove();

    const nodeEnter = nodeSelection
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("data-node-id", (d: any) => d.id)
      .attr("transform", (d: any) => `translate(${d.x}, ${d.y})`)
      .style("cursor", "move")
      .each(function (d: any) {
        // Register node element in our centralized management
        allNodeElementsRef.current.set(d.id, this);

        // Essential: Preserve dragging state for newly created elements
        if (isDragging && draggedNodeId === d.id) {
          const nodeElement = d3.select(this);
          nodeElement.classed("dragging", true);
          // Update draggedElementRef to point to the new element
          draggedElementRef.current = nodeElement;
        }
      })
      .call(
        d3
          .drag<any, WorkflowNode>()
          .container(g.node() as any)
          .clickDistance(5) // Increase click distance for better click detection
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded) as any
      );

    const nodeGroups = nodeEnter.merge(nodeSelection as any);

    // Enhanced: Immediately preserve dragging state after merge operation
    // This must happen before any other node operations to prevent class removal
    nodeGroups.each(function (d: any) {
      const nodeElement = d3.select(this);
      const currentDraggedNodeId = getDraggedNodeId();
      const isCurrentlyDragging = isContextDragging();

      if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
        // Force apply dragging class immediately after merge
        nodeElement.classed("dragging", true);
        // Ensure draggedElementRef points to the correct merged element
        if (
          draggedElementRef.current === null ||
          draggedElementRef.current.node() !== this
        ) {
          draggedElementRef.current = nodeElement;
        }
      }
    });

    // REMOVED: JavaScript hover events for port visibility
    // CSS now handles all port visibility states via classes:
    // - .canvas-container.architecture-mode .port-group (hidden by default)
    // - .canvas-container.architecture-mode .node:hover .port-group (visible on hover)
    // - .canvas-container .workflow-canvas.connecting .port-group (visible when connecting)
    // This prevents inline style conflicts with CSS classes

    // Update positions for non-dragging nodes
    nodeGroups
      .filter(function () {
        return !d3.select(this).classed("dragging");
      })
      .attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);

    // Node background (shape-aware)
    nodeEnter
      .append("path")
      .attr("class", "node-background")
      .on("click", (event: any, d: WorkflowNode) => {
        // Fallback click handler for node background
        if (!isDragging) {
          event.stopPropagation();
          const ctrlKey = event.ctrlKey || event.metaKey;
          onNodeClick(d, ctrlKey);
        }
      })
      .on("dblclick", (event: any, d: WorkflowNode) => {
        event.stopPropagation();
        event.preventDefault();
        onNodeDoubleClick(d);
      })
      .on("dragover", (event: any, d: WorkflowNode) => {
        // Allow drop if connecting and can drop on this node
        if (isConnecting && canDropOnNode?.(d.id)) {
          event.preventDefault();
          event.stopPropagation();
          // Use unified drop feedback
          const nodeElement = d3.select(event.currentTarget.parentNode);
          setDropFeedback(nodeElement, true);
        }
      })
      .on("dragleave", (event: any) => {
        // Remove visual feedback using unified function
        const nodeElement = d3.select(event.currentTarget.parentNode);
        setDropFeedback(nodeElement, false);
      })
      .on("drop", (event: any, d: WorkflowNode) => {
        event.preventDefault();
        event.stopPropagation();

        // Remove visual feedback using unified function
        const nodeElement = d3.select(event.currentTarget.parentNode);
        setDropFeedback(nodeElement, false);

        // Handle connection drop on node
        if (isConnecting && canDropOnNode?.(d.id)) {
          // Smart port selection based on designer mode
          let availableInputPorts: NodePort[] = [];

          if (workflowContextState.designerMode === "architecture") {
            // In architecture mode, allow connections to any input port (including already connected ones)
            // Only prevent exact duplicate connections
            availableInputPorts =
              d.inputs?.filter((port: NodePort) => {
                // Check if this exact connection already exists
                return !connections.some(
                  (conn: Connection) =>
                    conn.sourceNodeId === connectionStart?.nodeId &&
                    conn.sourcePortId === connectionStart?.portId &&
                    conn.targetNodeId === d.id &&
                    conn.targetPortId === port.id
                );
              }) || [];
          } else {
            // In workflow mode, use original logic (only unconnected ports)
            availableInputPorts =
              d.inputs?.filter((port: NodePort) => {
                return !connections.some(
                  (conn: Connection) =>
                    conn.targetNodeId === d.id && conn.targetPortId === port.id
                );
              }) || [];
          }

          if (availableInputPorts.length > 0) {
            // Strategy: prefer first available port, but could be enhanced with type matching
            const targetPort = availableInputPorts[0];
            console.log(
              `📍 Node background drop (${workflowContextState.designerMode} mode) - connecting to port:`,
              d.id,
              targetPort.id
            );
            onPortDragEnd(d.id, targetPort.id);
          } else {
            // No available input ports
            console.log(
              `⚠️ Node background drop (${workflowContextState.designerMode} mode) - no available input ports on:`,
              d.id
            );
            onPortDragEnd();
          }
        }
      });

    // Update node background attributes (shape-aware)
    nodeGroups
      .select(".node-background")
      .attr("d", (d: any) => {
        const shape = getNodeShape(d.type);
        let borderRadius:
          | number
          | {
              topLeft?: number;
              topRight?: number;
              bottomLeft?: number;
              bottomRight?: number;
            } = 0;

        // Custom border radius for different node types
        if (d.type === "start") {
          // Asymmetric border radius for start node: left 30%, right default
          const dimensions = getShapeAwareDimensions(d);
          const leftRadius =
            Math.min(dimensions.width, dimensions.height) * 0.3;
          const rightRadius = 8; // default radius
          borderRadius = {
            topLeft: leftRadius,
            bottomLeft: leftRadius,
            topRight: rightRadius,
            bottomRight: rightRadius,
          };
        } else if (shape === "rectangle" || shape === "square") {
          borderRadius = 8;
        }

        const shapePath = getNodeShapePath(d, borderRadius);
        return shapePath.d;
      })
      .attr("fill", "#ffffff")
      .attr("stroke", (d: any) => {
        // CRITICAL: Skip stroke color update for actively dragged node to preserve blue border
        const currentDraggedNodeId = getDraggedNodeId();
        const isCurrentlyDragging = isContextDragging();

        if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
          // Return blue color for dragged node
          return "#2196F3";
        }

        return getNodeColor(d.type, d.status);
      })
      .attr("stroke-width", (d: any) => {
        // CRITICAL: Skip stroke width update for actively dragged node
        const currentDraggedNodeId = getDraggedNodeId();
        const isCurrentlyDragging = isContextDragging();

        if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
          // Return thicker width for dragged node
          return 3;
        }

        return 2;
      });

    // Apply visual styling to all nodes using centralized system with improved stability
    nodeGroups.each(function (d: any) {
      const nodeElement = d3.select(this);
      const isSelected = isNodeSelected(d.id);

      // Legacy endpoint class assignment removed - no longer needed

      // Enhanced dragging state detection with context-based state using fresh values
      let isNodeDragging = false;
      const currentDraggedNodeId = getDraggedNodeId();
      const isCurrentlyDragging = isContextDragging();

      // Check current DOM state first to preserve existing dragging class
      const hasExistingDraggingClass = nodeElement.classed("dragging");

      // Only process drag state if we have valid context state
      if (
        currentDraggedNodeId &&
        isCurrentlyDragging &&
        currentDraggedNodeId === d.id
      ) {
        // Force apply dragging class for the dragged node - no stale checks during active drag
        if (!hasExistingDraggingClass) {
          nodeElement.classed("dragging", true);
        }
        isNodeDragging = true;

        // Ensure we maintain the correct draggedElementRef reference
        const currentDraggedElement = draggedElementRef.current;
        if (!currentDraggedElement || currentDraggedElement.node() !== this) {
          draggedElementRef.current = nodeElement;
        }
      } else if (
        isCurrentlyDragging &&
        currentDraggedNodeId &&
        currentDraggedNodeId !== d.id
      ) {
        // For other nodes during drag, ensure dragging class is removed
        if (hasExistingDraggingClass) {
          nodeElement.classed("dragging", false);
        }
      } else if (!isCurrentlyDragging) {
        // Only clean up when not dragging at all
        if (hasExistingDraggingClass) {
          nodeElement.classed("dragging", false);
        }
      } else {
        // Preserve existing dragging state if conditions are unclear
        isNodeDragging = hasExistingDraggingClass;
      }

      // Fallback cleanup: Force remove dragging class if context says we're not dragging
      if (!isCurrentlyDragging && hasExistingDraggingClass) {
        nodeElement.classed("dragging", false);
        isNodeDragging = false;
      }

      const nodeBackground = nodeElement.select(".node-background");

      // Apply CSS classes
      nodeElement.classed("selected", isSelected);

      // Apply visual styling with consistent blue border for selected/dragging states
      let opacity = 1;
      let filter = "none";
      let strokeColor = getNodeColor(d.type, d.status);
      let strokeWidth = 2;

      // Priority: Selected OR Dragging should use blue border
      if (isSelected || isNodeDragging) {
        strokeColor = "#2196F3"; // Always use blue for selected or dragging
        strokeWidth = 3;

        if (isNodeDragging) {
          opacity = 0.9;
          filter = "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))";
        } else if (isSelected) {
          filter = "drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))";
        }
      }

      nodeElement.style("opacity", opacity).style("filter", filter);

      nodeBackground
        .attr("stroke", strokeColor)
        .attr("stroke-width", strokeWidth);
    });

    // Mark as initialized and organize z-index
    if (!isInitialized) {
      setIsInitialized(true);
      // Initial z-index organization - use immediate execution for initial setup
      setTimeout(() => {
        if (!isDragging) {
          organizeNodeZIndex(true); // Immediate execution for initialization
        }
      }, 0);
    }

    // Node icon
    nodeEnter
      .append("text")
      .attr("class", "node-icon")
      .style("pointer-events", "none");

    nodeGroups
      .select(".node-icon")
      .attr("x", (d: any) => {
        const dimensions = getConfigurableDimensions(d);
        return dimensions.iconOffset?.x || 0;
      })
      .attr("y", (d: any) => {
        const dimensions = getConfigurableDimensions(d);
        return dimensions.iconOffset?.y || -8;
      })
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr(
        "font-size",
        (d: any) => getConfigurableDimensions(d).iconSize || 18
      )
      .attr("fill", "#8d8d8d")
      .text((d: any) => getNodeIcon(d.type));

    // Node label
    nodeEnter
      .append("text")
      .attr("class", "node-label")
      .style("pointer-events", "none");

    // Legacy badge removed - it was visual clutter without adding meaningful value

    nodeGroups
      .select(".node-label")
      .attr("x", (d: any) => {
        const dimensions = getConfigurableDimensions(d);
        return dimensions.labelOffset?.x || 0;
      })
      .attr("y", (d: any) => {
        const dimensions = getConfigurableDimensions(d);
        return dimensions.labelOffset?.y || 15;
      })
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr(
        "font-size",
        (d: any) => (getConfigurableDimensions(d).fontSize || 12) - 1
      )
      .attr("font-weight", "bold")
      .attr("fill", "#333")
      .text((d: any) => {
        // Use the proper label from NodeTypes based on type, fallback to d.label
        const nodeTypeInfo = NodeTypes[d.type as keyof typeof NodeTypes];
        return nodeTypeInfo?.label || d.label || d.type;
      });

    // Legacy badge update removed - badge has been completely removed

    // Render simple ports for both variants
    // Input ports - DISABLED drag/click interactions for connection creation
    const inputPortGroups = nodeGroups
      .selectAll(".input-port-group")
      .data((d: any) =>
        d.inputs.map((input: any) => ({ ...input, nodeId: d.id, nodeData: d }))
      )
      .join("g")
      .attr("class", (d: any) => {
        // Check if this port has any connections
        const hasConnection = connections.some(
          (conn) => conn.targetNodeId === d.nodeId && conn.targetPortId === d.id
        );

        // Add architecture mode specific classes
        const baseClass = hasConnection
          ? "port-group input-port-group connected"
          : "port-group input-port-group";
        const highlightClass = getPortHighlightClass(d.nodeId, d.id, "input");

        return `${baseClass} ${highlightClass}`.trim();
      })
      // In architecture mode: enable dragging from input ports (treat as omni-directional)
      .style("cursor", () =>
        workflowContextState.designerMode === "architecture"
          ? "crosshair"
          : "default"
      )
      .style("pointer-events", () =>
        workflowContextState.designerMode === "architecture" ? "all" : "none"
      )
      .call((sel: any) => {
        if (workflowContextState.designerMode !== "architecture") return;
        sel.call(
          d3
            .drag<any, any>()
            .on("start", (event: any, d: any) => {
              event.sourceEvent.stopPropagation();
              event.sourceEvent.preventDefault();
              // Start connection as if from an output to allow omni-directional drag
              dragConnectionDataRef.current = {
                nodeId: d.nodeId,
                portId: d.id,
                type: "output",
              };
              onPortDragStart(d.nodeId, d.id, "output");
            })
            .on("drag", (event: any) => {
              const [x, y] = d3.pointer(
                event.sourceEvent,
                event.sourceEvent.target.ownerSVGElement
              );
              const transform = d3.zoomTransform(
                event.sourceEvent.target.ownerSVGElement
              );
              const [canvasX, canvasY] = transform.invert([x, y]);
              onPortDrag(canvasX, canvasY);
            })
            .on("end", (event: any) => {
              // End hit-testing: include input, output, bottom, and side ports
              const svgElement = event.sourceEvent.target.ownerSVGElement;
              const svgSelection = d3.select(svgElement);
              const currentTransform = d3.zoomTransform(svgElement);
              const [screenX, screenY] = d3.pointer(
                event.sourceEvent,
                svgElement
              );
              const [canvasX, canvasY] = currentTransform.invert([
                screenX,
                screenY,
              ]);
              let targetNodeId: string | undefined;
              let targetPortId: string | undefined;
              const allInputPorts =
                svgSelection.selectAll(".input-port-circle");
              const allOutputPorts = svgSelection.selectAll(
                ".output-port-circle"
              );
              const allBottomPorts = svgSelection.selectAll(
                ".bottom-port-diamond"
              );
              const allSidePorts = svgSelection.selectAll(".side-port-rect");
              let minDistance = Infinity;

              // Input circles
              allInputPorts.each(function (portData: any) {
                const circle = d3.select(this);
                const element = this as SVGElement;
                const portGroup = d3.select(element.parentNode as SVGElement);
                const nodeGroup = d3.select(
                  portGroup.node()?.closest("g[data-node-id]") as SVGElement
                );
                if (nodeGroup.empty()) return;
                const nodeId = nodeGroup.attr("data-node-id");
                const transform = nodeGroup.attr("transform");
                let nodeSvgX = 0,
                  nodeSvgY = 0;
                if (transform) {
                  const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                  if (match) {
                    nodeSvgX = parseFloat(match[1]);
                    nodeSvgY = parseFloat(match[2]);
                  }
                }
                const cx = parseFloat(circle.attr("cx") || "0");
                const cy = parseFloat(circle.attr("cy") || "0");
                const r = parseFloat(circle.attr("r") || "8");
                const portCanvasX = nodeSvgX + cx;
                const portCanvasY = nodeSvgY + cy;
                const distance = Math.sqrt(
                  (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
                );
                const tolerance = r + 5;
                if (distance <= tolerance && distance < minDistance) {
                  minDistance = distance;
                  targetNodeId = nodeId;
                  targetPortId = portData.id;
                }
              });

              // Output circles
              allOutputPorts.each(function (portData: any) {
                const circle = d3.select(this);
                const element = this as SVGElement;
                const portGroup = d3.select(element.parentNode as SVGElement);
                const nodeGroup = d3.select(
                  portGroup.node()?.closest("g[data-node-id]") as SVGElement
                );
                if (nodeGroup.empty()) return;
                const nodeId = nodeGroup.attr("data-node-id");
                const transform = nodeGroup.attr("transform");
                let nodeSvgX = 0,
                  nodeSvgY = 0;
                if (transform) {
                  const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                  if (match) {
                    nodeSvgX = parseFloat(match[1]);
                    nodeSvgY = parseFloat(match[2]);
                  }
                }
                const cx = parseFloat(circle.attr("cx") || "0");
                const cy = parseFloat(circle.attr("cy") || "0");
                const r = parseFloat(circle.attr("r") || "8");
                const portCanvasX = nodeSvgX + cx;
                const portCanvasY = nodeSvgY + cy;
                const distance = Math.sqrt(
                  (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
                );
                const tolerance = r + 5;
                if (distance <= tolerance && distance < minDistance) {
                  minDistance = distance;
                  targetNodeId = nodeId;
                  targetPortId = portData.id;
                }
              });

              // Bottom diamonds
              allBottomPorts.each(function (portData: any) {
                const diamond = d3.select(this);
                const element = this as SVGElement;
                const portGroup = d3.select(element.parentNode as SVGElement);
                const nodeGroup = d3.select(
                  portGroup.node()?.closest("g[data-node-id]") as SVGElement
                );
                if (nodeGroup.empty()) return;
                const nodeId = nodeGroup.attr("data-node-id");
                const nodeTransform = nodeGroup.attr("transform");
                let nodeSvgX = 0,
                  nodeSvgY = 0;
                if (nodeTransform) {
                  const match = /translate\(([^,]+),([^)]+)\)/.exec(
                    nodeTransform
                  );
                  if (match) {
                    nodeSvgX = parseFloat(match[1]);
                    nodeSvgY = parseFloat(match[2]);
                  }
                }
                const diamondTransform = diamond.attr("transform");
                let diamondX = 0,
                  diamondY = 0;
                if (diamondTransform) {
                  const match = /translate\(([^,]+),([^)]+)\)/.exec(
                    diamondTransform
                  );
                  if (match) {
                    diamondX = parseFloat(match[1]);
                    diamondY = parseFloat(match[2]);
                  }
                }
                const portCanvasX = nodeSvgX + diamondX;
                const portCanvasY = nodeSvgY + diamondY;
                const distance = Math.sqrt(
                  (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
                );
                const diamondSize =
                  getConfigurableDimensions(portData.nodeData).portRadius || 6;
                const tolerance = diamondSize + 5;
                if (distance <= tolerance && distance < minDistance) {
                  minDistance = distance;
                  targetNodeId = nodeId;
                  targetPortId = portData.id;
                }
              });

              // Side rectangles
              allSidePorts.each(function (portData: any) {
                const rect = d3.select(this);
                const element = this as SVGElement;
                const portGroup = d3.select(element.parentNode as SVGElement);
                const nodeGroup = d3.select(
                  portGroup.node()?.closest("g[data-node-id]") as SVGElement
                );
                if (nodeGroup.empty()) return;
                const nodeId = nodeGroup.attr("data-node-id");
                const transform = nodeGroup.attr("transform");
                let nodeSvgX = 0,
                  nodeSvgY = 0;
                if (transform) {
                  const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                  if (match) {
                    nodeSvgX = parseFloat(match[1]);
                    nodeSvgY = parseFloat(match[2]);
                  }
                }
                const x = parseFloat(rect.attr("x") || "0");
                const y = parseFloat(rect.attr("y") || "0");
                const w = parseFloat(rect.attr("width") || "10");
                const h = parseFloat(rect.attr("height") || "10");
                const portCanvasX = nodeSvgX + x + w / 2;
                const portCanvasY = nodeSvgY + y + h / 2;
                const size = Math.max(w, h);
                const distance = Math.sqrt(
                  (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
                );
                const tolerance = size / 2 + 5;
                if (distance <= tolerance && distance < minDistance) {
                  minDistance = distance;
                  targetNodeId = nodeId;
                  targetPortId = portData.id;
                }
              });

              onPortDragEnd(targetNodeId, targetPortId);
            })
        );
      });

    inputPortGroups.selectAll("circle").remove();
    inputPortGroups
      .append("circle")
      .attr("class", "port-circle input-port-circle")
      .attr("cx", (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, "input");
        return positions[i]?.x || 0;
      })
      .attr("cy", (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, "input");
        return positions[i]?.y || 0;
      })
      .attr(
        "r",
        (d: any) => getConfigurableDimensions(d.nodeData).portRadius || 6
      )
      .attr("fill", getPortColor("any"))
      .attr("stroke", "#333")
      .attr("stroke-width", 2)
      .style("pointer-events", "none"); // DISABLED: Input port circles cannot be interacted with

    //console.log('🔵 Created', inputPortGroups.selectAll('circle').size(), 'input port circles')

    // Port capacity indicators removed - they were cluttering the UI without adding value

    // Output ports
    const outputPortGroups = nodeGroups
      .selectAll(".output-port-group")
      .data((d: any) =>
        d.outputs.map((output: any) => ({
          ...output,
          nodeId: d.id,
          nodeData: d,
        }))
      )
      .join("g")
      .attr("class", (d: any) => {
        // Check if this port has any connections
        const hasConnection = connections.some(
          (conn) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        );
        return hasConnection
          ? "port-group output-port-group connected"
          : "port-group output-port-group";
      })
      .style("cursor", "crosshair")
      .style("pointer-events", "all")
      .on("click", (event: any, d: any) => {
        event.stopPropagation();
        onPortClick(d.nodeId, d.id, "output");
      })
      .call(
        d3
          .drag<any, any>()
          .on("start", (event: any, d: any) => {
            event.sourceEvent.stopPropagation();
            event.sourceEvent.preventDefault();
            console.log("🚀 Output port drag START:", d.nodeId, d.id);

            // CRITICAL: Capture drag connection data in ref for reliable access
            dragConnectionDataRef.current = {
              nodeId: d.nodeId,
              portId: d.id,
              type: "output",
            };
            console.log(
              "🔒 Stored drag connection data:",
              dragConnectionDataRef.current
            );

            onPortDragStart(d.nodeId, d.id, "output");
          })
          .on("drag", (event: any) => {
            const [x, y] = d3.pointer(
              event.sourceEvent,
              event.sourceEvent.target.ownerSVGElement
            );
            const transform = d3.zoomTransform(
              event.sourceEvent.target.ownerSVGElement
            );
            const [canvasX, canvasY] = transform.invert([x, y]);
            console.log("🚀 Output port DRAGGING to:", canvasX, canvasY);
            onPortDrag(canvasX, canvasY);
          })
          .on("end", (event: any) => {
            console.log("🚀 Output port drag END");

            // CRITICAL: Use stored drag connection data (independent of React state)
            const capturedConnectionStart = dragConnectionDataRef.current;
            console.log(
              "🔒 Using stored drag connection data:",
              capturedConnectionStart
            );
            console.log("🔒 Connection start comparison:", {
              storedData: dragConnectionDataRef.current,
              propData: connectionStart,
              isConnecting,
              hasStoredData: !!dragConnectionDataRef.current,
            });

            // Get correct SVG element and apply zoom transform
            const svgElement = event.sourceEvent.target.ownerSVGElement;
            const svgSelection = d3.select(svgElement);

            // Get current zoom transform to correct coordinates
            const currentTransform = d3.zoomTransform(svgElement);
            console.log("🔍 Current zoom transform:", {
              k: currentTransform.k,
              x: currentTransform.x,
              y: currentTransform.y,
            });

            // Get mouse position in screen coordinates first
            const [screenX, screenY] = d3.pointer(
              event.sourceEvent,
              svgElement
            );
            console.log("📍 Screen coordinates:", screenX, screenY);

            // Apply inverse transform to get canvas coordinates
            const [canvasX, canvasY] = currentTransform.invert([
              screenX,
              screenY,
            ]);
            console.log("🎯 Canvas coordinates:", canvasX, canvasY);

            let targetNodeId: string | undefined;
            let targetPortId: string | undefined;

            // Find target input port by checking input circles, bottom diamonds, and side rectangles
            const allInputPorts = svgSelection.selectAll(".input-port-circle");
            const allBottomPorts = svgSelection.selectAll(
              ".bottom-port-diamond"
            );
            const allSidePorts = svgSelection.selectAll(".side-port-rect");
            let minDistance = Infinity;

            console.log(
              "🔍 Found",
              allInputPorts.size(),
              "input ports and",
              allBottomPorts.size(),
              "bottom ports to check"
            );

            allInputPorts.each(function (portData: any) {
              const circle = d3.select(this);
              const element = this as SVGElement;

              // Get port position in SVG coordinates
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );

              if (nodeGroup.empty()) {
                console.log("⚠️ Could not find parent node group for port");
                return;
              }

              const nodeId = nodeGroup.attr("data-node-id");
              const transform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;

              if (transform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }

              const cx = parseFloat(circle.attr("cx") || "0");
              const cy = parseFloat(circle.attr("cy") || "0");
              const r = parseFloat(circle.attr("r") || "8");

              // Port position in SVG coordinates (this is already in canvas space)
              const portCanvasX = nodeSvgX + cx;
              const portCanvasY = nodeSvgY + cy;

              // Calculate distance directly in canvas coordinates
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              const tolerance = r + 5; // FIXED: Port circle radius + 5px only

              console.log("🎯 Checking port:", {
                nodeId,
                portId: portData.id,
                portCanvasPos: { x: portCanvasX, y: portCanvasY },
                mouseCanvasPos: { x: canvasX, y: canvasY },
                distance,
                tolerance,
                isWithinRange: distance <= tolerance,
              });

              // Use closest valid input port with tolerance
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
                console.log(
                  "🎯✅ Found best input port target:",
                  targetNodeId,
                  targetPortId,
                  "distance:",
                  distance
                );
              }
            });

            // Also check bottom ports (diamond shapes)
            allBottomPorts.each(function (portData: any) {
              const diamond = d3.select(this);
              const element = this as SVGElement;

              // Get port position in SVG coordinates
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );

              if (nodeGroup.empty()) {
                console.log(
                  "⚠️ Could not find parent node group for bottom port"
                );
                return;
              }

              const nodeId = nodeGroup.attr("data-node-id");
              const nodeTransform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;

              if (nodeTransform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(
                  nodeTransform
                );
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }

              // Get diamond position from its transform
              const diamondTransform = diamond.attr("transform");
              let diamondX = 0,
                diamondY = 0;

              if (diamondTransform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(
                  diamondTransform
                );
                if (match) {
                  diamondX = parseFloat(match[1]);
                  diamondY = parseFloat(match[2]);
                }
              }

              // Port position in SVG coordinates (this is already in canvas space)
              const portCanvasX = nodeSvgX + diamondX;
              const portCanvasY = nodeSvgY + diamondY;

              // Calculate distance directly in canvas coordinates
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              // FIXED: Use diamond size (port radius) + 5px for consistent behavior with input ports
              const diamondSize =
                getConfigurableDimensions(portData.nodeData).portRadius || 6;
              const tolerance = diamondSize + 5;

              console.log("🎯 Checking bottom port (diamond):", {
                nodeId,
                portId: portData.id,
                portCanvasPos: { x: portCanvasX, y: portCanvasY },
                mouseCanvasPos: { x: canvasX, y: canvasY },
                distance,
                tolerance,
                isWithinRange: distance <= tolerance,
              });

              // Use closest valid bottom port with tolerance
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
                console.log(
                  "🎯✅ Found best bottom port target:",
                  targetNodeId,
                  targetPortId,
                  "distance:",
                  distance
                );
              }
            });

            // Also check side ports (rectangles)
            allSidePorts.each(function (portData: any) {
              const rect = d3.select(this);
              const element = this as SVGElement;

              // Get port position in SVG coordinates
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );

              if (nodeGroup.empty()) {
                console.log(
                  "⚠️ Could not find parent node group for side port"
                );
                return;
              }

              const nodeId = nodeGroup.attr("data-node-id");
              const transform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;

              if (transform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }

              const x = parseFloat(rect.attr("x") || "0");
              const y = parseFloat(rect.attr("y") || "0");
              const w = parseFloat(rect.attr("width") || "10");
              const h = parseFloat(rect.attr("height") || "10");

              // Port position in SVG coordinates (already in canvas space)
              const portCanvasX = nodeSvgX + x + w / 2;
              const portCanvasY = nodeSvgY + y + h / 2;

              // Calculate distance directly in canvas coordinates
              const size = Math.max(w, h);
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              const tolerance = size / 2 + 5;

              console.log("🎯 Checking side port (rect):", {
                nodeId,
                portId: portData.id,
                portCanvasPos: { x: portCanvasX, y: portCanvasY },
                mouseCanvasPos: { x: canvasX, y: canvasY },
                distance,
                tolerance,
                isWithinRange: distance <= tolerance,
              });

              // Use closest valid side port with tolerance
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
                console.log(
                  "🎯✅ Found best side port target:",
                  targetNodeId,
                  targetPortId,
                  "distance:",
                  distance
                );
              }
            });

            // If no port target found, check for node background drop areas
            if (!targetNodeId) {
              console.log(
                "🎯 No port target found, checking node background areas"
              );

              // Find all nodes and check if mouse is within their boundaries
              const allNodes = svgSelection.selectAll("g[data-node-id]");
              let minNodeDistance = Infinity;

              console.log(
                "🎯 Found nodes for background check:",
                allNodes.size()
              );

              allNodes.each(function () {
                const nodeGroup = d3.select(this);
                const nodeId = nodeGroup.attr("data-node-id");

                console.log("🎯 Processing node for background drop:", nodeId);

                // Skip if this is the source node (can't connect to self)
                if (
                  capturedConnectionStart &&
                  nodeId === capturedConnectionStart.nodeId
                ) {
                  console.log("🎯 Skipping source node:", nodeId);
                  return;
                }

                // Check if we can drop on this node
                // Use captured connection start to avoid timing issues
                const canDrop =
                  capturedConnectionStart &&
                  capturedConnectionStart.nodeId !== nodeId &&
                  capturedConnectionStart.type === "output";
                console.log("🎯 canDropOnNode check (fixed):", {
                  nodeId,
                  sourceNodeId: capturedConnectionStart?.nodeId,
                  sourceType: capturedConnectionStart?.type,
                  canDrop,
                });
                if (!canDrop) {
                  return;
                }

                // Find the actual node data from the nodes array
                const nodeData = nodes.find((n) => n.id === nodeId);
                if (!nodeData) {
                  console.log("⚠️ Node data not found for:", nodeId);
                  return;
                }

                // Get node transform (position)
                const transform = nodeGroup.attr("transform");
                let nodeSvgX = 0,
                  nodeSvgY = 0;

                if (transform) {
                  const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                  if (match) {
                    nodeSvgX = parseFloat(match[1]);
                    nodeSvgY = parseFloat(match[2]);
                  }
                }

                // Get node dimensions and shape
                const nodeDimensions = getShapeAwareDimensions(nodeData);
                const nodeShape = getNodeShape(nodeData.type);

                console.log("🎯 Checking node background area:", {
                  nodeId,
                  nodePosition: { x: nodeSvgX, y: nodeSvgY },
                  mouseCanvas: { x: canvasX, y: canvasY },
                  dimensions: nodeDimensions,
                  shape: nodeShape,
                  canDropOnNode: canDropOnNode?.(nodeId),
                });

                // FIXED: Check actual node-background boundaries instead of circular tolerance
                const relativeX = canvasX - nodeSvgX;
                const relativeY = canvasY - nodeSvgY;

                // Check if mouse position is within actual node background boundaries
                let isWithinNodeBounds = false;

                if (nodeShape === "circle") {
                  // For circular nodes, check if within radius
                  const radius =
                    Math.min(nodeDimensions.width, nodeDimensions.height) / 2;
                  const distance = Math.sqrt(relativeX ** 2 + relativeY ** 2);
                  isWithinNodeBounds = distance <= radius;
                } else {
                  // For rectangular/square nodes, check if within bounds
                  const halfWidth = nodeDimensions.width / 2;
                  const halfHeight = nodeDimensions.height / 2;
                  isWithinNodeBounds =
                    relativeX >= -halfWidth &&
                    relativeX <= halfWidth &&
                    relativeY >= -halfHeight &&
                    relativeY <= halfHeight;
                }

                console.log("🎯 Node bounds check:", {
                  nodeId,
                  relativePosition: { x: relativeX, y: relativeY },
                  nodeDimensions,
                  nodeShape,
                  isWithinNodeBounds,
                });

                // Only consider this node if mouse is actually within its background
                if (isWithinNodeBounds) {
                  // Use distance from center for prioritization among valid targets
                  const distanceFromCenter = Math.sqrt(
                    relativeX ** 2 + relativeY ** 2
                  );
                  if (distanceFromCenter < minNodeDistance) {
                    minNodeDistance = distanceFromCenter;
                    targetNodeId = nodeId;
                    console.log(
                      "🎯✅ Found node background target:",
                      nodeId,
                      "distance from center:",
                      distanceFromCenter
                    );
                  }
                }
              });

              // If we found a node background target, use smart port selection
              if (targetNodeId) {
                console.log(
                  "🎯 Node background drop detected, finding best input port for:",
                  targetNodeId
                );

                // Find the target node data
                const targetNode = nodes.find((n) => n.id === targetNodeId);
                if (targetNode?.inputs?.length) {
                  // Smart port selection: find the best available input port
                  // Use stored connection data instead of potentially cleared React props
                  const availableInputPorts = targetNode.inputs.filter(
                    (port: any) => {
                      if (!capturedConnectionStart || !targetNodeId)
                        return true;

                      // Simulate canDropOnPort logic using stored connection data
                      console.log(
                        "🔍 Checking port availability with stored data:",
                        {
                          targetNodeId,
                          targetPortId: port.id,
                          storedConnectionStart: capturedConnectionStart,
                        }
                      );

                      // Basic validation: different node and correct direction (output -> input)
                      if (capturedConnectionStart.nodeId === targetNodeId)
                        return false;
                      if (capturedConnectionStart.type !== "output")
                        return false;

                      return true; // In architecture mode, allow multiple connections
                    }
                  );

                  if (availableInputPorts.length > 0) {
                    // Strategy: prefer first available port, could be enhanced with type matching
                    targetPortId = availableInputPorts[0].id;
                    console.log(
                      "🎯✅ Selected input port for node background drop:",
                      targetPortId
                    );
                  } else {
                    console.log(
                      "⚠️ No available input ports on target node:",
                      targetNodeId
                    );
                    targetNodeId = undefined; // Reset if no valid ports
                  }
                } else {
                  console.log(
                    "⚠️ Target node has no input ports:",
                    targetNodeId
                  );
                  targetNodeId = undefined; // Reset if no input ports
                }
              }
            }

            // If no specific target found, check if we should create a new node on canvas background
            if (
              !targetNodeId &&
              !targetPortId &&
              isConnecting &&
              connectionStart
            ) {
              console.log(
                "🎯 No target found, checking for canvas background drop"
              );

              // Check if mouse position is on empty canvas (not over any node)
              const isOverEmptyCanvas = true; // Since we already checked nodes and ports above

              if (isOverEmptyCanvas) {
                console.log(
                  "✅ Canvas background drop detected, creating new node at:",
                  canvasX,
                  canvasY
                );
                // Signal canvas background drop with special values
                onPortDragEnd("__CANVAS_DROP__", undefined, canvasX, canvasY);
                return;
              }
            }

            console.log("🏁 Final target result:", {
              targetNodeId,
              targetPortId,
              minDistance,
            });
            onPortDragEnd(targetNodeId, targetPortId);

            // CLEANUP: Clear stored drag connection data
            dragConnectionDataRef.current = null;
            console.log("🧹 Cleared drag connection data");
          })
      );

    // Create output port circles
    outputPortGroups.selectAll("circle").remove();
    outputPortGroups
      .append("circle")
      .attr("class", "port-circle output-port-circle")
      .attr("cx", (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, "output");
        return positions[i]?.x || 0;
      })
      .attr("cy", (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, "output");
        return positions[i]?.y || 0;
      })
      .attr(
        "r",
        (d: any) => getConfigurableDimensions(d.nodeData).portRadius || 6
      )
      .attr("fill", getPortColor("any"))
      .attr("stroke", "#8d8d8d")
      .attr("stroke-width", 2);

    //console.log('🔴 Created', outputPortGroups.selectAll('circle').size(), 'output port circles')

    // Output port capacity indicators removed - they were cluttering the UI without adding value

    // Architecture mode: four side ports (top/right/bottom/left) as virtual ports
    const isArchitectureMode =
      workflowContextState.designerMode === "architecture";
    const sidePortGroups = nodeGroups
      .selectAll(".side-port-group")
      .data((d: any) => {
        if (!isArchitectureMode) return [];
        const dim = getShapeAwareDimensions(d);
        const halfW = (dim.width || 200) / 2;
        const halfH = (dim.height || 80) / 2;
        // Define side ports with local positions (relative to node center)
        const sides = [
          { id: "__side-top", x: 0, y: -halfH, kind: "input" },
          { id: "__side-right", x: halfW, y: 0, kind: "output" },
          { id: "__side-bottom", x: 0, y: halfH, kind: "output" },
          { id: "__side-left", x: -halfW, y: 0, kind: "input" },
        ];
        return sides.map((s) => ({
          nodeId: d.id,
          nodeData: d,
          id: s.id,
          kind: s.kind,
          x: s.x,
          y: s.y,
        }));
      })
      .join("g")
      .attr("class", (d: any) => {
        // Treat side ports as omni-ports: highlight for both input/output multiplicity and connected state
        const isConnected = connections.some(
          (conn) =>
            (conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id) ||
            (conn.targetNodeId === d.nodeId && conn.targetPortId === d.id)
        );
        const inputHL = getPortHighlightClass(d.nodeId, d.id, "input");
        const outputHL = getPortHighlightClass(d.nodeId, d.id, "output");
        const classes = ["side-port-group", "port-group"];
        if (isConnected) classes.push("connected");
        if (inputHL) classes.push(inputHL);
        if (outputHL) classes.push(outputHL);
        return classes.join(" ");
      })
      .style("cursor", "crosshair")
      .style("pointer-events", "all")
      .on("click", (event: any, d: any) => {
        // Click-to-start like output ports
        event.stopPropagation();
        onPortClick(d.nodeId, d.id, "output");
      })
      .call(
        d3
          .drag<any, any>()
          .on("start", (event: any, d: any) => {
            // Architecture omni-ports: allow dragging from all sides; treat as output source
            event.sourceEvent.stopPropagation();
            event.sourceEvent.preventDefault();
            // Store drag start like output ports for downstream logic
            dragConnectionDataRef.current = {
              nodeId: d.nodeId,
              portId: d.id,
              type: "output",
            };
            onPortDragStart(d.nodeId, d.id, "output");
            const [x, y] = d3.pointer(
              event.sourceEvent,
              event.sourceEvent.target.ownerSVGElement
            );
            const transform = d3.zoomTransform(
              event.sourceEvent.target.ownerSVGElement
            );
            const [canvasX, canvasY] = transform.invert([x, y]);
            onPortDrag(canvasX, canvasY);
          })
          .on("drag", (event: any) => {
            const [x, y] = d3.pointer(
              event.sourceEvent,
              event.sourceEvent.target.ownerSVGElement
            );
            const transform = d3.zoomTransform(
              event.sourceEvent.target.ownerSVGElement
            );
            const [canvasX, canvasY] = transform.invert([x, y]);
            onPortDrag(canvasX, canvasY);
          })
          .on("end", (event: any) => {
            // Mirror output/bottom drag end behavior: compute nearest valid target and end
            const svgElement = event.sourceEvent.target.ownerSVGElement;
            const svgSelection = d3.select(svgElement);
            const currentTransform = d3.zoomTransform(svgElement);
            const [screenX, screenY] = d3.pointer(
              event.sourceEvent,
              svgElement
            );
            const [canvasX, canvasY] = currentTransform.invert([
              screenX,
              screenY,
            ]);
            let targetNodeId: string | undefined;
            let targetPortId: string | undefined;
            const allInputPorts = svgSelection.selectAll(".input-port-circle");
            const allBottomPorts = svgSelection.selectAll(
              ".bottom-port-diamond"
            );
            const allSidePorts = svgSelection.selectAll(".side-port-rect");
            let minDistance = Infinity;

            // Use stored drag start for background/can-drop logic
            const capturedConnectionStart = dragConnectionDataRef.current;

            // Input circles
            allInputPorts.each(function (portData: any) {
              const circle = d3.select(this);
              const element = this as SVGElement;
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );
              if (nodeGroup.empty()) return;
              const nodeId = nodeGroup.attr("data-node-id");
              const transform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;
              if (transform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }
              const cx = parseFloat(circle.attr("cx") || "0");
              const cy = parseFloat(circle.attr("cy") || "0");
              const r = parseFloat(circle.attr("r") || "8");
              const portCanvasX = nodeSvgX + cx;
              const portCanvasY = nodeSvgY + cy;
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              const tolerance = r + 5;
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
              }
            });

            // Bottom diamonds
            allBottomPorts.each(function (portData: any) {
              const diamond = d3.select(this);
              const element = this as SVGElement;
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );
              if (nodeGroup.empty()) return;
              const nodeId = nodeGroup.attr("data-node-id");
              const nodeTransform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;
              if (nodeTransform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(
                  nodeTransform
                );
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }
              const diamondTransform = diamond.attr("transform");
              let diamondX = 0,
                diamondY = 0;
              if (diamondTransform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(
                  diamondTransform
                );
                if (match) {
                  diamondX = parseFloat(match[1]);
                  diamondY = parseFloat(match[2]);
                }
              }
              const portCanvasX = nodeSvgX + diamondX;
              const portCanvasY = nodeSvgY + diamondY;
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              const diamondSize =
                getConfigurableDimensions(portData.nodeData).portRadius || 6;
              const tolerance = diamondSize + 5;
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
              }
            });

            // Output circles (omni-mode: allow connecting into outputs too, like input-port-group)
            const allOutputPorts = svgSelection.selectAll(
              ".output-port-circle"
            );
            allOutputPorts.each(function (this: any, portData: any) {
              const circle = d3.select(this);
              const element = this as SVGElement;
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );
              if (nodeGroup.empty()) return;
              const nodeId = nodeGroup.attr("data-node-id");
              const transform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;
              if (transform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }
              const cx = parseFloat(circle.attr("cx") || "0");
              const cy = parseFloat(circle.attr("cy") || "0");
              const r = parseFloat(circle.attr("r") || "8");
              const portCanvasX = nodeSvgX + cx;
              const portCanvasY = nodeSvgY + cy;
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              const tolerance = r + 5;
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
              }
            });

            // Side rectangles (top/left act as inputs)
            allSidePorts.each(function (portData: any) {
              const rect = d3.select(this);
              const element = this as SVGElement;
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );
              if (nodeGroup.empty()) return;
              const nodeId = nodeGroup.attr("data-node-id");
              const transform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;
              if (transform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }
              const x = parseFloat(rect.attr("x") || "0");
              const y = parseFloat(rect.attr("y") || "0");
              const w = parseFloat(rect.attr("width") || "10");
              const h = parseFloat(rect.attr("height") || "10");
              const portCanvasX = nodeSvgX + x + w / 2;
              const portCanvasY = nodeSvgY + y + h / 2;
              const size = Math.max(w, h);
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              const tolerance = size / 2 + 5;
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
              }
            });

            // Node background fallback (like output/input behavior)
            if (!targetNodeId) {
              const allNodes = svgSelection.selectAll("g[data-node-id]");
              let minNodeDistance = Infinity;
              allNodes.each(function () {
                const nodeGroup = d3.select(this);
                const nodeId = nodeGroup.attr("data-node-id");
                if (
                  capturedConnectionStart &&
                  nodeId === capturedConnectionStart.nodeId
                )
                  return;
                const nodeData = nodes.find((n) => n.id === nodeId);
                if (!nodeData) return;
                const transform = nodeGroup.attr("transform");
                let nodeSvgX = 0,
                  nodeSvgY = 0;
                if (transform) {
                  const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                  if (match) {
                    nodeSvgX = parseFloat(match[1]);
                    nodeSvgY = parseFloat(match[2]);
                  }
                }
                const dims = getShapeAwareDimensions(nodeData);
                const shape = getNodeShape(nodeData.type);
                const relX = canvasX - nodeSvgX;
                const relY = canvasY - nodeSvgY;
                let within = false;
                if (shape === "circle") {
                  const radius = Math.min(dims.width, dims.height) / 2;
                  within = Math.sqrt(relX ** 2 + relY ** 2) <= radius;
                } else {
                  within =
                    Math.abs(relX) <= dims.width / 2 &&
                    Math.abs(relY) <= dims.height / 2;
                }
                if (within) {
                  const dist = Math.sqrt(relX ** 2 + relY ** 2);
                  if (dist < minNodeDistance) {
                    minNodeDistance = dist;
                    targetNodeId = nodeId;
                  }
                }
              });

              if (targetNodeId) {
                const targetNode = nodes.find((n) => n.id === targetNodeId);
                if (targetNode?.inputs?.length) {
                  const availableInputPorts = targetNode.inputs;
                  if (availableInputPorts.length > 0) {
                    targetPortId = availableInputPorts[0].id;
                  } else {
                    targetNodeId = undefined;
                  }
                } else {
                  targetNodeId = undefined;
                }
              }
            }

            // Canvas background fallback
            if (
              !targetNodeId &&
              !targetPortId &&
              isConnecting &&
              connectionStart
            ) {
              onPortDragEnd("__CANVAS_DROP__", undefined, canvasX, canvasY);
              // cleanup stored drag data
              dragConnectionDataRef.current = null;
              return;
            }

            onPortDragEnd(targetNodeId, targetPortId);
            // cleanup stored drag data
            dragConnectionDataRef.current = null;
          })
      );

    // Draw side port rectangles
    sidePortGroups.selectAll("rect").remove();
    sidePortGroups
      .append("rect")
      .attr("class", "side-port-rect")
      .attr("x", (d: any) => d.x - 6)
      .attr("y", (d: any) => d.y - 6)
      .attr("width", 12)
      .attr("height", 12)
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("fill", (d: any) => {
        // Inputs (top/left) use one color, outputs (right/bottom) another
        return d.kind === "output" ? "#A8A9B4" : "#CCCCCC";
      })
      .attr("stroke", "#8d8d8d")
      .attr("stroke-width", 1.5)
      .style("pointer-events", "all"); // allow hit-testing so group drag handlers receive events

    // Bottom ports - สำหรับ AI Agent nodes ที่มี bottomPorts
    const bottomPortGroups = nodeGroups
      .filter((d: any) => d.bottomPorts && d.bottomPorts.length > 0)
      .selectAll(".bottom-port-group")
      .data((d: any) => {
        if (!d.bottomPorts) return [];

        // Return all bottom ports (both connected and unconnected) for the diamond shapes
        // The connector lines and plus buttons will be handled separately
        return d.bottomPorts.map((port: any) => ({
          ...port,
          nodeId: d.id,
          nodeData: d,
        }));
      })
      .join("g")
      .attr("class", "bottom-port-group")
      .style("cursor", "crosshair")
      .style("pointer-events", "all")
      // Add drag behavior for bottom port diamonds
      .call(
        d3
          .drag<any, any>()
          .on("start", (event: any, d: any) => {
            console.log("🚀 Bottom port diamond drag START:", d.nodeId, d.id);
            event.sourceEvent.stopPropagation();
            event.sourceEvent.preventDefault();
            // Start connection drag as if it's an output port
            onPortDragStart(d.nodeId, d.id, "output");

            const [x, y] = d3.pointer(
              event.sourceEvent,
              event.sourceEvent.target.ownerSVGElement
            );
            const transform = d3.zoomTransform(
              event.sourceEvent.target.ownerSVGElement
            );
            const [canvasX, canvasY] = transform.invert([x, y]);
            onPortDrag(canvasX, canvasY);
          })
          .on("drag", (event: any) => {
            const [x, y] = d3.pointer(
              event.sourceEvent,
              event.sourceEvent.target.ownerSVGElement
            );
            const transform = d3.zoomTransform(
              event.sourceEvent.target.ownerSVGElement
            );
            const [canvasX, canvasY] = transform.invert([x, y]);
            console.log(
              "🚀 Bottom port diamond DRAGGING to:",
              canvasX,
              canvasY
            );
            onPortDrag(canvasX, canvasY);
          })
          .on("end", (event: any) => {
            console.log("🚀 Bottom port diamond drag END");

            // Get correct SVG element and apply zoom transform
            const svgElement = event.sourceEvent.target.ownerSVGElement;
            const svgSelection = d3.select(svgElement);

            // Get current zoom transform to correct coordinates
            const currentTransform = d3.zoomTransform(svgElement);

            // Get mouse position in screen coordinates first
            const [screenX, screenY] = d3.pointer(
              event.sourceEvent,
              svgElement
            );

            // Apply inverse transform to get canvas coordinates
            const [canvasX, canvasY] = currentTransform.invert([
              screenX,
              screenY,
            ]);

            let targetNodeId: string | undefined;
            let targetPortId: string | undefined;

            // Find target input port by checking input circles, bottom diamonds, and side rectangles
            const allInputPorts = svgSelection.selectAll(".input-port-circle");
            const allBottomPorts = svgSelection.selectAll(
              ".bottom-port-diamond"
            );
            const allSidePorts = svgSelection.selectAll(".side-port-rect");
            let minDistance = Infinity;

            // Check input ports
            allInputPorts.each(function (portData: any) {
              const circle = d3.select(this);
              const element = this as SVGElement;

              // Get port position in SVG coordinates
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );

              if (nodeGroup.empty()) return;

              const nodeId = nodeGroup.attr("data-node-id");
              const transform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;

              if (transform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }

              const cx = parseFloat(circle.attr("cx") || "0");
              const cy = parseFloat(circle.attr("cy") || "0");
              const r = parseFloat(circle.attr("r") || "8");

              // Port position in SVG coordinates (this is already in canvas space)
              const portCanvasX = nodeSvgX + cx;
              const portCanvasY = nodeSvgY + cy;

              // Calculate distance directly in canvas coordinates
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              const tolerance = r + 5; // FIXED: Port circle radius + 5px only

              // Use closest valid input port with tolerance
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
              }
            });

            // Also check bottom ports (diamond shapes)
            allBottomPorts.each(function (portData: any) {
              const diamond = d3.select(this);
              const element = this as SVGElement;

              // Get port position in SVG coordinates
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );

              if (nodeGroup.empty()) return;

              const nodeId = nodeGroup.attr("data-node-id");
              const nodeTransform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;

              if (nodeTransform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(
                  nodeTransform
                );
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }

              // Get diamond position from its transform
              const diamondTransform = diamond.attr("transform");
              let diamondX = 0,
                diamondY = 0;

              if (diamondTransform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(
                  diamondTransform
                );
                if (match) {
                  diamondX = parseFloat(match[1]);
                  diamondY = parseFloat(match[2]);
                }
              }

              // Port position in SVG coordinates (this is already in canvas space)
              const portCanvasX = nodeSvgX + diamondX;
              const portCanvasY = nodeSvgY + diamondY;

              // Calculate distance directly in canvas coordinates
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              // FIXED: Use diamond size (port radius) + 5px for consistent behavior
              const diamondSize =
                getConfigurableDimensions(portData.nodeData).portRadius || 6;
              const tolerance = diamondSize + 5;

              // Use closest valid bottom port with tolerance
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
              }
            });

            // Also check side ports (rectangles)
            allSidePorts.each(function (portData: any) {
              const rect = d3.select(this);
              const element = this as SVGElement;
              const portGroup = d3.select(element.parentNode as SVGElement);
              const nodeGroup = d3.select(
                portGroup.node()?.closest("g[data-node-id]") as SVGElement
              );
              if (nodeGroup.empty()) {
                return;
              }
              const nodeId = nodeGroup.attr("data-node-id");
              const transform = nodeGroup.attr("transform");
              let nodeSvgX = 0,
                nodeSvgY = 0;
              if (transform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                if (match) {
                  nodeSvgX = parseFloat(match[1]);
                  nodeSvgY = parseFloat(match[2]);
                }
              }
              const x = parseFloat(rect.attr("x") || "0");
              const y = parseFloat(rect.attr("y") || "0");
              const w = parseFloat(rect.attr("width") || "10");
              const h = parseFloat(rect.attr("height") || "10");
              const portCanvasX = nodeSvgX + x + w / 2;
              const portCanvasY = nodeSvgY + y + h / 2;
              const size = Math.max(w, h);
              const distance = Math.sqrt(
                (canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2
              );
              const tolerance = size / 2 + 5;
              if (distance <= tolerance && distance < minDistance) {
                minDistance = distance;
                targetNodeId = nodeId;
                targetPortId = portData.id;
              }
            });

            console.log("🏁 Bottom port diamond drag final target:", {
              targetNodeId,
              targetPortId,
              minDistance,
            });
            onPortDragEnd(targetNodeId, targetPortId);
          })
      );

    // Create bottom port diamonds
    bottomPortGroups.selectAll("path").remove();
    bottomPortGroups
      .append("path")
      .attr("class", "bottom-port-diamond")
      .attr("d", (d: any) => {
        const size = getConfigurableDimensions(d.nodeData).portRadius || 6;
        // Create diamond shape: move to top, line to right, line to bottom, line to left, close
        return `M 0,${-size} L ${size},0 L 0,${size} L ${-size},0 Z`;
      })
      .attr("transform", (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex(
          (p: any) => p.id === d.id
        );
        const position = calculateBottomPortLayout(d.nodeData, portIndex);
        return `translate(${position.x}, ${position.y})`;
      })
      .attr("fill", (d: any) => {
        if (
          isConnecting &&
          connectionStart &&
          connectionStart.type === "output"
        ) {
          const canDrop = canDropOnPort(d.nodeId, d.id, "input");
          return canDrop ? "#4CAF50" : "#ff5722";
        }
        return "#A8A9B4"; // Beautiful pastel gray tone
      })
      .attr("stroke", "none"); // No border

    // Add connector lines from bottom ports (only for ports without connections OR when node is selected)
    bottomPortGroups.selectAll("line").remove();
    bottomPortGroups
      .append("line")
      .attr("class", "bottom-port-connector")
      .attr("x1", (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex(
          (p: any) => p.id === d.id
        );
        const position = calculateBottomPortLayout(d.nodeData, portIndex);
        return position.x;
      })
      .attr("y1", (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex(
          (p: any) => p.id === d.id
        );
        const position = calculateBottomPortLayout(d.nodeData, portIndex);
        return position.y;
      })
      .attr("x2", (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex(
          (p: any) => p.id === d.id
        );
        const position = calculateBottomPortLayout(d.nodeData, portIndex);
        return position.x;
      })
      .attr("y2", (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex(
          (p: any) => p.id === d.id
        );
        const position = calculateBottomPortLayout(d.nodeData, portIndex);
        // Check if this bottom port has a connection
        const hasConnection = connections.some(
          (conn) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        );
        const nodeIsSelected = isNodeSelected(d.nodeId);

        // Show line if:
        // 1. No connection (always show for unconnected ports), OR
        // 2. Node is selected AND port can accept additional connections
        let shouldShowLine = false;

        if (!hasConnection) {
          shouldShowLine = true; // Always show for unconnected ports
        } else if (nodeIsSelected) {
          // Only show for connected ports if they can accept more connections
          shouldShowLine = canBottomPortAcceptConnection(
            d.nodeId,
            d.id,
            connections,
            workflowContextState.designerMode
          );
        }

        // Return position.y + line length (or just position.y if no line)
        return shouldShowLine ? position.y + 28 : position.y;
      })
      .attr("stroke", (d: any) => {
        // Different colors for selected nodes based on connection capability
        const nodeIsSelected = isNodeSelected(d.nodeId);
        const hasConnection = connections.some(
          (conn) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        );

        if (nodeIsSelected && hasConnection) {
          const canAcceptMore = canBottomPortAcceptConnection(
            d.nodeId,
            d.id,
            connections,
            workflowContextState.designerMode
          );
          if (canAcceptMore) {
            return "#4CAF50"; // Green for ports that can accept more connections (like 'tool')
          }
        }
        return "#A8A9B4"; // Default pastel gray
      })
      .attr("stroke-width", (d: any) => {
        const nodeIsSelected = isNodeSelected(d.nodeId);
        const hasConnection = connections.some(
          (conn) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        );

        if (nodeIsSelected && hasConnection) {
          return 3; // Thicker line for selected nodes with connections
        }
        return 2; // Default thickness
      })
      .style("pointer-events", "none");

    // Add plus buttons and labels to bottom port groups (integrated approach)
    bottomPortGroups.each(function (d: any) {
      const group = d3.select(this);

      // Check if this bottom port already has a connection
      const hasConnection = connections.some(
        (conn) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
      );

      const nodeIsSelected = isNodeSelected(d.nodeId);

      // Determine if plus button should be shown
      let shouldShowButton = false;

      if (nodeIsSelected) {
        // When node is selected, show plus button only for ports that can accept additional connections
        shouldShowButton = canBottomPortAcceptConnection(
          d.nodeId,
          d.id,
          connections,
          workflowContextState.designerMode
        );
        if (process.env.NODE_ENV === "development") {
          console.log(
            `🔍 Port ${d.id} on selected node ${d.nodeId}: canAccept=${shouldShowButton}, hasConnection=${hasConnection}`
          );
        }
      } else {
        // When node is not selected, show only for unconnected ports (original behavior)
        shouldShowButton = !hasConnection;
      }

      // Remove existing plus button and label
      group.selectAll(".plus-button-container").remove();
      group.selectAll(".bottom-port-label-container").remove();

      // Add plus button if needed
      if (shouldShowButton) {
        const node = nodes.find((n) => n.id === d.nodeId);
        if (node) {
          const portIndex = d.nodeData.bottomPorts.findIndex(
            (p: any) => p.id === d.id
          );
          const position = calculateBottomPortLayout(d.nodeData, portIndex);
          const x = position.x;
          const y = position.y + 36; // Beyond the connector line

          const plusButtonContainer = group
            .append("g")
            .attr("class", "plus-button-container")
            .attr("transform", `translate(${x}, ${y})`)
            .style("cursor", "crosshair")
            .style("pointer-events", "all");

          const plusButton = plusButtonContainer
            .append("g")
            .attr("class", "plus-button")
            .style("cursor", "crosshair")
            .style("pointer-events", "all")
            .call(
              d3
                .drag<any, any>()
                .on("start", (event: any) => {
                  console.log("🚀 Plus button drag START:", d.nodeId, d.id);
                  event.sourceEvent.stopPropagation();
                  event.sourceEvent.preventDefault();

                  // Start connection from bottom port
                  onPortDragStart(d.nodeId, d.id, "output");
                })
                .on("drag", (event: any) => {
                  // Get canvas coordinates
                  const [x, y] = d3.pointer(
                    event.sourceEvent,
                    event.sourceEvent.target.ownerSVGElement
                  );
                  const transform = d3.zoomTransform(
                    event.sourceEvent.target.ownerSVGElement
                  );
                  const [canvasX, canvasY] = transform.invert([x, y]);

                  // Update connection preview
                  onPortDrag(canvasX, canvasY);
                })
                .on("end", (event: any) => {
                  console.log("🚀 Plus button drag END");

                  // Get canvas coordinates where drag ended
                  const [x, y] = d3.pointer(
                    event.sourceEvent,
                    event.sourceEvent.target.ownerSVGElement
                  );
                  const transform = d3.zoomTransform(
                    event.sourceEvent.target.ownerSVGElement
                  );
                  const [canvasX, canvasY] = transform.invert([x, y]);

                  console.log(
                    "🔍 Drag ended at canvas coordinates:",
                    canvasX,
                    canvasY
                  );

                  // Find target port using the existing WorkflowCanvas port detection
                  let targetNodeId: string | undefined;
                  let targetPortId: string | undefined;
                  let minDistance = 50; // 50px tolerance

                  // Check all nodes for input ports within range
                  nodes.forEach((node) => {
                    if (node.id === d.nodeId) return; // Don't connect to same node

                    // Check input ports
                    node.inputs.forEach((input, index) => {
                      const inputPortPositions = getPortPositions(
                        node,
                        "input"
                      );
                      const inputPortPosition = inputPortPositions[index];
                      if (!inputPortPosition) return;

                      const distance = Math.sqrt(
                        Math.pow(canvasX - inputPortPosition.x, 2) +
                          Math.pow(canvasY - inputPortPosition.y, 2)
                      );

                      if (distance < minDistance) {
                        minDistance = distance;
                        targetNodeId = node.id;
                        targetPortId = input.id;
                      }
                    });

                    // Check bottom ports (input capability)
                    if (node.bottomPorts) {
                      node.bottomPorts.forEach((bottomPort) => {
                        // Use calculatePortPosition for bottom ports as getPortPositions doesn't support 'bottom' type
                        const bottomPortPosition = calculatePortPosition(
                          node,
                          bottomPort.id,
                          "bottom",
                          nodeVariant
                        );
                        if (!bottomPortPosition) return;

                        const distance = Math.sqrt(
                          Math.pow(canvasX - bottomPortPosition.x, 2) +
                            Math.pow(canvasY - bottomPortPosition.y, 2)
                        );

                        if (distance < minDistance) {
                          minDistance = distance;
                          targetNodeId = node.id;
                          targetPortId = bottomPort.id;
                        }
                      });
                    }
                  });

                  console.log("🔍 Found target:", {
                    targetNodeId,
                    targetPortId,
                    distance: minDistance,
                  });

                  // End the drag with target information
                  onPortDragEnd(targetNodeId, targetPortId);
                })
            )
            .on("click", (event: any) => {
              // Fallback click handler for simple plus button clicks
              event.stopPropagation();
              onPlusButtonClick?.(d.nodeId, d.id);
            });
          // Removed mouseenter/mouseleave hover effects to prevent highlights during node interactions

          // Plus button background (square with rounded corners)
          plusButton
            .append("rect")
            .attr("class", "plus-button-bg")
            .attr("x", -8)
            .attr("y", -8)
            .attr("width", 16)
            .attr("height", 16)
            .attr("rx", 2)
            .attr("ry", 2)
            .attr("fill", () => {
              // Different colors based on port type and connection capability
              if (hasConnection) {
                // For connected ports that still allow more connections (like 'tool')
                return "#4CAF50"; // Green for ports that can accept multiple connections
              }
              return "#8A8B96"; // Gray for unconnected ports
            })
            .attr("stroke", () => {
              // Add border for connected ports to make them more visible
              if (hasConnection && nodeIsSelected) {
                return "#388E3C"; // Darker green border for multi-connection ports
              }
              return "none";
            })
            .attr("stroke-width", () => {
              if (hasConnection && nodeIsSelected) {
                return 1;
              }
              return 0;
            });

          // Plus symbol (horizontal line)
          plusButton
            .append("line")
            .attr("class", "plus-horizontal")
            .attr("x1", -4)
            .attr("y1", 0)
            .attr("x2", 4)
            .attr("y2", 0)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("stroke-linecap", "round");

          // Plus symbol (vertical line)
          plusButton
            .append("line")
            .attr("class", "plus-vertical")
            .attr("x1", 0)
            .attr("y1", -4)
            .attr("x2", 0)
            .attr("y2", 4)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("stroke-linecap", "round");
        }
      }

      // Add label for this bottom port
      const portIndex = d.nodeData.bottomPorts.findIndex(
        (p: any) => p.id === d.id
      );
      const position = calculateBottomPortLayout(d.nodeData, portIndex);
      const labelX = position.x;
      const labelY = position.y + 15; // Below the diamond

      const labelContainer = group
        .append("g")
        .attr("class", "bottom-port-label-container")
        .attr("transform", `translate(${labelX}, ${labelY})`);

      // Label background
      const labelText = d.label || d.id;
      const textWidth = labelText.length * 5.5; // Better estimation for 10px font
      const padding = 8;

      labelContainer
        .append("rect")
        .attr("class", "bottom-port-label-bg")
        .attr("x", -textWidth / 2 - padding / 2)
        .attr("y", -7)
        .attr("width", textWidth + padding)
        .attr("height", 12)
        .attr("fill", "#ffffff5b")
        .attr("stroke", "none"); // Prevent stroke inheritance from parent node

      // Label text
      labelContainer
        .append("text")
        .attr("class", "bottom-port-label")
        .attr("x", 0)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "8px")
        .attr("font-weight", "500")
        .attr("fill", "#2c3e50")
        .attr("stroke", "none") // Prevent stroke inheritance from parent node
        .attr("pointer-events", "none")
        .style("user-select", "none")
        .text(labelText);
    });

    // Canvas event handlers
    svg.on("click", () => {
      onCanvasClick();
    });

    svg.on("mousemove", (event) => {
      const [x, y] = d3.pointer(event, svg.node());
      const transform = d3.zoomTransform(svg.node() as any);
      const [canvasX, canvasY] = transform.invert([x, y]);
      onCanvasMouseMove(canvasX, canvasY);
    });

    // Enhanced cleanup function with dragging state management
    return () => {
      // Cancel any pending animations
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Clear any pending dragging state cleanup
      if (dragStateCleanupRef.current) {
        clearTimeout(dragStateCleanupRef.current);
        dragStateCleanupRef.current = null;
      }

      // Force remove all dragging classes before cleanup
      svg.selectAll(".node.dragging").classed("dragging", false);

      // Only reset dragging state if component is actually unmounting
      // Check if we're in middle of a drag operation - if so, preserve state
      const currentlyDragging = isContextDragging();
      if (!currentlyDragging) {
        // Reset all dragging state references only when not actively dragging
        endDragging();
      }

      draggedElementRef.current = null;
      draggedNodeElementRef.current = null;

      // Clear DOM and caches
      if (currentSvgRef) {
        d3.select(currentSvgRef).selectAll("*").remove();
      }
      connectionPathCache?.clear();
      gridCacheRef.current = null;
      allNodeElements?.clear();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, connections, nodeVariant, selectedNodes, selectedConnection]); // Minimal dependencies to prevent infinite re-renders - other deps cause infinite loops

  // 🎯 ISOLATED GRID EFFECT - Completely separate grid management with cache protection
  useEffect(() => {
    // Only recreate grid when absolutely necessary to maximize cache hits
    if (!svgRef.current || !isInitialized || !showGrid) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const gridLayer = svg.select(".grid-layer");

    if (gridLayer.empty()) {
      return;
    }

    // Get current canvas dimensions
    const rect = svgRef.current.getBoundingClientRect();

    // CRITICAL: Don't clear existing grid - let createGrid handle cache validation
    // This prevents unnecessary grid clearing that reduces cache hit rate
    const gridLayerElement = gridLayer.node();
    if (gridLayerElement) {
      const typedGridLayer = d3.select(gridLayerElement as SVGGElement);
      createGrid(typedGridLayer, canvasTransform, rect.width, rect.height);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showGrid,
    canvasTransform.x,
    canvasTransform.y,
    canvasTransform.k,
    isInitialized,
  ]); // Don't include createGrid to prevent loops

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
          const dims = getShapeAwareDimensions(n as any)
          const w = (dims.width || 200)
          const h = (dims.height || 80)
          const left = n.x - w / 2
          const top = n.y - h / 2
          return (
            connectionPreview.x >= left &&
            connectionPreview.x <= left + w &&
            connectionPreview.y >= top &&
            connectionPreview.y <= top + h
          )
        })
        const hoverTargetBox = hoveredNode
          ? (() => {
              const dims = getShapeAwareDimensions(hoveredNode as any)
              const w = (dims.width || 200)
              const h = (dims.height || 80)
              return { x: hoveredNode.x - w / 2, y: hoveredNode.y - h / 2, width: w, height: h }
            })()
          : undefined

        const previewPath = calculateConnectionPreviewPath(
          sourceNode,
          connectionStart.portId,
          connectionPreview,
          nodeVariant,
          undefined,
          workflowContextState.designerMode || "workflow",
          hoverTargetBox
        );

        // Determine preview marker based on source port type and direction
        const isSourceBottomPort = sourceNode.bottomPorts?.some(
          (p) => p.id === connectionStart.portId
        );
        const isLeftToRight = connectionPreview.x > sourceNode.x;
        let previewMarker = "url(#arrowhead)";

        if (isSourceBottomPort && !isLeftToRight) {
          previewMarker = "url(#arrowhead-left)";
        }

        g.append("path")
          .attr("class", "connection-preview")
          .attr("d", previewPath)
          .attr("stroke", "#2196F3")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5")
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

    // Update port visual states during connection
    const nodeLayer = svg.select(".node-layer");

    // Update input ports visual state with change detection
    nodeLayer.selectAll(".input-port-circle").each(function (d: any) {
      const portElement = d3.select(this);
      const parentElement = (this as any)?.parentNode;
      const portGroup = parentElement ? d3.select(parentElement) : null;
      const isConnectionActive =
        isConnecting && connectionStart && connectionStart.type === "output";
      const canDrop = isConnectionActive
        ? canDropOnPort(d.nodeId, d.id, "input")
        : false;

      // Architecture mode with side ports: do not show green validation highlights
      const archNoValidation = workflowContextState.designerMode === "architecture";

      // Add/remove can-dropped class based on validation with debouncing
      if (portGroup) {
        const portKey = `${d.nodeId}-${d.id}`;

        if (isConnectionActive && !archNoValidation) {
          // Use debounced highlighting to prevent flickering
          updatePortHighlighting(portKey, canDrop, portGroup);

          // Debug log for architecture mode (sample to reduce noise)
          if (process.env.NODE_ENV === "development" && Math.random() < 0.1) {
            console.log("🎯 Input port can-dropped (sampled):", {
              nodeId: d.nodeId,
              portId: d.id,
              canDrop,
              designerMode: workflowContextState.designerMode,
            });
          }
        } else {
          // Clear highlighting when not connecting
          updatePortHighlighting(portKey, false, portGroup);
        }
      }

      // Calculate target values using inline logic (performance optimized)
      const safeCanDrop = archNoValidation ? false : Boolean(canDrop);
      const baseDimensions = getConfigurableDimensions(d.nodeData);

      // Extract nested ternary operations for better readability
      let targetFill: string;
      let targetStroke: string;
      let targetStrokeWidth: number;
      let targetRadius: number;

  if (isConnectionActive && !archNoValidation) {
        targetFill = safeCanDrop ? "#4CAF50" : "#ccc";
        targetStroke = safeCanDrop ? "#4CAF50" : "#ff5722";
        targetStrokeWidth = safeCanDrop ? 3 : 2;
        targetRadius = safeCanDrop
          ? baseDimensions.portRadius * 1.5
          : baseDimensions.portRadius;
      } else {
        targetFill = getPortColor("any");
        targetStroke = "#8d8d8d";
        targetStrokeWidth = 2;
        targetRadius = baseDimensions.portRadius;
      }

      // Only update if values changed to prevent flickering
      const currentFill = portElement.attr("fill");
      const currentStroke = portElement.attr("stroke");
      const currentStrokeWidth = parseInt(
        portElement.attr("stroke-width") || "2"
      );
      const currentRadius = parseFloat(portElement.attr("r") || "0");

      if (currentFill !== targetFill) {
        portElement.attr("fill", targetFill);
      }
      if (currentStroke !== targetStroke) {
        portElement.attr("stroke", targetStroke);
      }
      if (currentStrokeWidth !== targetStrokeWidth) {
        portElement.attr("stroke-width", targetStrokeWidth);
      }
      if (Math.abs(currentRadius - targetRadius) > 0.1) {
        portElement.attr("r", targetRadius);
      }
    });

    // Update output ports visual state with change detection
    nodeLayer.selectAll(".output-port-circle").each(function (d: any) {
      const portElement = d3.select(this);
      const parentElement = (this as any)?.parentNode;
      const portGroup = parentElement ? d3.select(parentElement) : null;
      const isConnectionActive =
        isConnecting && connectionStart && connectionStart.type === "input";
      const canDrop = isConnectionActive
        ? canDropOnPort(d.nodeId, d.id, "output")
        : false;

      // Architecture mode with side ports: do not show green validation highlights
      const archNoValidation = workflowContextState.designerMode === "architecture";

      // Add/remove can-dropped class based on validation
      if (portGroup) {
        if (isConnectionActive && !archNoValidation) {
          portGroup.classed("can-dropped", canDrop);
        } else {
          portGroup.classed("can-dropped", false);
        }
      }

      // Calculate target values using inline logic (performance optimized)
      const safeCanDrop = archNoValidation ? false : Boolean(canDrop);
      const baseDimensions = getConfigurableDimensions(d.nodeData);
      const targetFill = isConnectionActive && !archNoValidation
        ? safeCanDrop
          ? "#4CAF50"
          : "#ccc"
        : getPortColor("any");
      const targetStroke = isConnectionActive && !archNoValidation
        ? safeCanDrop
          ? "#4CAF50"
          : "#ff5722"
        : "#8d8d8d";
      const targetStrokeWidth = isConnectionActive && !archNoValidation ? (safeCanDrop ? 3 : 2) : 2;
      const targetRadius = isConnectionActive && !archNoValidation
        ? safeCanDrop
          ? baseDimensions.portRadius * 1.5
          : baseDimensions.portRadius
        : baseDimensions.portRadius;

      // Only update if values changed to prevent flickering
      const currentFill = portElement.attr("fill");
      const currentStroke = portElement.attr("stroke");
      const currentStrokeWidth = parseInt(
        portElement.attr("stroke-width") || "2"
      );
      const currentRadius = parseFloat(portElement.attr("r") || "0");

      if (currentFill !== targetFill) {
        portElement.attr("fill", targetFill);
      }
      if (currentStroke !== targetStroke) {
        portElement.attr("stroke", targetStroke);
      }
      if (currentStrokeWidth !== targetStrokeWidth) {
        portElement.attr("stroke-width", targetStrokeWidth);
      }
      if (Math.abs(currentRadius - targetRadius) > 0.1) {
        portElement.attr("r", targetRadius);
      }
    });

    // NOTE: updatePortHighlighting intentionally omitted to keep dependency array minimal; it's stable (empty deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isConnecting,
    connectionStart?.nodeId,
    connectionStart?.portId,
    connectionPreview?.x,
    connectionPreview?.y,
    nodeVariant,
    isInitialized,
    workflowContextState.designerMode,
    canDropOnPort,
    connectionPreview,
    connectionStart,
    getConfigurableDimensions,
    nodeMap,
    svgRef,
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

  // Canvas state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return;

    const svg = d3.select(svgRef.current);
    const gridLayer = svg.select(".grid-layer");

    // Update grid and toolbar
    const rect = svgRef.current.getBoundingClientRect();
    createGrid(gridLayer as any, canvasTransform, rect.width, rect.height);
  }, [canvasTransform, isInitialized, createGrid, svgRef]);

  // Cleanup effect
  useEffect(() => {
    const connectionCache = connectionPathCacheRef.current;
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      connectionCache.clear();
      gridCacheRef.current = null;
    };
  }, []);

  return null; // This component only manages D3 rendering
});

export default WorkflowCanvas;
