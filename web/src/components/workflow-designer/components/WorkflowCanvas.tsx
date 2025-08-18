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
import { getVisibleCanvasBounds } from "../utils/canvas-utils";
import {
  getNodeColor,
  getPortColor,
  getNodeIcon,
  getNodeShape,
  getShapeAwareDimensions,
  getNodeShapePath,
  getPortPositions,
  NODE_WIDTH,
  NODE_MIN_HEIGHT,
  NodeTypes,
} from "../utils/node-utils";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Server,
  Database,
  Globe,
  Shield,
  Monitor,
  Cloud,
  GitBranch,
  Package,
  Users,
  FileText,
  Box,
} from "lucide-react";
import { useConnectionPaths } from "../hooks/useConnectionPaths";
import {
  getArrowMarkerForMode as getArrowMarkerForModeUtil,
  getLeftArrowMarker as getLeftArrowMarkerUtil,
} from "../utils/marker-utils";
import {
  GridPerformanceMonitor,
  GridOptimizer,
} from "../utils/grid-performance";
import {
  PERFORMANCE_CONSTANTS,
  GRID_CONSTANTS,
  type CallbackPriority,
  type NodeZIndexState,
} from "../utils/canvas-constants";
import {
  getPathMidpointWithOrientation,
  getLabelOffsetForOrientation,
} from "../utils/svg-path-utils";
import {
  calculateConnectionPreviewPath,
  getConnectionGroupInfo,
  calculatePortPosition,
} from "../utils/connection-utils";
import { getShapePath } from "../utils/shape-utils";

// Component props
interface WorkflowCanvasProps {
  svgRef: React.RefObject<SVGSVGElement>;
  nodes: WorkflowNode[];
  connections: Connection[];
  showGrid: boolean;
  canvasTransform: CanvasTransform;
  nodeVariant: NodeVariant;
  selectedNodes: Set<string>;
  selectedConnection: Connection | null;
  isNodeSelected: (nodeId: string) => boolean;
  isConnecting: boolean;
  connectionStart: {
    nodeId: string;
    portId: string;
    type: "input" | "output";
  } | null;
  connectionPreview: { x: number; y: number } | null;
  onNodeClick: (node: WorkflowNode, ctrlKey?: boolean) => void;
  onNodeDoubleClick: (node: WorkflowNode, event?: any) => void;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  onConnectionClick: (connection: Connection, event?: any) => void;
  onPortClick: (
    nodeId: string,
    portId: string,
    type: "input" | "output"
  ) => void;
  onCanvasClick: () => void;
  onCanvasMouseMove: (x: number, y: number) => void;
  onPortDragStart: (
    nodeId: string,
    portId: string,
    type: "input" | "output"
  ) => void;
  onPortDrag: (x: number, y: number) => void;
  onPortDragEnd: (
    targetNodeId?: string,
    targetPortId?: string,
    canvasX?: number,
    canvasY?: number
  ) => void;
  canDropOnPort?: (
    targetNodeId: string,
    targetPortId: string,
    portType?: "input" | "output"
  ) => boolean;
  canDropOnNode?: (targetNodeId: string) => boolean;
  onPlusButtonClick?: (nodeId: string, portId: string) => void;
  onTransformChange?: (transform: d3.ZoomTransform) => void;
  onZoomLevelChange?: (k: number) => void;
  onRegisterZoomBehavior?: (
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
  ) => void;
}

function WorkflowCanvas(props: WorkflowCanvasProps) {
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
  } = props;

  // Context access (designer mode + dragging helpers)
  const {
    state: workflowContextState,
    isDragging: isContextDragging,
    getDraggedNodeId,
    startDragging,
    updateDragPosition,
    endDragging,
  } = useWorkflowContext();

  // Local state and refs missing earlier
  const [isInitialized, setIsInitialized] = useState(false);
  const d3SelectionCacheRef = useRef<{
    svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    nodeLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
    connectionLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
    gridLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
    lastUpdate?: number;
  }>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const batchedConnectionUpdateRef = useRef<number | null>(null);
  const batchedVisualUpdateRef = useRef<number | null>(null);
  const rafScheduledRef = useRef<boolean>(false);
  const visualUpdateQueueRef = useRef<Set<string>>(new Set());
  const connectionUpdateQueueRef = useRef<Set<string>>(new Set());

  // Minimal icon renderer for architecture-mode SVG icons
  function getArchitectureIconSvg(type: string, size: number, color: string) {
    const iconMap: Record<string, React.ComponentType<any>> = {
      server: Server,
      database: Database,
      globe: Globe,
  'rest-api': Globe,
  api: Globe,
      shield: Shield,
      monitor: Monitor,
      cloud: Cloud,
      branch: GitBranch,
      package: Package,
      users: Users,
      file: FileText,
      box: Box,
    };
    const Icon = iconMap[type] || Box;
    return renderToStaticMarkup(
      React.createElement(Icon, { size, color, strokeWidth: 1.8 })
    );
  }

  // Helper: show architecture outline only for nodes in group "Services"
  const isServicesArchitectureNode = useCallback((node: any) => {
    return node?.group === "Services";
  }, []);

  // ========== DRAG STATE REFS ==========
  // Store drag connection data independent of React state
  const dragConnectionDataRef = useRef<{
    nodeId: string;
    portId: string;
    type: "input" | "output";
  } | null>(null);

  // ========== PORT HIGHLIGHTING REFS ==========
  // Debounce port highlighting to prevent flickering
  const lastPortHighlightStateRef = useRef<Map<string, boolean>>(new Map());
  const pendingPortHighlightsRef = useRef<
    Array<{
      key: string;
      canDrop: boolean;
      group: d3.Selection<any, any, any, any>;
    }>
  >([]);
  const highlightRafRef = useRef<number | null>(null);

  // ========== PORT HIGHLIGHTING CALLBACKS ==========
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

  // ========== CACHE MANAGEMENT CALLBACKS ==========
  // Cached D3 selection getter for performance
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

  // Comprehensive cleanup for all timeouts, RAF callbacks, and refs on unmount
  useEffect(() => {
    const cleanup = () => {
      // Clear all timeout refs
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }

      // Clear all RAF refs
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (batchedConnectionUpdateRef.current) {
        cancelAnimationFrame(batchedConnectionUpdateRef.current);
        batchedConnectionUpdateRef.current = null;
      }
      if (batchedVisualUpdateRef.current) {
        cancelAnimationFrame(batchedVisualUpdateRef.current);
        batchedVisualUpdateRef.current = null;
      }
      if (highlightRafRef.current) {
        cancelAnimationFrame(highlightRafRef.current);
        highlightRafRef.current = null;
      }

      // Clear timeout refs that might be referenced later in the component
      if (dragStateCleanupRef.current) {
        clearTimeout(dragStateCleanupRef.current);
        dragStateCleanupRef.current = null;
      }

      // Clear grid performance monitor
      if (gridPerformanceRef.current) {
        gridPerformanceRef.current = null;
      }

      // Reset boolean flags
      rafScheduledRef.current = false;
    };

    return cleanup;
  }, []);

  // Enhanced connection system initialization removed - simplified to standard paths

  // Enhanced connection manager viewport updates removed

  // Performance monitoring removed - simplified architecture

  // Track current transform with ref for immediate access
  const currentTransformRef = useRef(canvasTransform);

  // Centralized connection path generator + drag overrides
  const {
    getConnectionPath: getConnectionPathFromHook,
    updateDragPosition: updateConnDragPos,
    clearAllDragPositions,
    clearCache: clearConnCache,
  } = useConnectionPaths(
    nodes,
    nodeVariant,
    workflowContextState.designerMode as "workflow" | "architecture" | undefined
  );

  // Stable alias for downstream usage
  const getConnectionPath = useCallback(
    (connection: Connection, useDragPositions = false) =>
      getConnectionPathFromHook(connection, useDragPositions),
    [getConnectionPathFromHook]
  );

  // Helper functions to reduce cognitive complexity
  const getArrowMarkerForMode = useCallback(
    (isWorkflowMode: boolean, state: "default" | "selected" | "hover") =>
      getArrowMarkerForModeUtil(isWorkflowMode, state),
    []
  );

  const getLeftArrowMarker = useCallback(
    (state: "default" | "selected" | "hover") => getLeftArrowMarkerUtil(state),
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

  // Default to workflow styling unless mode is explicitly 'architecture'.
  // This prevents accidental purple (architecture) arrows when mode is undefined or other.
  const isWorkflowMode = workflowContextState.designerMode !== "architecture";
      // Use a single auto-oriented marker per mode to ensure consistent arrowhead position
      return getArrowMarkerForMode(isWorkflowMode, state);
    },
    [nodes, workflowContextState.designerMode, getArrowMarkerForMode]
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

  // Cache size limits to prevent memory issues - using constants
  const MAX_CACHE_SIZE = PERFORMANCE_CONSTANTS.MAX_CACHE_SIZE;
  const CACHE_CLEANUP_THRESHOLD = PERFORMANCE_CONSTANTS.CACHE_CLEANUP_THRESHOLD;
  const GRID_CACHE_DURATION = PERFORMANCE_CONSTANTS.GRID_CACHE_DURATION;

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
      const baseGridSize = GRID_CONSTANTS.BASE_GRID_SIZE;

      // Use GridOptimizer to determine if grid should be shown
      if (!GridOptimizer.shouldShowGrid(transform.k)) {
        gridLayer.selectAll("*").remove();
        gridCacheRef.current = null;
        return;
      }

      // PERFORMANCE OPTIMIZATION: Maximized cache key tolerance for >80% hit rate
      const tolerance = GRID_CONSTANTS.GRID_CACHE_TOLERANCE;
      const viewportTolerance = GRID_CONSTANTS.VIEWPORT_CACHE_TOLERANCE;
      const roundedTransform = {
        x: Math.round(transform.x / tolerance) * tolerance,
        y: Math.round(transform.y / tolerance) * tolerance,
        k: Math.round(transform.k * 5) / 5, // Reduced precision to 0.2 steps for maximum cache efficiency
      };

      const transformString = `${roundedTransform.x},${roundedTransform.y},${roundedTransform.k}`;
      const viewportString = `${
        Math.round(viewportWidth / viewportTolerance) * viewportTolerance
      }x${Math.round(viewportHeight / viewportTolerance) * viewportTolerance}`;
      const cacheKey = `${transformString}:${viewportString}`;

      const cached = gridCacheRef.current;
      const now = performance.now();

      // CRITICAL FIX: Simplified cache validation - remove brittle DOM checks that cause false misses
      // Only validate cache existence, time, and transform - let recreation handle DOM inconsistencies
      const isCacheValid =
        cached &&
        cached.transform === cacheKey &&
        now - cached.lastRenderTime < GRID_CACHE_DURATION &&
        Math.abs(cached.viewport.width - viewportWidth) <
          GRID_CONSTANTS.VIEWPORT_HEIGHT_TOLERANCE &&
        Math.abs(cached.viewport.height - viewportHeight) <
          GRID_CONSTANTS.VIEWPORT_HEIGHT_TOLERANCE;

      if (isCacheValid) {
        gridPerformanceRef.current?.recordCacheHit();
        // Minimal logging - only log every 100th cache hit to reduce noise
        if (process.env.NODE_ENV === "development") {
          const metrics = gridPerformanceRef.current?.getMetrics();
          if (
            metrics &&
            metrics.cacheHits % GRID_CONSTANTS.CACHE_HIT_LOG_INTERVAL === 0
          ) {
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
          if (
            metrics &&
            metrics.cacheMisses % GRID_CONSTANTS.CACHE_HIT_LOG_INTERVAL === 0
          ) {
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

      // Dual-layer grid patterns: base dots (original id) + subtle major overlay
      // Keep original base id for compatibility with other modules/styles
      const patternId = "workflow-grid"; // base dots (original id)
      const majorPatternId = "workflow-grid-major"; // overlay dots

      const size = baseGridSize; // base spacing (e.g., 20)
      const majorStep = 5; // show a slightly larger dot every N dots
      const baseColor = "#d1d5db";
      const majorColor = "#d1d5db";
  // Derive radii from optimizer; keep opacities as requested (0.8 / 0.9)
  const { radius: dotRadius } = dotProperties;
  const baseOpacity = 0.8;
  const majorOpacity = 0.9;
      const baseRadius = Math.max(0.1, dotRadius / Math.max(0.0001, transform.k));
      const majorRadius = Math.max(
        0.1,
        (dotRadius * 1.5) / Math.max(0.0001, transform.k)
      );

      // Ensure base pattern exists and is updated
      let patternSel = defs.select<SVGPatternElement>(`#${patternId}`);
      if (patternSel.empty()) {
        patternSel = defs
          .append<SVGPatternElement>("pattern")
          .attr("id", patternId)
          .attr("patternUnits", "userSpaceOnUse")
          .attr("width", size)
          .attr("height", size);
      }
      // Always update attributes to reflect any runtime changes
      patternSel.attr("width", size).attr("height", size);
      let baseCircle = patternSel.select<SVGCircleElement>("circle.base-dot");
      if (baseCircle.empty()) {
        baseCircle = patternSel
          .append<SVGCircleElement>("circle")
          .attr("class", "base-dot");
      }
      baseCircle
        .attr("cx", size / 2)
        .attr("cy", size / 2)
        .attr("r", baseRadius)
        .attr("fill", baseColor)
        .attr("opacity", baseOpacity);

      // Ensure major overlay pattern exists and is updated
      let majorPatternSel = defs.select<SVGPatternElement>(
        `#${majorPatternId}`
      );
      if (majorPatternSel.empty()) {
        majorPatternSel = defs
          .append<SVGPatternElement>("pattern")
          .attr("id", majorPatternId)
          .attr("patternUnits", "userSpaceOnUse")
          .attr("width", size * majorStep)
          .attr("height", size * majorStep);
      }
      majorPatternSel
        .attr("width", size * majorStep)
        .attr("height", size * majorStep);
      let majorCircle = majorPatternSel.select<SVGCircleElement>(
        "circle.major-dot"
      );
      if (majorCircle.empty()) {
        majorCircle = majorPatternSel
          .append<SVGCircleElement>("circle")
          .attr("class", "major-dot");
      }
      majorCircle
        .attr("cx", (size * majorStep) / 2)
        .attr("cy", (size * majorStep) / 2)
        .attr("r", majorRadius)
        .attr("fill", majorColor)
        .attr("opacity", majorOpacity);

  // PERFORMANCE: Selective clearing - only remove grid elements, preserve other content
  gridLayer.selectAll(".grid-pattern-rect").remove();

  // Note: We intentionally do NOT remove the global base/major patterns.
  // They are reused across renders and modes; removing would cause churn.

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

      // Render base dots
      gridLayer
        .append("rect")
        .attr("class", "grid-pattern-rect base")
        .attr("x", bounds.minX)
        .attr("y", bounds.minY)
        .attr("width", bounds.width)
        .attr("height", bounds.height)
        .attr("fill", `url(#${patternId})`)
        .style("pointer-events", "none")
        .style("will-change", "transform");

      // Render major dots overlay
      gridLayer
        .append("rect")
        .attr("class", "grid-pattern-rect major")
        .attr("x", bounds.minX)
        .attr("y", bounds.minY)
        .attr("width", bounds.width)
        .attr("height", bounds.height)
        .attr("fill", `url(#${majorPatternId})`)
        .style("pointer-events", "none")
        .style("will-change", "transform");

      // Enhanced cache with all necessary data and performance tracking
      const renderTime = performance.now() - startTime;

      // Update performance tracking using centralized monitor
      gridPerformanceRef.current?.recordRender(renderTime);

      // Store current viewport size for debugging/inspection
      gridLayer.attr(
        "data-grid-size",
        `${Math.round(viewportWidth)}x${Math.round(viewportHeight)}`
      );

      gridCacheRef.current = {
        transform: cacheKey,
  pattern: `${patternId},${majorPatternId}`,
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
        if (
          metrics.renderCount % GRID_CONSTANTS.PERFORMANCE_LOG_INTERVAL ===
          0
        ) {
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
          metrics.renderCount % GRID_CONSTANTS.PERFORMANCE_WARNING_INTERVAL ===
            0
        ) {
          console.warn(
            `🚨 Grid Performance ${report.status.toUpperCase()} (every 50th):`,
            report.summary
          );
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showGrid] // GRID_CACHE_DURATION is const and doesn't need to be included
  );

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

  // Track last updated paths removed; hook handles caching

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
    const dimensionsCache = new Map<string, any>();

    return (node: WorkflowNode) => {
      const cacheKey = `${node.id}-${nodeVariant}-${
        workflowContextState.designerMode || "workflow"
      }`;
      const cached = dimensionsCache.get(cacheKey);
      if (cached) return cached;

      const shapeDimensions = getShapeAwareDimensions(node);

      // Architecture mode: fixed rounded-square sizing + right-side labels
      if (workflowContextState.designerMode === "architecture") {
        const ARCH_SIZE = 56; // square size (reduced from 64)
        const result = {
          ...shapeDimensions,
          width: ARCH_SIZE,
          height: ARCH_SIZE,
          iconOffset: { x: 0, y: 0 },
          labelOffset: { x: 0, y: 0 }, // label positioning is handled later (to the right)
          portRadius: 5,
          iconSize: 28,
          fontSize: 14,
        };
        dimensionsCache.set(cacheKey, result);
        return result;
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
            };

      dimensionsCache.set(cacheKey, result);
      return result;
    };
  }, [nodeVariant, workflowContextState.designerMode]);

  // Memoized port positions calculation using configurable dimensions
  const getConfigurablePortPositions = useMemo(() => {
    const positionsCache = new Map<string, any>();

    return (node: WorkflowNode, portType: "input" | "output") => {
      const cacheKey = `${node.id}-${portType}-${nodeVariant}-${
        workflowContextState.designerMode || "workflow"
      }`;

      if (positionsCache.has(cacheKey)) {
        return positionsCache.get(cacheKey);
      }

      const shape = getNodeShape(node.type);
      const dimensions = getConfigurableDimensions(node);
      const portCount =
        portType === "input" ? node.inputs.length : node.outputs.length;

      // Import getPortPositions from shape-utils directly since we need to pass custom dimensions
      // Fallback: calculate positions directly here to avoid async issues
      const positions: Array<{ x: number; y: number }> = [];

      if (shape === "rectangle" || shape === "square") {
        const spacing = dimensions.height / (portCount + 1);
        for (let i = 0; i < portCount; i++) {
          const y = -dimensions.height / 2 + spacing * (i + 1);
          const x =
            portType === "input" ? -dimensions.width / 2 : dimensions.width / 2;
          positions.push({ x, y });
        }
      } else if (shape === "circle") {
        const angleStep = (Math.PI * 2) / portCount;
        const radius = Math.min(dimensions.width, dimensions.height) / 2;
        for (let i = 0; i < portCount; i++) {
          const angle = angleStep * i;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          positions.push({ x, y });
        }
      } else if (shape === "diamond") {
        // Match diamond geometry used in shape-utils: vertical scale factor of 0.75
        const halfWidth = dimensions.width / 2;
        const effectiveHalfHeight = (dimensions.height / 2) * 0.75;
        const effectiveHeight = effectiveHalfHeight * 2;
        const spacing = Math.min(25, effectiveHeight / (portCount + 1));
        const startY = -((portCount - 1) * spacing) / 2;
        for (let i = 0; i < portCount; i++) {
          const y = startY + i * spacing;
          const widthAtY = Math.max(
            0,
            halfWidth *
              (1 -
                Math.min(1, Math.abs(y) / Math.max(1e-6, effectiveHalfHeight)))
          );
          const x = (portType === "input" ? -1 : 1) * widthAtY;
          positions.push({ x, y });
        }
      }

      positionsCache.set(cacheKey, positions);
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
          batchedConnectionUpdateRef.current = requestAnimationFrame(
            processBatchedConnectionUpdates
          );
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

  // Main D3 rendering effect - soon: nodes-focused (connections handled separately)
  useEffect(() => {
    if (!svgRef.current) return;

    try {
      // Copy refs at the start of the effect for cleanup
      const currentSvgRef = svgRef.current;
      const allNodeElements = allNodeElementsRef.current;

      const svg = d3.select(currentSvgRef);
      // Initialize or reuse defs (do not clear to preserve markers between renders)
      let defs = svg.select<SVGDefsElement>("defs");
      if (defs.empty()) {
        defs = svg.append("defs");
      }

      // Background rect (ensure single)
      let bg = svg.select<SVGRectElement>("rect.svg-canvas-background");
      if (bg.empty()) {
        bg = svg.append("rect").attr("class", "svg-canvas-background");
      }
      bg.attr("width", "100%").attr("height", "100%").attr("fill", "#f7f7f7");

      // Arrow markers with direction-aware positioning and optimized refX
  const createArrowMarker = (
        id: string,
        color: string,
        size = 10,
        direction: 'right' | 'left' = 'right'
      ) => {
        const marker = defs
          .append("marker")
          .attr("id", id)
          .attr("markerWidth", size)
          .attr("markerHeight", size)
          .attr("viewBox", `0 0 ${size} ${size}`)
          .attr("orient", "auto")
          .attr("markerUnits", "userSpaceOnUse");

  // Pad so the arrow tip stays BEFORE the path end to avoid overlapping into nodes
  // For architecture markers: anchor the CENTER of the triangle at the path end.
  // We'll trim the path by half the marker size in path-utils so the tip touches the node edge.
  const isArchitectureMarker = id.includes('architecture');
  const pad = isArchitectureMarker ? 0 : -4;
        if (direction === "right") {
    // Right-pointing arrow (tip at x=size).
    // Architecture: refX=size/2 (center anchored). Workflow/others: size+pad (tip anchored with small backoff).
          marker
  .attr("refX", isArchitectureMarker ? size / 2 : size + pad)
            .attr("refY", size / 2)
            .append("polygon")
            .attr("points", `0,0 ${size},${size / 2} 0,${size}`)
            .attr("fill", color)
            .attr("stroke", "none");
        } else {
    // Left-pointing arrow (tip at x=0).
    // Architecture: refX=size/2 (center anchored). Workflow/others: -pad (tip anchored with small backoff).
          marker
  .attr("refX", isArchitectureMarker ? size / 2 : -pad)
            .attr("refY", size / 2)
            .append("polygon")
            .attr("points", `${size},0 0,${size / 2} ${size},${size}`)
            .attr("fill", color)
            .attr("stroke", "none");
        }
      };

      // Create directional arrow markers once (skip if already present)
      const markersInitialized = !defs.select("#arrowhead").empty();
      if (!markersInitialized) {
        createArrowMarker("arrowhead", "#666");
        createArrowMarker("arrowhead-selected", "#2196F3");
        createArrowMarker("arrowhead-hover", "#1976D2", 12);
        createArrowMarker("arrowhead-left", "#666", 10, "left");
        createArrowMarker("arrowhead-left-selected", "#2196F3", 10, "left");
        createArrowMarker("arrowhead-left-hover", "#1976D2", 12, "left");

        // Mode-specific arrow markers for workflow mode
        createArrowMarker("arrowhead-workflow", "#2563eb", 14);
        createArrowMarker("arrowhead-workflow-selected", "#059669", 16);
        createArrowMarker("arrowhead-workflow-hover", "#1d4ed8", 16);

        // Mode-specific arrow markers for architecture mode
        createArrowMarker("arrowhead-architecture", "#7c3aed", 10);
        createArrowMarker("arrowhead-architecture-selected", "#dc2626", 12);
        createArrowMarker("arrowhead-architecture-hover", "#6d28d9", 12);
      }

      // Layer hierarchy (ensure single instances)
      let g = svg.select<SVGGElement>("g.canvas-root");
      if (g.empty()) {
        g = svg.append("g").attr("class", "canvas-root");
      }
      let gridLayer = g.select<SVGGElement>("g.grid-layer");
      if (gridLayer.empty()) {
        gridLayer = g
          .append("g")
          .attr("class", "grid-layer")
          .style("pointer-events", "none");
      }
      let mainNodeLayer = g.select<SVGGElement>("g.node-layer");
      if (mainNodeLayer.empty()) {
        mainNodeLayer = g.append("g").attr("class", "node-layer");
      }
      let connectionLayer = g.select<SVGGElement>("g.connection-layer");
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
            const rootSel = d3
              .select(svgRef.current)
              .select<SVGGElement>("g.canvas-root");
            if (!rootSel.empty()) {
              rootSel.attr("transform", transform.toString());
            }
          }
          if (onZoomLevelChange && prevK != transform.k) {
            onZoomLevelChange(transform.k);
          }

          // Grid updates are handled by the dedicated grid effect reacting to canvasTransform

          onTransformChange?.(transform);

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

      // Bind zoom only once (skip if already initialized) and register behavior once
      if (svg.attr("data-zoom-init") !== "true") {
        svg.call(zoom);
        svg.attr("data-zoom-init", "true");
        onRegisterZoomBehavior?.(zoom);
      }

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
          const ctrlKey =
            event.sourceEvent.ctrlKey || event.sourceEvent.metaKey;
          onNodeClick(d, ctrlKey);
        }
      }

      // Connections are rendered in the dedicated connections-only effect.
      // Connection preview is also handled in the connection state effect.

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
                      conn.targetNodeId === d.id &&
                      conn.targetPortId === port.id
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

      // Architecture-mode dashed outline (hover/focus ring style)
      nodeEnter
        .append("rect")
        .attr("class", "node-arch-outline")
        .style("pointer-events", "none")
        .style("fill", "none")
        .style("stroke", "#3b82f6")
        .style("stroke-width", 2)
        .style("stroke-dasharray", "6,6")
        .style("opacity", 0.8)
        .style("display", (d: any) =>
          workflowContextState.designerMode === "architecture" &&
          isServicesArchitectureNode(d)
            ? null
            : "none"
        );

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

          // Architecture mode: rounded square visual with fixed size
          if (workflowContextState.designerMode === "architecture") {
            const dims = getConfigurableDimensions(d);
            const radius = 14; // stronger roundness like screenshot
            const pathData = getShapePath(
              "rectangle",
              dims.width,
              dims.height,
              radius
            );
            return pathData.d;
          }

          // Workflow mode: existing rounded rules
          if (d.type === "start") {
            const dimensions = getShapeAwareDimensions(d);
            const leftRadius =
              Math.min(dimensions.width, dimensions.height) * 0.3;
            const rightRadius = 8;
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

      // Update architecture outline box to slightly exceed node bounds
      nodeGroups.select(".node-arch-outline").each(function (d: any) {
        const outline = d3.select(this);
        const dims = getConfigurableDimensions(d);
        const pad = 8;
        outline
          .attr("x", -dims.width / 2 - pad)
          .attr("y", -dims.height / 2 - pad)
          .attr("width", dims.width + pad * 2)
          .attr("height", dims.height + pad * 2)
          .attr("rx", 16)
          .style("display", () =>
            workflowContextState.designerMode === "architecture" &&
            isServicesArchitectureNode(d)
              ? null
              : "none"
          );
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

      // Architecture-mode SVG icon container
      nodeEnter
        .append("g")
        .attr("class", "node-icon-svg")
        .style("pointer-events", "none")
        .style("stroke-width", 1.8 as unknown as string);

      nodeGroups
        .select(".node-icon")
        // Hide text icon in architecture mode
        .style("display", () =>
          workflowContextState.designerMode === "architecture" ? "none" : null
        )
        .attr("x", (d: any) => {
          const dimensions = getConfigurableDimensions(d);
          return dimensions.iconOffset?.x ?? 0;
        })
        .attr("y", (d: any) => {
          const dimensions = getConfigurableDimensions(d);
          return dimensions.iconOffset?.y ?? -8;
        })
        // Nudge vertical alignment to true optical center in architecture mode
        .attr("dy", () =>
          workflowContextState.designerMode === "architecture" ? "0.1em" : "0"
        )
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr(
          "font-size",
          (d: any) => getConfigurableDimensions(d).iconSize || 18
        )
        .attr("fill", "#8d8d8d")
        .text((d: any) => getNodeIcon(d.type));

      // Update SVG icon group for architecture mode
      nodeGroups
        .select(".node-icon-svg")
        .style("display", () =>
          workflowContextState.designerMode === "architecture" ? null : "none"
        )
        // Ensure icon stroke width looks balanced in architecture mode
        .style("stroke-width", 1.8 as unknown as string)
        .each(function (d: any) {
          const g = d3.select(this as SVGGElement);
          if (workflowContextState.designerMode !== "architecture") {
            // Clear when not in architecture mode
            g.html("");
            return;
          }
          const dimensions = getConfigurableDimensions(d);
          const size = dimensions.iconSize || 24;
          const color = "#8d8d8d";
          const svgStr = getArchitectureIconSvg(d.type, size, color);
          const key = `${d.type}:${size}`;
          const nodeEl = g.node() as any;
          if (nodeEl && nodeEl.__iconKey !== key) {
            // Center icon at (0,0) of the node group by translating top-left
            const tx = (dimensions.iconOffset?.x ?? 0) - size / 2;
            const ty = (dimensions.iconOffset?.y ?? 0) - size / 2;
            g.attr("transform", `translate(${tx}, ${ty})`);
            g.html(svgStr || "");
            nodeEl.__iconKey = key;
          }
        });

      // Node label
      nodeEnter
        .append("text")
        .attr("class", "node-label")
        .style("pointer-events", "none");

      // Architecture-mode sublabel (smaller text under main label)
      nodeEnter
        .append("text")
        .attr("class", "node-sublabel")
        .style("pointer-events", "none")
        .style("opacity", 0.8);

      // Legacy badge removed - it was visual clutter without adding meaningful value

      nodeGroups
        .select(".node-label")
        .attr("x", (d: any) => {
          const dimensions = getConfigurableDimensions(d);
          if (workflowContextState.designerMode === "architecture") {
            // Place to the right of the node box
            return dimensions.width / 2 + 18;
          }
          return dimensions.labelOffset?.x || 0;
        })
        .attr("y", (d: any) => {
          const dimensions = getConfigurableDimensions(d);
          if (workflowContextState.designerMode === "architecture") {
            return -6;
          }
          return dimensions.labelOffset?.y || 15;
        })
        .attr("text-anchor", () =>
          workflowContextState.designerMode === "architecture"
            ? "start"
            : "middle"
        )
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

      // Update sublabel in architecture mode (e.g., show node id or version)
      nodeGroups
        .select(".node-sublabel")
        .attr("x", (d: any) => {
          const dimensions = getConfigurableDimensions(d);
          return workflowContextState.designerMode === "architecture"
            ? dimensions.width / 2 + 18
            : 0;
        })
        .attr("y", () =>
          workflowContextState.designerMode === "architecture" ? 10 : 99999
        ) // push offscreen when hidden
        .attr("text-anchor", () =>
          workflowContextState.designerMode === "architecture"
            ? "start"
            : "middle"
        )
        .attr("dominant-baseline", "middle")
        .attr(
          "font-size",
          (d: any) => (getConfigurableDimensions(d).fontSize || 12) - 3
        )
        .attr("fill", "#6b7280")
        .style("display", () =>
          workflowContextState.designerMode === "architecture" ? null : "none"
        )
        .text((d: any) => d.metadata?.version || d.id);

      // Legacy badge update removed - badge has been completely removed

      // Render simple ports for both variants
      // Input ports - DISABLED drag/click interactions for connection creation
      const inputPortGroups = nodeGroups
        .selectAll(".input-port-group")
        .data((d: any) =>
          d.inputs.map((input: any) => ({
            ...input,
            nodeId: d.id,
            nodeData: d,
          }))
        )
        .join("g")
        .attr("class", (d: any) => {
          // Check if this port has any connections
          const hasConnection = connections.some(
            (conn) =>
              conn.targetNodeId === d.nodeId && conn.targetPortId === d.id
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
                    const match = /translate\(([^,]+),([^)]+)\)/.exec(
                      transform
                    );
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
                    const match = /translate\(([^,]+),([^)]+)\)/.exec(
                      transform
                    );
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
                    getConfigurableDimensions(portData.nodeData).portRadius ||
                    6;
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
                    const match = /translate\(([^,]+),([^)]+)\)/.exec(
                      transform
                    );
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
          const positions = getConfigurablePortPositions(d.nodeData, "input");
          return positions[i]?.x || 0;
        })
        .attr("cy", (d: any, i: number) => {
          const positions = getConfigurablePortPositions(d.nodeData, "input");
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
            (conn) =>
              conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
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
              const allInputPorts =
                svgSelection.selectAll(".input-port-circle");
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

                  console.log(
                    "🎯 Processing node for background drop:",
                    nodeId
                  );

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
                    const match = /translate\(([^,]+),([^)]+)\)/.exec(
                      transform
                    );
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
          const positions = getConfigurablePortPositions(d.nodeData, "output");
          return positions[i]?.x || 0;
        })
        .attr("cy", (d: any, i: number) => {
          const positions = getConfigurablePortPositions(d.nodeData, "output");
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
          const dim = getConfigurableDimensions(d);
          const halfW = (dim.width || NODE_WIDTH) / 2;
          const halfH = (dim.height || NODE_MIN_HEIGHT) / 2;
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
              const allInputPorts =
                svgSelection.selectAll(".input-port-circle");
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
                    const match = /translate\(([^,]+),([^)]+)\)/.exec(
                      transform
                    );
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
              const allInputPorts =
                svgSelection.selectAll(".input-port-circle");
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
          // Use shared util to get absolute bottom port position, then convert to node-relative
          const abs = calculatePortPosition(
            d.nodeData,
            d.id,
            "bottom",
            nodeVariant
          );
          const relX = abs.x - d.nodeData.x;
          const relY = abs.y - d.nodeData.y;
          return `translate(${relX}, ${relY})`;
        })
        .attr("fill", (d: any) => {
          if (
            isConnecting &&
            connectionStart &&
            connectionStart.type === "output"
          ) {
            const canDrop = canDropOnPort
              ? canDropOnPort(d.nodeId, d.id, "input")
              : false;
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
          const abs = calculatePortPosition(
            d.nodeData,
            d.id,
            "bottom",
            nodeVariant
          );
          return abs.x - d.nodeData.x;
        })
        .attr("y1", (d: any) => {
          const abs = calculatePortPosition(
            d.nodeData,
            d.id,
            "bottom",
            nodeVariant
          );
          return abs.y - d.nodeData.y;
        })
        .attr("x2", (d: any) => {
          const abs = calculatePortPosition(
            d.nodeData,
            d.id,
            "bottom",
            nodeVariant
          );
          return abs.x - d.nodeData.x;
        })
        .attr("y2", (d: any) => {
          const abs = calculatePortPosition(
            d.nodeData,
            d.id,
            "bottom",
            nodeVariant
          );
          const position = { x: abs.x - d.nodeData.x, y: abs.y - d.nodeData.y };
          // Check if this bottom port has a connection
          const hasConnection = connections.some(
            (conn) =>
              conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
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
            (conn) =>
              conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
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
            (conn) =>
              conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
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
            const abs = calculatePortPosition(
              d.nodeData,
              d.id,
              "bottom",
              nodeVariant
            );
            const x = abs.x - d.nodeData.x;
            const y = abs.y - d.nodeData.y + 36; // Beyond the connector line

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
        const abs = calculatePortPosition(
          d.nodeData,
          d.id,
          "bottom",
          nodeVariant
        );
        const labelX = abs.x - d.nodeData.x;
        const labelY = abs.y - d.nodeData.y + 15; // Below the diamond

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

        // Selective cleanup: preserve canvas structure (defs, canvas-root, zoom/pan)
        if (currentSvgRef) {
          const svgSel = d3.select(currentSvgRef);
          // Clear only node-layer contents for nodes-focused effect
          svgSel.select("g.node-layer").selectAll("*").remove();
          // Do NOT clear connection-layer or previews here; other effects own those updates
          // Note: Keep <defs> and <g.canvas-root> to avoid losing markers and zoom/pan state
        }
        // Clear connection path cache managed by hook
        clearConnCache();
        gridCacheRef.current = null;
        allNodeElements?.clear();
      };
    } catch (error) {
      console.error("Error in main D3 rendering effect:", error);
      // Reset caches on error to prevent further issues
      clearConnCache();
      if (gridCacheRef.current) {
        gridCacheRef.current = null;
      }
      if (allNodeElementsRef.current) {
        allNodeElementsRef.current.clear();
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, nodeVariant]); // Nodes-focused; connections are updated in a separate effect

  // Connections-only effect: update/create connection DOM with data-join by id
  useEffect(() => {
    if (!svgRef.current) return;

    try {
      const svg = d3.select(svgRef.current);
      const connectionLayer = svg.select<SVGGElement>(".connection-layer");
      if (connectionLayer.empty()) return;

      // Data-join by id
      const selection = connectionLayer
        .selectAll<SVGGElement, any>("g.connection")
        .data(connections as any, (d: any) => d.id);

      // EXIT
      selection.exit().remove();

      // ENTER
      const enter = selection
        .enter()
        .append("g")
        .attr("class", "connection")
        .attr("data-connection-id", (d: any) => d.id)
        .style("pointer-events", "none");

      // Invisible hitbox for interaction
      enter
        .append("path")
        .attr("class", "connection-hitbox")
        .attr("fill", "rgba(0, 0, 0, 0.01)")
        .attr("stroke", "none")
        .style("pointer-events", "all")
        .style("cursor", "pointer")
        .on("click", (event: any, d: any) => {
          event.stopPropagation();
          onConnectionClick(d);
        })
        .on("mouseenter", function (this: any, _event: any, d: any) {
          const group = d3.select(this.parentNode as SVGGElement);
          const path = group.select<SVGPathElement>(".connection-path");
          group.classed("connection-hover", true);
          if (!path.empty()) {
            path
              .attr("stroke", "#1976D2")
              .attr("stroke-width", 3)
              .attr("marker-end", getConnectionMarker(d, "hover"))
              .style("marker-end", getConnectionMarker(d, "hover"));
          }
        })
        .on("mouseleave", function (this: any, _event: any, d: any) {
          const group = d3.select(this.parentNode as SVGGElement);
          const path = group.select<SVGPathElement>(".connection-path");
          group.classed("connection-hover", false);
          if (!path.empty()) {
            path
              .attr("stroke", "white")
              .attr("stroke-width", 2)
              .attr("marker-end", getConnectionMarker(d, "default"))
              .style("marker-end", getConnectionMarker(d, "default"));
          }
        });

      // Visible path
      enter
        .append("path")
        .attr("class", "connection-path")
        .attr("fill", "none")
        .style("pointer-events", "none");

      // Label (used in architecture multi-connection)
      enter
        .append("text")
        .attr("class", "connection-label")
        .attr("font-size", 10)
        .attr("font-weight", "bold")
        .attr("fill", "#555")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("pointer-events", "none");

      // UPDATE + ENTER MERGE
      const merged = enter.merge(selection as any);

      // Update hitbox geometry
      merged
        .select<SVGPathElement>(".connection-hitbox")
        .attr("d", (d: any) =>
          createFilledPolygonFromPath(getConnectionPath(d), 8)
        )
        .style("display", (d: any) => {
          const groupInfo = getConnectionGroupInfo(d.id, connections);
          return groupInfo.isMultiple && groupInfo.index > 0 ? "none" : "block";
        });

      // Update visible path
      merged
        .select<SVGPathElement>(".connection-path")
  .attr("d", (d: any) => getConnectionPath(d))
        .attr("stroke", "white")
        .attr("stroke-width", 2)
  .attr("marker-end", (d: any) => getConnectionMarker(d, "default"))
  .style("marker-end", (d: any) => getConnectionMarker(d, "default"))
        .style("display", (d: any) => {
          const groupInfo = getConnectionGroupInfo(d.id, connections);
          return groupInfo.isMultiple && groupInfo.index > 0 ? "none" : "block";
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

      // Update label
      merged
        .select<SVGTextElement>(".connection-label")
        .style("display", (d: any) => {
          if (workflowContextState.designerMode !== "architecture")
            return "none";
          const gi = getConnectionGroupInfo(d.id, connections);
          return gi.isMultiple && gi.index === 0 ? "block" : "none";
        })
        .attr("x", (d: any) => {
          if (workflowContextState.designerMode === "architecture") {
            const pathStr = getConnectionPath(d);
            const mid = getPathMidpointWithOrientation(pathStr);
            if (mid) {
              const offset = getLabelOffsetForOrientation(mid.orientation);
              return mid.x + offset.x;
            }
          }
          const s = nodeMap.get(d.sourceNodeId);
          const t = nodeMap.get(d.targetNodeId);
          if (!s || !t) return 0;
          return (s.x + t.x) / 2;
        })
        .attr("y", (d: any) => {
          if (workflowContextState.designerMode === "architecture") {
            const pathStr = getConnectionPath(d);
            const mid = getPathMidpointWithOrientation(pathStr);
            if (mid) {
              const offset = getLabelOffsetForOrientation(mid.orientation);
              return mid.y + offset.y;
            }
          }
          const s = nodeMap.get(d.sourceNodeId);
          const t = nodeMap.get(d.targetNodeId);
          if (!s || !t) return 0;
          return (s.y + t.y) / 2 - 8;
        })
        .text((d: any) => {
          const gi = getConnectionGroupInfo(d.id, connections);
          if (!gi.isMultiple) return "";
          if (workflowContextState.designerMode === "architecture") {
            return `${gi.total} connections`;
          }
          return `Endpoint ${gi.index + 1}`;
        });
    } catch (e) {
      console.error("Connection effect error:", e);
    }
  }, [
    connections,
    getConnectionPath,
    workflowContextState.designerMode,
    nodeMap,
    onConnectionClick,
    createFilledPolygonFromPath,
    getConnectionMarker,
    svgRef,
  ]);

  // Bind root SVG events in a tiny effect to avoid stale closures
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.on("click.canvas", () => onCanvasClick());
    svg.on("mousemove.canvas", (event) => {
      const [x, y] = d3.pointer(event, svg.node());
      const transform = d3.zoomTransform(svg.node() as any);
      const [canvasX, canvasY] = transform.invert([x, y]);
      onCanvasMouseMove(canvasX, canvasY);
    });
    return () => {
      svg.on("click.canvas", null).on("mousemove.canvas", null);
    };
  }, [onCanvasClick, onCanvasMouseMove, svgRef]);

  // 🎯 ISOLATED GRID EFFECT - Completely separate grid management with cache protection
  useEffect(() => {
    // Only recreate grid when absolutely necessary to maximize cache hits
    if (!svgRef.current || !isInitialized || !showGrid) {
      return;
    }

    try {
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
    } catch (error) {
      console.error("Error in grid rendering effect:", error);
      // Reset grid cache on error
      if (gridCacheRef.current) {
        gridCacheRef.current = null;
      }
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
        ? canDropOnPort?.(d.nodeId, d.id, "input") ?? false
        : false;

      // Architecture mode with side ports: do not show green validation highlights
      const archNoValidation =
        workflowContextState.designerMode === "architecture";

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
        ? canDropOnPort?.(d.nodeId, d.id, "output") ?? false
        : false;

      // Architecture mode with side ports: do not show green validation highlights
      const archNoValidation =
        workflowContextState.designerMode === "architecture";

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
      const targetFill =
        isConnectionActive && !archNoValidation
          ? safeCanDrop
            ? "#4CAF50"
            : "#ccc"
          : getPortColor("any");
      const targetStroke =
        isConnectionActive && !archNoValidation
          ? safeCanDrop
            ? "#4CAF50"
            : "#ff5722"
          : "#8d8d8d";
      const targetStrokeWidth =
        isConnectionActive && !archNoValidation ? (safeCanDrop ? 3 : 2) : 2;
      const targetRadius =
        isConnectionActive && !archNoValidation
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
    canDropOnPort, // Required for port highlighting logic
    updatePortHighlighting, // Required but should be stable (empty deps)
    getConfigurableDimensions,
    getArrowMarkerForMode,
    getLeftArrowMarker,
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
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      // Clear connection path cache managed by hook
      clearConnCache();
      gridCacheRef.current = null;
    };
  }, [clearConnCache]);

  return null; // This component only manages D3 rendering
}

export default WorkflowCanvas;
