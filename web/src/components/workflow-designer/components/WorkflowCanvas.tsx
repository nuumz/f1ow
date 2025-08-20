/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { createNodeElements, createNodeGroups } from '../utils/node-elements';
import type { PortDatum } from '../utils/ports-hit-test';
import type { WorkflowNode, Connection, NodeVariant, CanvasTransform } from '../types';
import { getNodeTypeInfo } from '../types/nodes';
import { useWorkflowContext } from '../contexts/WorkflowContext';
import {
  getNodeColor,
  getPortColor,
  getNodeIcon,
  getNodeShape,
  getShapeAwareDimensions,
  getNodeShapePath,
  NODE_WIDTH,
  NODE_MIN_HEIGHT,
  NodeTypes,
} from '../utils/node-utils';
import { renderIconUse } from '../utils/icon-symbols';
import { useConnectionPaths } from '../hooks/useConnectionPaths';
import {
  getArrowMarkerForMode as getArrowMarkerForModeUtil,
  ensureArrowMarkers,
} from '../utils/marker-utils';
import { GridPerformanceMonitor } from '../utils/performance-monitor';
import { ensureDualGridPatterns, renderDualGridRects, GridUtils } from '../utils/grid-patterns';
import {
  PERFORMANCE_CONSTANTS,
  GRID_CONSTANTS,
  type CallbackPriority,
} from '../utils/canvas-constants';
import {
  getConnectionGroupInfo,
  renderConnectionPreviewPath,
  tagSidePortsDuringConnection,
  updatePortsVisualState,
  type DesignerMode,
} from '../utils/connection-utils';
import { getVisibleCanvasBounds } from '../utils/canvas-utils';
import { calculatePortPosition } from '../utils/port-positioning';
import {
  createD3SelectionCache,
  createRafScheduler,
  createZIndexManager,
} from '../utils/d3-manager';
import { resolveDragEndTarget, createPortDragCallbacks } from '../utils/drag-drop-helpers';
import { renderConnectionsLayer } from '../utils/connection-dom';
import {
  attachNodeBackgroundEvents,
  applyNodeVisualState,
  updateArchOutline,
  updateIconsAndLabels,
  updateNodeBackgroundPath,
} from '../utils/nodes-dom';

// Import extracted helpers
import {
  announce,
  ensureFocusStyles,
  setupRovingTabIndex,
  attachRovingHandlers,
} from '../utils/accessibility-helpers';

// Shared aliases to reduce repetition and satisfy lint rules
type MarkerState = 'default' | 'selected' | 'hover';

// Strongly-typed drag connection data
interface DragConnectionData {
  nodeId: string;
  portId: string;
  type: 'input' | 'output';
}

// Component props
interface WorkflowCanvasProps {
  svgRef: React.RefObject<SVGSVGElement>;
  nodes: WorkflowNode[];
  connections: Connection[];
  showGrid: boolean;
  canvasTransform: CanvasTransform;
  nodeVariant: NodeVariant;
  selectedNodes: Set<string>;
  selectedConnection?: Connection | null;
  isNodeSelected: (nodeId: string) => boolean;
  isConnecting: boolean;
  connectionStart: {
    nodeId: string;
    portId: string;
    type: 'input' | 'output';
  } | null;
  connectionPreview: { x: number; y: number } | null;
  onNodeClick: (node: WorkflowNode, ctrlKey?: boolean) => void;
  onNodeDoubleClick: (node: WorkflowNode, event?: any) => void;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  onConnectionClick: (connection: Connection) => void;
  onCanvasClick: () => void;
  onCanvasMouseMove: (x: number, y: number) => void;
  // Optional port event handlers (provided by WorkflowDesigner handlers)
  onPortClick?: (nodeId: string, portId: string, portType: 'input' | 'output') => void;
  onPortDragStart?: (nodeId: string, portId: string, portType: 'input' | 'output') => void;
  onPortDrag?: (x: number, y: number) => void;
  onPortDragEnd?: (
    targetNodeId?: string,
    targetPortId?: string,
    canvasX?: number,
    canvasY?: number
  ) => void;
  canDropOnPort?: (nodeId: string, portId: string, type: 'input' | 'output') => boolean;
  // Optional node-level drop validation (used for background drop target validation)
  canDropOnNode?: (targetNodeId: string) => boolean;
  // Optional hooks for zoom/transform lifecycle used in the component
  onTransformChange?: (transform: d3.ZoomTransform) => void;
  onRegisterZoomBehavior?: (zoom: d3.ZoomBehavior<SVGSVGElement, unknown>) => void;
  onZoomLevelChange?: (k: number) => void;
  onPlusButtonClick?: (nodeId: string, portId: string) => void;
}

function WorkflowCanvas({
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
  onNodeDoubleClick: _onNodeDoubleClick,
  onNodeDrag,
  onConnectionClick,
  onCanvasClick,
  onCanvasMouseMove,
  onPortClick: onPortClickProp,
  onPortDragStart: onPortDragStartProp,
  onPortDrag: onPortDragProp,
  onPortDragEnd: onPortDragEndProp,
  canDropOnPort: canDropOnPortProp,
  canDropOnNode: _canDropOnNodeProp,
  onTransformChange,
  onRegisterZoomBehavior,
  onZoomLevelChange,
  onPlusButtonClick,
}: WorkflowCanvasProps) {
  // Keep latest connection state in a ref to avoid stale closures inside D3 handlers
  const isConnectingRef = useRef(isConnecting);
  const connectionStartRef = useRef(connectionStart);
  useEffect(() => {
    isConnectingRef.current = isConnecting;
    connectionStartRef.current = connectionStart;
  }, [isConnecting, connectionStart]);
  // Wire workflow context utilities and state used throughout
  const {
    state: workflowContextState,
    isDragging: isContextDragging,
    getDraggedNodeId,
    startDragging,
    updateDragPosition,
    endDragging,
    canDropOnPort: canDropOnPortFromContext,
    // canDropOnNode: canDropOnNodeFromContext,
    dispatch,
  } = useWorkflowContext();

  // Prefer prop override, fallback to context implementation
  const canDropOnPort = canDropOnPortProp ?? canDropOnPortFromContext;
  // Note: canDropOnNode is provided via props/context but not directly used in this component now.
  // Internal refs/utilities used across effects
  const highlightRafRef = useRef<number | null>(null);
  const pendingPortHighlightsRef = useRef<
    Array<{
      key: string;
      canDrop: boolean;
      group: d3.Selection<any, any, any, any>;
    }>
  >([]);
  const selectionCache = useMemo(() => createD3SelectionCache(() => svgRef.current), [svgRef]);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const batchedConnectionUpdateRef = useRef<number | null>(null);
  const batchedVisualUpdateRef = useRef<number | null>(null);
  // Queues used by batching logic elsewhere in the component
  const connectionUpdateQueueRef = useRef<Set<string>>(new Set());
  const visualUpdateQueueRef = useRef<Set<string>>(new Set());

  // Minimal local init flag used by effects below
  const [isInitialized, setIsInitialized] = useState(false);

  // Capture connection drag start reliably across async handlers
  const dragConnectionDataRef = useRef<DragConnectionData | null>(null);
  // Track if a keyboard-driven connection is in progress for UX hints
  const keyboardConnectingRef = useRef<boolean>(false);

  // Architecture outline visibility is driven by NodeTypes info now

  // Connection interaction shims (forward to context connection state via dispatch helpers)
  const onPortDragStart = useCallback(
    (nodeId: string, portId: string, type: 'input' | 'output') => {
      // Guard: if context says we're already connecting, ignore secondary starts
      if (isConnectingRef.current && connectionStartRef.current) {
        // If it's the same port, silently ignore; otherwise drop to avoid conflicting gestures
        const cs = connectionStartRef.current;
        if (cs?.nodeId === nodeId && cs?.portId === portId && cs?.type === type) {
          return;
        }
      }
      // Always capture locally first to avoid stale state issues
      dragConnectionDataRef.current = { nodeId, portId, type };
      if (onPortDragStartProp) {
        onPortDragStartProp(nodeId, portId, type);
      } else {
        dispatch?.({
          type: 'START_CONNECTION',
          payload: { nodeId, portId, type },
        });
      }
    },
    [dispatch, onPortDragStartProp]
  );

  const onPortDrag = useCallback(
    (x: number, y: number) => {
      if (onPortDragProp) {
        onPortDragProp(x, y);
      } else {
        dispatch?.({ type: 'UPDATE_CONNECTION_PREVIEW', payload: { x, y } });
      }
    },
    [dispatch, onPortDragProp]
  );

  const onPortDragEnd = useCallback(
    (targetNodeId?: string, targetPortId?: string, canvasX?: number, canvasY?: number) => {
      // Prefer external handler if provided (unified flow with operations + validation)
      if (onPortDragEndProp) {
        onPortDragEndProp(targetNodeId, targetPortId, canvasX, canvasY);
        // Cleanup local ref regardless
        dragConnectionDataRef.current = null;
        return;
      }

      // Fallback: use locally captured start first, then context state
      const start =
        dragConnectionDataRef.current ?? workflowContextState.connectionState.connectionStart;
      if (!start) {
        dispatch?.({ type: 'CLEAR_CONNECTION_STATE' });
        dragConnectionDataRef.current = null;
        return;
      }
      if (targetNodeId && targetPortId) {
        const newConn: Connection = {
          id: `${start.nodeId}:${start.portId}->${targetNodeId}:${targetPortId}:${Date.now()}`,
          sourceNodeId: start.type === 'output' ? start.nodeId : targetNodeId,
          sourcePortId: start.type === 'output' ? start.portId : targetPortId,
          targetNodeId: start.type === 'output' ? targetNodeId : start.nodeId,
          targetPortId: start.type === 'output' ? targetPortId : start.portId,
        };
        dispatch?.({ type: 'ADD_CONNECTION', payload: newConn });
      }
      dispatch?.({ type: 'CLEAR_CONNECTION_STATE' });
      dragConnectionDataRef.current = null;
    },
    [dispatch, onPortDragEndProp, workflowContextState.connectionState.connectionStart]
  );

  const onPortClick = useCallback(
    (nodeId: string, portId: string, portType: 'input' | 'output') => {
      // Delegate to external if provided
      onPortClickProp?.(nodeId, portId, portType);
    },
    [onPortClickProp]
  );

  const flushPortHighlights = useCallback(() => {
    const items = pendingPortHighlightsRef.current;
    if (items.length === 0) {
      highlightRafRef.current = null;
      return;
    }
    // Process all pending highlight updates
    for (const item of items) {
      try {
        item.group.classed('can-dropped', item.canDrop);
      } catch {
        // ignore DOM errors
      }
    }
    pendingPortHighlightsRef.current = [];
    highlightRafRef.current = null;
  }, []);

  const scheduleHighlightFlush = useCallback(() => {
    if (highlightRafRef.current !== null) {
      return;
    }
    highlightRafRef.current = requestAnimationFrame(() => {
      flushPortHighlights();
    });
  }, [flushPortHighlights]);

  const updatePortHighlighting = useCallback(
    (portKey: string, canDrop: boolean, portGroup: d3.Selection<any, any, any, any>) => {
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
      if (highlightRafRef.current) {
        cancelAnimationFrame(highlightRafRef.current);
      }
    },
    []
  );

  // ========== CACHE MANAGEMENT CALLBACKS ==========
  // Cached D3 selection getter for performance
  const getCachedSelection = useCallback(
    (type: 'svg' | 'nodeLayer' | 'connectionLayer' | 'gridLayer') =>
      selectionCache.getCachedSelection(type) as any,
    [selectionCache]
  );

  // Debug logger that respects lint rule (only allow warn/error); gate others in dev
  const dbg = useMemo(
    () =>
      ({
        log: (..._args: unknown[]) => {
          // no-op to satisfy no-console lint
        },
        warn: (...args: unknown[]) => console.warn(...args),
        error: (...args: unknown[]) => console.error(...args),
      }) as const,
    []
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

      // No local RAF scheduled flag anymore
    };

    return cleanup;
  }, []);

  // One-time setup: inject focus styles and set up Escape-to-cancel for keyboard connections
  useEffect(() => {
    ensureFocusStyles();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isConnectingRef.current) {
        e.stopPropagation();
        dispatch?.({ type: 'CLEAR_CONNECTION_STATE' });
        keyboardConnectingRef.current = false;
        announce('Connection cancelled');
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
  }, [dispatch]);

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
  } = useConnectionPaths(nodes, nodeVariant, workflowContextState.designerMode as DesignerMode);

  // Stable alias for downstream usage
  const getConnectionPath = useCallback(
    (connection: Connection, useDragPositions = false) =>
      getConnectionPathFromHook(connection, useDragPositions),
    [getConnectionPathFromHook]
  );

  // Helper functions to reduce cognitive complexity
  const getArrowMarkerForMode = useCallback(
    (isWorkflowMode: boolean, state: MarkerState) =>
      getArrowMarkerForModeUtil(isWorkflowMode, state),
    []
  );

  // getLeftArrowMarker helper removed (unused)

  /**
   * Helper function to determine connection direction and appropriate arrow marker
   * Now includes mode-specific styling for workflow vs architecture modes
   */
  const getConnectionMarker = useCallback(
    (connection: Connection, state: 'default' | 'selected' | 'hover' = 'default') => {
      const sourceNode = nodes.find((n: WorkflowNode) => n.id === connection.sourceNodeId);
      const targetNode = nodes.find((n: WorkflowNode) => n.id === connection.targetNodeId);

      if (!sourceNode || !targetNode) {
        return 'url(#arrowhead)';
      }

      // Default to workflow styling unless mode is explicitly 'architecture'.
      // This prevents accidental purple (architecture) arrows when mode is undefined or other.
      const isWorkflowMode = workflowContextState.designerMode !== 'architecture';
      // Use a single auto-oriented marker per mode to ensure consistent arrowhead position
      return getArrowMarkerForMode(isWorkflowMode, state);
    },
    [nodes, workflowContextState.designerMode, getArrowMarkerForMode]
  );
  useEffect(() => {
    currentTransformRef.current = canvasTransform;
  }, [canvasTransform]);

  // Drag state with context integration
  const draggedElementRef = useRef<d3.Selection<any, any, any, any> | null>(null);
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
  const nodePositionCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Grid performance monitoring using centralized utilities
  const gridPerformanceRef = useRef<GridPerformanceMonitor | null>(null);

  // Initialize grid performance monitor
  useEffect(() => {
    // Prefer nullish coalescing assignment for readability
    gridPerformanceRef.current ??= new GridPerformanceMonitor();
    // Start development monitoring if in dev mode (removed for production bundle slimming)
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

      // Early exit and cleanup if grid is hidden
      if (!showGrid) {
        gridLayer.selectAll('.grid-pattern-rect').remove();
        return;
      }

      // Resolve owning SVG and defs
      const owningSvg = gridLayer.node()?.ownerSVGElement;
      if (!owningSvg) {
        return;
      }
      const svgSelection = d3.select(owningSvg);
      let defs = svgSelection.select<SVGDefsElement>('defs');
      if (defs.empty()) {
        defs = svgSelection.insert<SVGDefsElement>('defs', ':first-child');
      }

      // Ensure patterns exist (base + major) via utility
      const baseSize = GRID_CONSTANTS.BASE_GRID_SIZE;
      const { patternId, majorPatternId } = ensureDualGridPatterns(defs, transform.k, baseSize);

      // PERFORMANCE: Selective clearing - only remove grid elements, preserve other content
      gridLayer.selectAll('.grid-pattern-rect').remove();

      // Enhanced bounds calculation with intelligent padding using GridUtils
      const padding = GridUtils.calculateIntelligentPadding(transform.k);
      const bounds = getVisibleCanvasBounds(transform, viewportWidth, viewportHeight, padding);

      // Validate bounds to prevent invalid rectangles
      if (bounds.width <= 0 || bounds.height <= 0) {
        console.warn('🚨 Grid: Invalid bounds calculated', bounds);
        return;
      }

      // Render layered rects via utility
      renderDualGridRects(gridLayer, bounds, patternId, majorPatternId);

      // Enhanced cache with all necessary data and performance tracking
      const renderTime = performance.now() - startTime;
      gridPerformanceRef.current?.recordRender(renderTime);

      // Store current viewport size for debugging/inspection
      gridLayer.attr(
        'data-grid-size',
        `${Math.round(viewportWidth)}x${Math.round(viewportHeight)}`
      );

      // Update grid cache
      const now = performance.now();
      const cacheKey = JSON.stringify({
        k: transform.k,
        x: Math.round(transform.x),
        y: Math.round(transform.y),
        vw: Math.round(viewportWidth),
        vh: Math.round(viewportHeight),
      });
      gridCacheRef.current = {
        transform: cacheKey,
        pattern: `${patternId},${majorPatternId}`,
        lastRenderTime: now,
        viewport: { width: viewportWidth, height: viewportHeight },
        bounds,
      };

      // Reduced performance logging - only show summary periodically in dev
      if (process.env.NODE_ENV === 'development' && gridPerformanceRef.current) {
        const metrics = gridPerformanceRef.current.getMetrics();
        if (metrics.renderCount % GRID_CONSTANTS.PERFORMANCE_LOG_INTERVAL === 0) {
          dbg.warn('🔍 Grid Performance Summary (every 100 renders)', {
            renderTime: `${renderTime.toFixed(2)}ms`,
            avgRenderTime: `${metrics.avgRenderTime.toFixed(2)}ms`,
            cacheHitRate: `${metrics.cacheHitRate.toFixed(1)}%`,
            totalRenders: metrics.renderCount,
          });
        }
        const report = gridPerformanceRef.current.getPerformanceReport();
        if (
          (report.status === 'warning' || report.status === 'poor') &&
          metrics.renderCount % GRID_CONSTANTS.PERFORMANCE_WARNING_INTERVAL === 0
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
      const keysToDelete = Array.from(nodePositionCacheRef.current.keys()).slice(
        0,
        nodePositionCacheRef.current.size - MAX_CACHE_SIZE
      );
      keysToDelete.forEach((key) => nodePositionCacheRef.current.delete(key));
      if (process.env.NODE_ENV === 'development') {
        dbg.warn(`🧹 Cleaned position cache: ${keysToDelete.length} entries`);
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
  const rafScheduler = useMemo(() => createRafScheduler(), []);
  const scheduleRAF = useCallback(
    (callback: () => void, priority: CallbackPriority = 'normal') =>
      rafScheduler.scheduleRAF(callback, priority),
    [rafScheduler]
  );

  // Enhanced Z-Index Management with change detection to reduce DOM manipulation
  const zIndexManager = useMemo(
    () =>
      createZIndexManager({
        getNodeLayer: () => nodeLayerRef.current,
        getAllNodeElements: () => allNodeElementsRef.current,
        isNodeSelected,
        isDragging: () => isContextDragging(),
        getDraggedNodeId,
        scheduleRAF,
      }),
    [isNodeSelected, scheduleRAF, isContextDragging, getDraggedNodeId]
  );
  const organizeNodeZIndex = useCallback(() => zIndexManager.organizeNodeZIndex(), [zIndexManager]);
  // setNodeAsDragging no longer used directly; zIndexManager manages layering internally.

  // Optimized node lookup with memoization
  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    nodes.forEach((node: WorkflowNode) => map.set(node.id, node));
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
  const currentDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

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
      designerMode?: 'workflow' | 'architecture'
    ) => {
      // Get the node to check its bottom ports configuration
      const node = nodeMap.get(nodeId);
      if (!node?.bottomPorts) {
        return false;
      }

      const port = node.bottomPorts.find((p) => p.id === portId);
      if (!port) {
        return false;
      }

      // Count existing connections for this port
      const existingConnections = connections.filter(
        (conn: Connection) => conn.sourceNodeId === nodeId && conn.sourcePortId === portId
      );

      // In architecture mode, allow multiple connections across all bottom ports
      if (designerMode === 'architecture') {
        return true;
      }

      // Original workflow mode logic (stricter validation)
      switch (portId) {
        case 'ai-model':
          // AI Model port: Only allows 1 connection (can replace existing)
          // Show plus button only when no connection exists
          return existingConnections.length === 0;

        case 'memory':
          // Memory port: Typically allows only 1 connection
          return existingConnections.length === 0;

        case 'tool':
          // Tool port: Allows multiple connections (array of tools)
          return true;

        default:
          // For other ports, check if dataType suggests multiple connections
          if (port.dataType === 'array') {
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
    (nodeId: string, portId: string, portType: 'input' | 'output') => {
      if (portType === 'input') {
        return (
          connections.filter(
            (conn: Connection) => conn.targetNodeId === nodeId && conn.targetPortId === portId
          ).length > 1
        );
      } else {
        return (
          connections.filter(
            (conn: Connection) => conn.sourceNodeId === nodeId && conn.sourcePortId === portId
          ).length > 1
        );
      }
    },
    [connections]
  );

  // Legacy endpoint detection removed - no longer needed since legacy badges are removed

  // Enhanced port highlighting for architecture mode
  const getPortHighlightClass = useCallback(
    (nodeId: string, portId: string, portType: 'input' | 'output') => {
      if (workflowContextState.designerMode !== 'architecture') {
        return '';
      }

      const isMultiple = hasMultipleConnections(nodeId, portId, portType);
      const classes = [];

      if (isMultiple) {
        classes.push('has-multiple-connections');
      }

      return classes.join(' ');
    },
    [workflowContextState.designerMode, hasMultipleConnections]
  );

  // Helper function to create a filled polygon from a path with thickness
  const createFilledPolygonFromPath = useCallback(
    (pathString: string, thickness: number = 6): string => {
      if (!pathString) {
        return '';
      }

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
        if (!svgContainer) {
          return pathString;
        }
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

        if (points.length < 2) {
          return pathString;
        }

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
        polygonPath += ' Z';

        return polygonPath;
      } catch (error) {
        console.warn('Error creating filled polygon:', error);
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
        workflowContextState.designerMode || 'workflow'
      }`;
      const cached = dimensionsCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const shapeDimensions = getShapeAwareDimensions(node);

      // Architecture mode: fixed rounded-square sizing + right-side labels
      if (workflowContextState.designerMode === 'architecture') {
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
        nodeVariant === 'compact'
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

  // Helper: shape-specific port positions calculators (extracted to reduce complexity)
  // Rect-like (rectangle/square) port positions. For squares, the rendered path uses an inner 0.8 scale
  // (see shape-utils.getShapePath for 'square'), so use the inner edge for port centers to match
  // connection anchors from shape-utils.getPortPositions.
  function computeRectPortPositions(
    dimensions: { width: number; height: number },
    portCount: number,
    portType: 'input' | 'output',
    shape: 'rectangle' | 'square'
  ): Array<{ x: number; y: number }> {
    const spacing = dimensions.height / (portCount + 1);
    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < portCount; i++) {
      const y = -dimensions.height / 2 + spacing * (i + 1);
      // For squares, the path inner half-size is width/2 * 0.8; for rectangles it's width/2
      const half = shape === 'square' ? (dimensions.width / 2) * 0.8 : dimensions.width / 2;
      const x = portType === 'input' ? -half : half;
      positions.push({ x, y });
    }
    return positions;
  }

  function computeCirclePortPositions(
    dimensions: { width: number; height: number },
    portCount: number
  ): Array<{ x: number; y: number }> {
    const angleStep = (Math.PI * 2) / Math.max(1, portCount);
    const radius = Math.min(dimensions.width, dimensions.height) / 2;
    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < portCount; i++) {
      const angle = angleStep * i;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      positions.push({ x, y });
    }
    return positions;
  }

  function computeDiamondPortPositions(
    dimensions: { width: number; height: number },
    portCount: number,
    portType: 'input' | 'output'
  ): Array<{ x: number; y: number }> {
    const halfWidth = dimensions.width / 2;
    const effectiveHalfHeight = (dimensions.height / 2) * 0.75;
    const effectiveHeight = effectiveHalfHeight * 2;
    const spacing = Math.min(25, effectiveHeight / (portCount + 1));
    const startY = -((portCount - 1) * spacing) / 2;
    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < portCount; i++) {
      const y = startY + i * spacing;
      const widthAtY = Math.max(
        0,
        halfWidth * (1 - Math.min(1, Math.abs(y) / Math.max(1e-6, effectiveHalfHeight)))
      );
      const x = (portType === 'input' ? -1 : 1) * widthAtY;
      positions.push({ x, y });
    }
    return positions;
  }

  // Memoized port positions calculation using configurable dimensions
  const getConfigurablePortPositions = useMemo(() => {
    const positionsCache = new Map<string, any>();

    return (node: WorkflowNode, portType: 'input' | 'output') => {
      const cacheKey = `${node.id}-${portType}-${nodeVariant}-${
        workflowContextState.designerMode || 'workflow'
      }`;

      if (positionsCache.has(cacheKey)) {
        return positionsCache.get(cacheKey);
      }

      const shape = getNodeShape(node.type);
      const dimensions = getConfigurableDimensions(node);
      const portCount = portType === 'input' ? node.inputs.length : node.outputs.length;

      let positions: Array<{ x: number; y: number }> = [];
      if (shape === 'rectangle' || shape === 'square') {
        positions = computeRectPortPositions(dimensions, portCount, portType, shape);
      } else if (shape === 'circle') {
        positions = computeCirclePortPositions(dimensions, portCount);
      } else if (shape === 'diamond') {
        positions = computeDiamondPortPositions(dimensions, portCount, portType);
      }

      positionsCache.set(cacheKey, positions);
      return positions;
    };
  }, [nodeVariant, workflowContextState.designerMode, getConfigurableDimensions]);

  // Hit-test radius accessor to reuse across drag-end handlers
  const getHitTestPortRadius = useCallback(
    (pd: PortDatum) => getConfigurableDimensions(pd.nodeData).portRadius || 6,
    [getConfigurableDimensions]
  );

  // Use imported resolveDragEndTarget util with getHitTestPortRadius

  // Removed local bottom port layout; use calculatePortPosition for accuracy across modes/variants

  // Enhanced visual feedback system with batching and caching
  const processBatchedVisualUpdates = useCallback(() => {
    if (visualUpdateQueueRef.current.size === 0) {
      return;
    }
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
      if (performance.now() - start > MAX_MS) {
        break;
      }
      const element = allNodeElementsRef.current.get(nodeId);
      if (!element) {
        visualUpdateQueueRef.current.delete(nodeId);
        continue;
      }
      const nodeElement = d3.select(element);
      const nodeBackground = nodeElement.select('.node-background');
      nodeElement
        .style('opacity', 0.9)
        .style('filter', 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))');
      nodeBackground.attr('stroke', '#2196F3').attr('stroke-width', 3);
      visualUpdateQueueRef.current.delete(nodeId);
    }
    if (visualUpdateQueueRef.current.size > 0) {
      batchedVisualUpdateRef.current = requestAnimationFrame(processBatchedVisualUpdates);
    } else {
      batchedVisualUpdateRef.current = null;
    }
    const duration = performance.now() - start;
    adaptive.lastDuration = duration;
    const usage = duration / MAX_MS;
    if (usage < 0.6 && adaptive.vBudget < 6) {
      adaptive.vBudget += 0.25;
    } else if (usage > 0.9 && adaptive.vBudget > 2) {
      adaptive.vBudget -= 0.25;
    }
  }, []);

  // Unified drop state management
  // setDropFeedback removed; visual feedback handled via CSS and existing state

  // applyDragVisualStyle removed; we set styles directly where needed

  // Memoized connection lookup for better drag performance
  const nodeConnectionsMap = useMemo(() => {
    const map = new Map<string, Connection[]>();
    connections.forEach((conn: Connection) => {
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
    if (connectionUpdateQueueRef.current.size === 0) {
      return;
    }

    // PERFORMANCE: Use cached DOM selections to avoid repeated queries
    const connectionLayer = getCachedSelection('connectionLayer');
    if (!connectionLayer) {
      return;
    }

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
      if (performance.now() - startTime > maxProcessingTime) {
        break;
      }

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
        const pathElement = element.select('.connection-path');
        const newPath = getConnectionPath(conn, true);
        pathElement.attr('d', newPath);
      });

      connectionUpdateQueueRef.current.delete(nodeId);
    }

    // Schedule next batch if there are more connections to process
    if (connectionUpdateQueueRef.current.size > 0) {
      batchedConnectionUpdateRef.current = requestAnimationFrame(processBatchedConnectionUpdates);
    } else {
      batchedConnectionUpdateRef.current = null;
    }
    const duration = performance.now() - startTime;
    connAdaptive.lastDuration = duration;
    const usage = duration / maxProcessingTime;
    if (usage < 0.55 && connAdaptive.cBudget < 10) {
      connAdaptive.cBudget += 0.5;
    } else if (usage > 0.9 && connAdaptive.cBudget > 4) {
      connAdaptive.cBudget -= 0.5;
    }
  }, [nodeConnectionsMap, getConnectionPath, getCachedSelection]); // Include required dependencies

  const updateDraggedNodePosition = useCallback(
    (nodeId: string, newX: number, newY: number) => {
      // Always update node position immediately for smooth dragging
      if (draggedElementRef.current) {
        draggedElementRef.current.attr('transform', `translate(${newX}, ${newY})`);
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
    [nodeConnectionsMap, processBatchedConnectionUpdates, dragUpdateThrottle, updateConnDragPos]
  );

  const resetNodeVisualStyle = useCallback(
    (nodeElement: any, nodeId: string) => {
      const isSelected = isNodeSelected(nodeId);
      const nodeBackground = nodeElement.select('.node-background');
      const node = nodeMap.get(nodeId);

      if (isSelected) {
        nodeElement
          .style('opacity', 1)
          .style('filter', 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))');
        nodeBackground.attr('stroke', '#2196F3').attr('stroke-width', 3);
      } else {
        nodeElement.style('opacity', 1).style('filter', 'none');
        if (node) {
          nodeBackground
            .attr('stroke', getNodeColor(node.type, node.status))
            .attr('stroke-width', 2);
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
    zIndexManager.clearState();
    rafScheduler.clear();
    if (batchedConnectionUpdateRef.current) {
      cancelAnimationFrame(batchedConnectionUpdateRef.current);
      batchedConnectionUpdateRef.current = null;
    }
    if (batchedVisualUpdateRef.current) {
      cancelAnimationFrame(batchedVisualUpdateRef.current);
      batchedVisualUpdateRef.current = null;
    }
    // rafScheduler handles internal RAF cleanup
  }, [clearConnCache, clearAllDragPositions, zIndexManager, rafScheduler]);

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
      if (!nodeLayer || allNodeElementsRef.current.size === 0) {
        return;
      }

      const normalNodes: SVGGElement[] = [];
      const selectedNodes: SVGGElement[] = [];
      const draggingNodes: SVGGElement[] = [];

      allNodeElementsRef.current.forEach((element, nodeId) => {
        if (!nodeLayer.contains(element)) {
          return;
        }

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
      const orderedElements = [...normalNodes, ...selectedNodes, ...draggingNodes];

      orderedElements.forEach((element) => {
        if (nodeLayer.contains(element) && nodeLayer.lastChild !== element) {
          nodeLayer.appendChild(element);
        }
      });
    }
  }, [selectedNodes, isNodeSelected, isInitialized, isDragging, draggedNodeId]);

  // Monitor drag state changes to clean up DOM classes
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);

    // If we're not dragging, remove all dragging classes
    if (!isDragging) {
      svg.selectAll('.node.dragging').classed('dragging', false);
      // Clear draggedElementRef when not dragging
      if (draggedElementRef.current) {
        draggedElementRef.current = null;
      }
    }
  }, [isDragging, draggedNodeId, svgRef]);

  // Main D3 rendering effect - soon: nodes-focused (connections handled separately)
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    try {
      // Copy refs at the start of the effect for cleanup
      const currentSvgRef = svgRef.current;
      const allNodeElements = allNodeElementsRef.current;

      const svg = d3.select(currentSvgRef);
      // Initialize or reuse defs (do not clear to preserve markers between renders)
      let defs = svg.select<SVGDefsElement>('defs');
      if (defs.empty()) {
        defs = svg.append('defs');
      }

      // Background rect (ensure single)
      let bg = svg.select<SVGRectElement>('rect.svg-canvas-background');
      if (bg.empty()) {
        bg = svg.append('rect').attr('class', 'svg-canvas-background');
      }
      bg.attr('width', '100%').attr('height', '100%').attr('fill', '#f7f7f7');

      // Arrow markers with direction-aware positioning and optimized refX
      // Create directional arrow markers once (skip if already present)
      ensureArrowMarkers(
        defs as unknown as d3.Selection<SVGDefsElement, unknown, d3.BaseType, unknown>
      );

      // Layer hierarchy (ensure single instances)
      let g = svg.select<SVGGElement>('g.canvas-root');
      if (g.empty()) {
        g = svg.append('g').attr('class', 'canvas-root');
      }
      const gridLayer = g.select<SVGGElement>('g.grid-layer');
      if (gridLayer.empty()) {
        g.append('g').attr('class', 'grid-layer').style('pointer-events', 'none');
      }
      let mainNodeLayer = g.select<SVGGElement>('g.node-layer');
      if (mainNodeLayer.empty()) {
        mainNodeLayer = g.append('g').attr('class', 'node-layer');
      }
      const connectionLayer = g.select<SVGGElement>('g.connection-layer');
      if (connectionLayer.empty()) {
        g.append('g').attr('class', 'connection-layer');
      }
      // const labelLayer = g.append('g').attr('class', 'label-layer') // No longer needed

      // Store node layer reference
      nodeLayerRef.current = mainNodeLayer.node() as SVGGElement;

      // Note: Grid creation moved to separate useEffect to prevent disappearing during drag

      // Zoom behavior
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 4])
        .on('zoom', (event) => {
          const transform = event.transform;
          const prevK = currentTransformRef.current.k;

          // Resolve current canvas root every time to avoid stale selection when layers are re-created
          if (svgRef.current) {
            const rootSel = d3.select(svgRef.current).select<SVGGElement>('g.canvas-root');
            if (!rootSel.empty()) {
              rootSel.attr('transform', transform.toString());
            }
          }
          if (onZoomLevelChange && prevK !== transform.k) {
            onZoomLevelChange(transform.k);
          }

          // Grid updates are handled by the dedicated grid effect reacting to canvasTransform

          onTransformChange?.(transform);

          // Keep connection preview endpoint pinned to cursor during canvas pan/zoom
          // This ensures the preview path updates visually while dragging the canvas
          if (isConnecting && connectionStart && svgRef.current) {
            const srcEvt: any = event.sourceEvent;
            if (srcEvt) {
              // Compute cursor position relative to canvas coordinates using current zoom transform
              const [screenX, screenY] = d3.pointer(srcEvt, svgRef.current as any);
              const [canvasX, canvasY] = transform.invert([screenX, screenY]);
              onPortDrag(canvasX, canvasY);
            }
          }

          // Force nodes to re-render on zoom change by updating their visual state
          if (Math.abs(transform.k - prevK) > 0.01) {
            mainNodeLayer.selectAll('.node').each(function (this: any, d: any) {
              const node = d3.select(this);
              // Force update by re-applying transform
              node.attr('transform', `translate(${d.x}, ${d.y})`);
            });
          }

          // Update ref after consumers have used previous value for comparisons
          currentTransformRef.current = transform;
        });

      // Bind zoom only once (skip if already initialized) and register behavior once
      if (svg.attr('data-zoom-init') !== 'true') {
        svg.call(zoom);
        svg.attr('data-zoom-init', 'true');
        onRegisterZoomBehavior?.(zoom);
      }

      // Set initial transform (not in dependencies to avoid infinite loop)
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(canvasTransform.x, canvasTransform.y).scale(canvasTransform.k)
      );

      // Optimized drag functions
      // Concise wrapper for creating standard port drag callbacks with shared params
      const makePortDragHandlers = (opts?: { logTag?: string; requireTargetOnEnd?: boolean }) =>
        createPortDragCallbacks({
          startAsType: 'output',
          onPortDragStart,
          onPortDrag,
          onPortDragEnd,
          nodes,
          getCapturedStart: () => dragConnectionDataRef.current,
          setCapturedStart: (
            v: { nodeId: string; portId: string; type: 'input' | 'output' } | null
          ) => {
            dragConnectionDataRef.current = v as any;
          },
          getHitTestPortRadius,
          resolve: resolveDragEndTarget,
          ...opts,
        });

      function dragStarted(this: any, event: any, d: WorkflowNode) {
        // Guard: while connecting, do not allow node dragging to start
        if (isConnectingRef.current || dragConnectionDataRef.current) {
          event?.sourceEvent?.stopPropagation?.();
          return;
        }

        const svgElement = svgRef.current!;
        const sourceEvent = event.sourceEvent || event;
        const [mouseX, mouseY] = d3.pointer(sourceEvent, svgElement);
        const transform = d3.zoomTransform(svgElement);
        const [canvasX, canvasY] = transform.invert([mouseX, mouseY]);

        const dragData = d as any;
        dragData.dragStartX = canvasX;
        dragData.dragStartY = canvasY;
        dragData.initialX = d.x;
        dragData.initialY = d.y;
        dragData.hasDragged = false;
        dragData.dragStartTime = Date.now();

        // Context: mark dragging and store element
        startDragging(d.id, { x: d.x, y: d.y });
        const nodeElement = d3.select(this);
        nodeElement.classed('dragging', true);
        draggedElementRef.current = nodeElement;
      }

      function dragged(this: any, event: any, d: WorkflowNode) {
        const dragData = d as any;
        if (dragData.initialX === undefined || dragData.initialY === undefined) {
          return;
        }

        const svgElement = svgRef.current!;
        const sourceEvent = event.sourceEvent || event;
        const [mouseX, mouseY] = d3.pointer(sourceEvent, svgElement);
        const transform = d3.zoomTransform(svgElement);
        const [currentCanvasX, currentCanvasY] = transform.invert([mouseX, mouseY]);

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
        if (!nodeElement.classed('dragging')) {
          nodeElement.classed('dragging', true);
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
        nodeElement.classed('dragging', false);

        // Clear draggedElementRef if it points to this element
        if (draggedElementRef.current && draggedElementRef.current.node() === this) {
          draggedElementRef.current = null;
        }

        // Clear drag position tracking and remove from update queues
        currentDragPositionsRef.current.delete(d.id);
        connectionUpdateQueueRef.current.delete(d.id);
        visualUpdateQueueRef.current.delete(d.id);

        // Reset visual styles
        resetNodeVisualStyle(nodeElement, d.id);

        // Reorganize z-index immediately after drag ends to restore proper order
        zIndexManager.organizeNodeZIndexImmediate(); // immediate layering

        // If no significant drag occurred, treat as click
        if (!hasDragged && event.sourceEvent && dragDuration < 500) {
          const ctrlKey = event.sourceEvent.ctrlKey || event.sourceEvent.metaKey;
          onNodeClick(d, ctrlKey);
        }
      }

      // Connections are rendered in the dedicated connections-only effect.
      // Connection preview is also handled in the connection state effect.

      // Render nodes via core function
      const dragBehavior = d3
        .drag<SVGGElement, WorkflowNode>()
        .container(g.node() as any)
        .clickDistance(5)
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded);

      const { nodeEnter, nodeGroups } = createNodeGroups<WorkflowNode>(
        mainNodeLayer as unknown as d3.Selection<SVGGElement, unknown, SVGGElement, unknown>,
        nodes,
        {
          getId: (d) => d.id,
          getTransform: (d) => `translate(${d.x}, ${d.y})`,
          cursor: 'move',
          onExit: (d) => {
            allNodeElementsRef.current.delete(d.id);
          },
          onEnterEach: (d, el) => {
            // Register node element in our centralized management
            allNodeElementsRef.current.set(d.id, el);
            if (isDragging && draggedNodeId === d.id) {
              const nodeElement = d3.select(el);
              nodeElement.classed('dragging', true);
              draggedElementRef.current = nodeElement;
            }
          },
          dragBehavior,
        }
      );

      // Create baseline node children elements once (and ensure for merged nodes)
      createNodeElements(nodeEnter as any, nodeGroups as any);

      // Ensure node background path (shape) is computed and applied
      updateNodeBackgroundPath(nodeGroups as any, {
        designerMode: workflowContextState.designerMode as any,
        getConfigurableDimensions: getConfigurableDimensions as any,
        getNodeShape: getNodeShape as any,
        getNodeShapePath: (d: any, radius: any) => getNodeShapePath(d, radius),
      });

      // Restore node background interactions (click, dblclick, dragover/drop)
      attachNodeBackgroundEvents(nodeEnter as any, {
        isDragging: isContextDragging(),
        isConnecting: isConnectingRef.current,
        canDropOnNode: _canDropOnNodeProp ?? undefined,
        onNodeClick: (node, multi) => onNodeClick(node, multi),
        onNodeDoubleClick: (node) => _onNodeDoubleClick?.(node),
        setDropFeedback: () => {},
        workflowContextState: { designerMode: workflowContextState.designerMode as any },
        connections,
        connectionStart: connectionStartRef.current as any,
        onPortDragEnd: (targetNodeId?: string, targetPortId?: string) => {
          onPortDragEnd(targetNodeId, targetPortId);
        },
      });

      // Enhanced: Immediately preserve dragging state after merge operation
      // This must happen before any other node operations to prevent class removal
      nodeGroups.each(function (d: any) {
        const nodeElement = d3.select(this);
        const currentDraggedNodeId = getDraggedNodeId();
        const isCurrentlyDragging = isContextDragging();

        if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
          // Force apply dragging class immediately after merge
          nodeElement.classed('dragging', true);
          // Ensure draggedElementRef points to the correct merged element
          if (draggedElementRef.current === null || draggedElementRef.current.node() !== this) {
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

      // Update node background stroke width based on drag state
      nodeGroups.select('.node-background').attr('stroke-width', (d: any) => {
        // CRITICAL: Skip stroke width update for actively dragged node
        const currentDraggedNodeId = getDraggedNodeId();
        const isCurrentlyDragging = isContextDragging();

        if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
          // Return thicker width for dragged node
          return 3;
        }

        return 2;
      });

      // Update architecture outline box to slightly exceed node bounds with per-type customization
      updateArchOutline(nodeGroups as any, {
        isArchMode: workflowContextState.designerMode === 'architecture',
        getNodeTypeInfo,
        getConfigurableDimensions,
      });

      // Apply visual styling to all nodes using centralized system with improved stability
      applyNodeVisualState(nodeGroups as any, {
        isNodeSelected,
        getDraggedNodeId,
        isContextDragging,
        getNodeColor,
      });

      // Mark as initialized and organize z-index
      if (!isInitialized) {
        setIsInitialized(true);
        // Initial z-index organization - use immediate execution for initial setup
        setTimeout(() => {
          if (!isDragging) {
            zIndexManager.organizeNodeZIndexImmediate(); // immediate initialization
          }
        }, 0);
      }

      // Node icon containers are created in createNodeElements

      updateIconsAndLabels(nodeGroups as any, defs, {
        designerMode: workflowContextState.designerMode as any,
        getConfigurableDimensions,
        NodeTypes,
        getNodeIcon,
        renderIconUse,
      });

      // Legacy badge update removed - badge has been completely removed

      // Render simple ports for both variants
      // Input ports - DISABLED drag/click interactions for connection creation
      const inputPortGroups = nodeGroups
        .select('g.input-ports')
        .selectAll('.input-port-group')
        .data(
          (d: any) =>
            d.inputs.map((input: any) => ({
              ...input,
              nodeId: d.id,
              nodeData: d,
            })),
          (d: any) => d.id
        )
        .join('g')
        .attr('data-port-id', (d: any) => d.id)
        .attr('data-node-id', (d: any) => d.nodeId)
        .attr('class', 'port-group input-port-group')
        .attr('role', 'button')
        .attr('tabindex', -1)
        .attr('aria-label', (d: any) => `Input port ${d.id} on ${d.nodeData?.label ?? d.nodeId}`)
        .on('keydown.access', (event: KeyboardEvent, d: any) => {
          const isEnter = event.key === 'Enter';
          const isSpace = event.key === ' ' || event.key === 'Spacebar';
          if (!(isEnter || isSpace)) {
            return;
          }
          if (!(isConnectingRef.current && connectionStartRef.current)) {
            return;
          }
          // Only allow finish when starting from output
          if (connectionStartRef.current?.type !== 'output') {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const canDrop = canDropOnPort?.(d.nodeId, d.id, 'input') ?? false;
          if (canDrop) {
            const cs = connectionStartRef.current;
            onPortDragEndProp?.(d.nodeId, d.id, undefined, undefined);
            dispatch?.({ type: 'CLEAR_CONNECTION_STATE' });
            if (cs) {
              announce(`Connected ${cs.nodeId} ${cs.portId} to ${d.nodeId} ${d.id}`);
            }
            keyboardConnectingRef.current = false;
          } else {
            announce('Invalid target port');
          }
        });

      inputPortGroups.selectAll('circle').remove();
      inputPortGroups
        .append('circle')
        .attr('class', 'port-circle input-port-circle')
        .attr('cx', (d: any, i: number) => {
          const positions = getConfigurablePortPositions(d.nodeData, 'input');
          return positions[i]?.x || 0;
        })
        .attr('cy', (d: any, i: number) => {
          const positions = getConfigurablePortPositions(d.nodeData, 'input');
          return positions[i]?.y || 0;
        })
        .attr('r', (d: any) => getConfigurableDimensions(d.nodeData).portRadius || 6)
        .attr('fill', getPortColor('any'))
        .attr('stroke', '#333')
        .attr('stroke-width', 2)
        .style('pointer-events', 'none'); // Circle stays non-interactive; group handles keyboard

      //console.log('🔵 Created', inputPortGroups.selectAll('circle').size(), 'input port circles')

      // Port capacity indicators removed - they were cluttering the UI without adding value

      // Output ports
      const outputPortGroups = nodeGroups
        .select('g.output-ports')
        .selectAll('.output-port-group')
        .data(
          (d: any) =>
            d.outputs.map((output: any) => ({
              ...output,
              nodeId: d.id,
              nodeData: d,
            })),
          (d: any) => d.id
        )
        .join('g')
        .attr('data-port-id', (d: any) => d.id)
        .attr('data-node-id', (d: any) => d.nodeId)
        .attr('class', (d: any) => {
          // Check if this port has any connections
          const hasConnection = connections.some(
            (conn: Connection) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
          );
          return hasConnection
            ? 'port-group output-port-group connected'
            : 'port-group output-port-group';
        })
        .style('cursor', 'crosshair')
        .style('pointer-events', 'all')
        .attr('role', 'button')
        .attr('tabindex', -1)
        .attr('aria-label', (d: any) => `Output port ${d.id} on ${d.nodeData?.label ?? d.nodeId}`)
        .on('click', (event: any, d: any) => {
          // Ignore click-to-start while a drag-connection is active
          if (isConnectingRef.current || dragConnectionDataRef.current) {
            event.stopPropagation();
            return;
          }
          event.stopPropagation();
          onPortClick(d.nodeId, d.id, 'output');
          announce(
            `Connection started from ${d.nodeData?.label ?? d.nodeId} output ${d.id}. Tab to an input port and press Enter to connect, or press Escape to cancel.`
          );
        })
        .on('keydown.access', (event: KeyboardEvent, d: any) => {
          const isEnter = event.key === 'Enter';
          const isSpace = event.key === ' ' || event.key === 'Spacebar';
          if (!(isEnter || isSpace)) {
            return;
          }
          if (isConnectingRef.current) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          // Start keyboard-driven connection
          dragConnectionDataRef.current = { nodeId: d.nodeId, portId: d.id, type: 'output' };
          dispatch?.({
            type: 'START_CONNECTION',
            payload: { nodeId: d.nodeId, portId: d.id, type: 'output' },
          });
          keyboardConnectingRef.current = true;
          announce(
            `Connection started from ${d.nodeData?.label ?? d.nodeId} output ${d.id}. Tab to an input port and press Enter to connect, or press Escape to cancel.`
          );
          // Move focus hint: next tabbable element is likely an input port group; tab order is global
        })
        .call(
          d3
            .drag<any, any>()
            .clickDistance(4)
            .on('start', makePortDragHandlers({ logTag: 'Output port' }).onStart)
            .on('drag', makePortDragHandlers({ logTag: 'Output port' }).onDrag)
            .on('end', makePortDragHandlers({ logTag: 'Output port' }).onEnd)
        );

      // Create output port circles
      outputPortGroups.selectAll('circle').remove();
      outputPortGroups
        .append('circle')
        .attr('class', 'port-circle output-port-circle')
        .attr('cx', (d: any, i: number) => {
          const positions = getConfigurablePortPositions(d.nodeData, 'output');
          return positions[i]?.x || 0;
        })
        .attr('cy', (d: any, i: number) => {
          const positions = getConfigurablePortPositions(d.nodeData, 'output');
          return positions[i]?.y || 0;
        })
        .attr('r', (d: any) => getConfigurableDimensions(d.nodeData).portRadius || 6)
        .attr('fill', getPortColor('any'))
        .attr('stroke', '#8d8d8d')
        .attr('stroke-width', 2);

      //console.log('🔴 Created', outputPortGroups.selectAll('circle').size(), 'output port circles')

      // Output port capacity indicators removed - they were cluttering the UI without adding value

      // Architecture mode: four side ports (top/right/bottom/left) as virtual ports
      const isArchitectureMode = workflowContextState.designerMode === 'architecture';
      const sidePortGroups = nodeGroups
        .select('g.side-ports')
        .selectAll('.side-port-group')
        .data((d: any) => {
          if (!isArchitectureMode) {
            return [];
          }
          const dim = getConfigurableDimensions(d);
          const halfW = (dim.width || NODE_WIDTH) / 2;
          const halfH = (dim.height || NODE_MIN_HEIGHT) / 2;
          // Define side ports with local positions (relative to node center)
          const sides = [
            { id: '__side-top', x: 0, y: -halfH, kind: 'input' },
            { id: '__side-right', x: halfW, y: 0, kind: 'output' },
            { id: '__side-bottom', x: 0, y: halfH, kind: 'output' },
            { id: '__side-left', x: -halfW, y: 0, kind: 'input' },
          ];
          // Business rule:
          // - If node has inputs, hide left side port (input)
          // - If node has outputs, hide right side port (output)
          const hasMultipleInputs = Array.isArray(d.inputs) && d.inputs.length > 1;
          const hasMultipleOutputs = Array.isArray(d.outputs) && d.outputs.length > 1;
          const filtered = sides.filter((s) => {
            if (s.id === '__side-left' && hasMultipleInputs) {
              return false;
            }
            if (s.id === '__side-right' && hasMultipleOutputs) {
              return false;
            }
            return true;
          });
          return filtered.map((s) => ({
            nodeId: d.id,
            nodeData: d,
            id: s.id,
            kind: s.kind,
            x: s.x,
            y: s.y,
          }));
        })
        .join('g')
        .attr('class', (d: any) => {
          // Treat side ports as omni-ports: highlight for both input/output multiplicity and connected state
          const isConnected = connections.some(
            (conn: Connection) =>
              (conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id) ||
              (conn.targetNodeId === d.nodeId && conn.targetPortId === d.id)
          );
          const inputHL = getPortHighlightClass(d.nodeId, d.id, 'input');
          const outputHL = getPortHighlightClass(d.nodeId, d.id, 'output');
          const classes = ['side-port-group', 'port-group'];
          // Architecture mode rule update:
          // - Always keep side-ports as 'side-port-group' only (no input-port-group/output-port-group)
          if (isConnected) {
            classes.push('connected');
          }
          if (inputHL) {
            classes.push(inputHL);
          }
          if (outputHL) {
            classes.push(outputHL);
          }
          return classes.join(' ');
        })
        .style('cursor', 'crosshair')
        .style('pointer-events', 'all')
        .on('click', (event: any, d: any) => {
          // Click-to-start like output ports
          event.stopPropagation();
          onPortClick(d.nodeId, d.id, d.kind === 'input' ? 'input' : 'output');
        })
        .call(
          d3
            .drag<any, any>()
            .clickDistance(4)
            .on('start', makePortDragHandlers().onStart)
            .on('drag', makePortDragHandlers().onDrag)
            .on('end', makePortDragHandlers().onEnd)
        );

      // Draw side port rectangles
      sidePortGroups.selectAll('rect').remove();
      sidePortGroups
        .append('rect')
        .attr('class', 'side-port-rect')
        .attr('x', (d: any) => d.x - 6)
        .attr('y', (d: any) => d.y - 6)
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', '#CCCCCC')
        .attr('stroke', '#8d8d8d')
        .attr('stroke-width', 1.5)
        .style('pointer-events', 'all'); // allow hit-testing so group drag handlers receive events

      // Bottom ports - สำหรับ AI Agent nodes ที่มี bottomPorts
      const bottomPortGroups = nodeGroups
        .filter((d: any) => d.bottomPorts && d.bottomPorts.length > 0)
        .select('g.bottom-ports')
        .selectAll('.bottom-port-group')
        .data(
          (d: any) => {
            if (!d.bottomPorts) {
              return [];
            }
            return d.bottomPorts.map((port: any) => ({
              ...port,
              nodeId: d.id,
              nodeData: d,
            }));
          },
          (d: any) => d.id
        )
        .join('g')
        .attr('data-port-id', (d: any) => d.id)
        .attr('data-node-id', (d: any) => d.nodeId)
        .attr('class', 'bottom-port-group')
        .style('cursor', 'crosshair')
        .style('pointer-events', 'all')
        // Add drag behavior for bottom port diamonds
        .call(
          d3
            .drag<any, any>()
            .clickDistance(4)
            .on(
              'start',
              makePortDragHandlers({ logTag: 'Bottom port diamond', requireTargetOnEnd: true })
                .onStart
            )
            .on(
              'drag',
              makePortDragHandlers({ logTag: 'Bottom port diamond', requireTargetOnEnd: true })
                .onDrag
            )
            .on(
              'end',
              makePortDragHandlers({ logTag: 'Bottom port diamond', requireTargetOnEnd: true })
                .onEnd
            )
        );

      // Create bottom port diamonds
      bottomPortGroups.selectAll('path').remove();
      bottomPortGroups
        .append('path')
        .attr('class', 'bottom-port-diamond')
        .attr('d', (d: any) => {
          const size = getConfigurableDimensions(d.nodeData).portRadius || 6;
          // Create diamond shape: move to top, line to right, line to bottom, line to left, close
          return `M 0,${-size} L ${size},0 L 0,${size} L ${-size},0 Z`;
        })
        .attr('transform', (d: any) => {
          // Use shared util to get absolute bottom port position, then convert to node-relative
          const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', nodeVariant);
          const relX = abs.x - d.nodeData.x;
          const relY = abs.y - d.nodeData.y;
          return `translate(${relX}, ${relY})`;
        })
        .attr('fill', (d: any) => {
          if (isConnecting && connectionStart && connectionStart.type === 'output') {
            const canDrop = canDropOnPort ? canDropOnPort(d.nodeId, d.id, 'input') : false;
            return canDrop ? '#4CAF50' : '#ff5722';
          }
          return '#A8A9B4'; // Beautiful pastel gray tone
        })
        .attr('stroke', 'none'); // No border

      // Add connector lines from bottom ports (only for ports without connections OR when node is selected)
      bottomPortGroups.selectAll('line').remove();
      bottomPortGroups
        .append('line')
        .attr('class', 'bottom-port-connector')
        .attr('x1', (d: any) => {
          const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', nodeVariant);
          return abs.x - d.nodeData.x;
        })
        .attr('y1', (d: any) => {
          const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', nodeVariant);
          return abs.y - d.nodeData.y;
        })
        .attr('x2', (d: any) => {
          const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', nodeVariant);
          return abs.x - d.nodeData.x;
        })
        .attr('y2', (d: any) => {
          const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', nodeVariant);
          const posY = abs.y - d.nodeData.y;
          const hasConnection = connections.some(
            (conn: Connection) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
          );
          const nodeIsSelected = isNodeSelected(d.nodeId);
          let shouldShowLine = false;
          if (!hasConnection) {
            shouldShowLine = true;
          } else if (nodeIsSelected) {
            shouldShowLine = canBottomPortAcceptConnection(
              d.nodeId,
              d.id,
              connections,
              workflowContextState.designerMode
            );
          }
          return shouldShowLine ? posY + 16 : posY;
        })
        .attr('stroke', (d: any) => {
          // Different colors for selected nodes based on connection capability
          const nodeIsSelected = isNodeSelected(d.nodeId);
          const hasConnection = connections.some(
            (conn: Connection) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
          );

          if (nodeIsSelected && hasConnection) {
            const canAcceptMore = canBottomPortAcceptConnection(
              d.nodeId,
              d.id,
              connections,
              workflowContextState.designerMode
            );
            if (canAcceptMore) {
              return '#4CAF50'; // Green for ports that can accept more connections (like 'tool')
            }
          }
          return '#A8A9B4'; // Default pastel gray
        })
        .attr('stroke-width', (d: any) => {
          const nodeIsSelected = isNodeSelected(d.nodeId);
          const hasConnection = connections.some(
            (conn: Connection) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
          );

          if (nodeIsSelected && hasConnection) {
            return 3; // Thicker line for selected nodes with connections
          }
          return 2; // Default thickness
        })
        .style('pointer-events', 'none');

      // Add plus buttons and labels to bottom port groups (integrated approach)
      bottomPortGroups.each(function (d: any) {
        const group = d3.select(this);

        // Check if this bottom port already has a connection
        const hasConnection = connections.some(
          (conn: Connection) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
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
          if (process.env.NODE_ENV === 'development') {
            dbg.warn(
              `🔍 Port ${d.id} on selected node ${d.nodeId}: canAccept=${shouldShowButton}, hasConnection=${hasConnection}`
            );
          }
        } else {
          // When node is not selected, show only for unconnected ports (original behavior)
          shouldShowButton = !hasConnection;
        }

        // Remove existing plus button and label
        group.selectAll('.plus-button-container').remove();
        group.selectAll('.bottom-port-label-container').remove();

        // Add plus button if needed
        if (shouldShowButton) {
          const node = nodes.find((n: WorkflowNode) => n.id === d.nodeId);
          if (node) {
            const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', nodeVariant);
            const x = abs.x - d.nodeData.x;
            const y = abs.y - d.nodeData.y + 36; // Beyond the connector line

            const plusButtonContainer = group
              .append('g')
              .attr('class', 'plus-button-container')
              .attr('transform', `translate(${x}, ${y})`)
              .style('cursor', 'crosshair')
              .style('pointer-events', 'all');

            const plusButton = plusButtonContainer
              .append('g')
              .attr('class', 'plus-button')
              .style('cursor', 'crosshair')
              .style('pointer-events', 'all')
              .call(
                d3
                  .drag<any, any>()
                  .clickDistance(4)
                  .on('start', (event: any) => {
                    dbg.warn('🚀 Plus button drag START:', d.nodeId, d.id);
                    event.sourceEvent.stopPropagation();
                    event.sourceEvent.preventDefault();

                    // Start connection from bottom port
                    onPortDragStart(d.nodeId, d.id, 'output');
                  })
                  .on('drag', (event: any) => {
                    // Get canvas coordinates
                    const [x, y] = d3.pointer(
                      event.sourceEvent,
                      event.sourceEvent.target.ownerSVGElement
                    );
                    const transform = d3.zoomTransform(event.sourceEvent.target.ownerSVGElement);
                    const [canvasX, canvasY] = transform.invert([x, y]);

                    // Update connection preview
                    onPortDrag(canvasX, canvasY);
                  })
                  .on('end', (event: any) => {
                    dbg.warn('🚀 Plus button drag END');
                    const svgElement = event.sourceEvent.target.ownerSVGElement as SVGSVGElement;
                    const currentTransform = d3.zoomTransform(svgElement);
                    const [screenX, screenY] = d3.pointer(event.sourceEvent, svgElement);
                    const [canvasX, canvasY] = currentTransform.invert([screenX, screenY]);
                    const result = resolveDragEndTarget(
                      svgElement,
                      canvasX,
                      canvasY,
                      nodes,
                      null,
                      getHitTestPortRadius
                    );
                    if (result.nodeId && result.portId) {
                      onPortDragEnd(result.nodeId, result.portId, canvasX, canvasY);
                    } else {
                      onPortDragEnd(undefined, undefined, canvasX, canvasY);
                    }
                  })
              )
              .on('click', (event: any) => {
                // Fallback click handler for simple plus button clicks
                event.stopPropagation();
                onPlusButtonClick?.(d.nodeId, d.id);
              });
            // Removed mouseenter/mouseleave hover effects to prevent highlights during node interactions

            // Plus button background (square with rounded corners)
            plusButton
              .append('rect')
              .attr('class', 'plus-button-bg')
              .attr('x', -8)
              .attr('y', -8)
              .attr('width', 16)
              .attr('height', 16)
              .attr('rx', 2)
              .attr('ry', 2)
              .attr('fill', () => {
                // Different colors based on port type and connection capability
                if (hasConnection) {
                  // For connected ports that still allow more connections (like 'tool')
                  return '#4CAF50'; // Green for ports that can accept multiple connections
                }
                return '#8A8B96'; // Gray for unconnected ports
              })
              .attr('stroke', () => {
                // Add border for connected ports to make them more visible
                if (hasConnection && nodeIsSelected) {
                  return '#388E3C'; // Darker green border for multi-connection ports
                }
                return 'none';
              })
              .attr('stroke-width', () => {
                if (hasConnection && nodeIsSelected) {
                  return 1;
                }
                return 0;
              });

            // Plus symbol (horizontal line)
            plusButton
              .append('line')
              .attr('class', 'plus-horizontal')
              .attr('x1', -4)
              .attr('y1', 0)
              .attr('x2', 4)
              .attr('y2', 0)
              .attr('stroke', 'white')
              .attr('stroke-width', 1.5)
              .attr('stroke-linecap', 'round');

            // Plus symbol (vertical line)
            plusButton
              .append('line')
              .attr('class', 'plus-vertical')
              .attr('x1', 0)
              .attr('y1', -4)
              .attr('x2', 0)
              .attr('y2', 4)
              .attr('stroke', 'white')
              .attr('stroke-width', 1.5)
              .attr('stroke-linecap', 'round');
          }
        }

        // Add label for this bottom port
        const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', nodeVariant);
        const labelX = abs.x - d.nodeData.x;
        const labelY = abs.y - d.nodeData.y + 15; // Below the diamond

        const labelContainer = group
          .append('g')
          .attr('class', 'bottom-port-label-container')
          .attr('transform', `translate(${labelX}, ${labelY})`);

        // Label background
        const labelText = d.label || d.id;
        const textWidth = labelText.length * 5.5; // Better estimation for 10px font
        const padding = 8;

        labelContainer
          .append('rect')
          .attr('class', 'bottom-port-label-bg')
          .attr('x', -textWidth / 2 - padding / 2)
          .attr('y', -7)
          .attr('width', textWidth + padding)
          .attr('height', 12)
          .attr('fill', '#ffffff5b')
          .attr('stroke', 'none'); // Prevent stroke inheritance from parent node

        // Label text
        labelContainer
          .append('text')
          .attr('class', 'bottom-port-label')
          .attr('x', 0)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '8px')
          .attr('font-weight', '500')
          .attr('fill', '#2c3e50')
          .attr('stroke', 'none') // Prevent stroke inheritance from parent node
          .attr('pointer-events', 'none')
          .style('user-select', 'none')
          .text(labelText);
      });

      // Canvas event handlers
      svg.on('click', () => {
        onCanvasClick();
      });

      svg.on('mousemove', (event) => {
        const [x, y] = d3.pointer(event, svg.node());
        const transform = d3.zoomTransform(svg.node() as any);
        const [canvasX, canvasY] = transform.invert([x, y]);
        onCanvasMouseMove(canvasX, canvasY);
      });

      // Initialize or refresh roving tabindex on all port groups after rendering
      if (svgRef.current) {
        const svgSelForRoving = d3.select(svgRef.current);
        setupRovingTabIndex(svgSelForRoving);
        attachRovingHandlers(svgSelForRoving);
      }

      // Enhanced cleanup function with dragging state management
      return () => {
        // Cancel any pending animations handled by local batching refs only

        // Clear any pending dragging state cleanup
        if (dragStateCleanupRef.current) {
          clearTimeout(dragStateCleanupRef.current);
          dragStateCleanupRef.current = null;
        }

        // Force remove all dragging classes before cleanup
        svg.selectAll('.node.dragging').classed('dragging', false);

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
          svgSel.select('g.node-layer').selectAll('*').remove();
          // Do NOT clear connection-layer or previews here; other effects own those updates
          // Note: Keep <defs> and <g.canvas-root> to avoid losing markers and zoom/pan state
        }
        // Clear connection path cache managed by hook
        clearConnCache();
        gridCacheRef.current = null;
        allNodeElements?.clear();
      };
    } catch (error) {
      console.error('Error in main D3 rendering effect:', error);
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

  // Connections-only effect: delegate to centralized renderer
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }
    try {
      const svg = d3.select(svgRef.current);
      renderConnectionsLayer({
        svg,
        connections,
        onConnectionClick,
        getConnectionPath: (c) => getConnectionPath(c),
        createFilledPolygonFromPath,
        getConnectionMarker,
        getConnectionGroupInfo: (id, list) => getConnectionGroupInfo(id, list),
        workflowMode: workflowContextState.designerMode as DesignerMode,
        nodeMap,
      });
    } catch (e) {
      console.error('Connection effect error:', e);
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
    zIndexManager,
  ]);

  // Bind root SVG events in a tiny effect to avoid stale closures
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }
    const svg = d3.select(svgRef.current);
    svg.on('click.canvas', () => onCanvasClick());
    svg.on('mousemove.canvas', (event) => {
      const [x, y] = d3.pointer(event, svg.node());
      const transform = d3.zoomTransform(svg.node() as any);
      const [canvasX, canvasY] = transform.invert([x, y]);
      onCanvasMouseMove(canvasX, canvasY);
    });
    return () => {
      svg.on('click.canvas', null).on('mousemove.canvas', null);
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
      const gridLayer = svg.select('.grid-layer');

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
      console.error('Error in grid rendering effect:', error);
      // Reset grid cache on error
      if (gridCacheRef.current) {
        gridCacheRef.current = null;
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGrid, canvasTransform.x, canvasTransform.y, canvasTransform.k, isInitialized]); // Don't include createGrid to prevent loops

  // Remove duplicate CSS since hover styles are already in globals.css

  // Visual state effect - handle selection and connection states with z-index management
  useEffect(() => {
    if (!svgRef.current || !isInitialized) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const mainNodeLayer = svg.select('.node-layer');
    const connectionLayer = svg.select('.connection-layer');

    // Update node visual states only
    mainNodeLayer.selectAll('.node').each(function (d: any) {
      const nodeElement = d3.select(this);
      const isSelected = isNodeSelected(d.id);
      const isDragging = nodeElement.classed('dragging');
      const nodeBackground = nodeElement.select('.node-background');

      nodeElement.classed('selected', isSelected);

      if (!isDragging) {
        if (isSelected) {
          nodeElement.style('filter', 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))');
          nodeBackground.attr('stroke', '#2196F3').attr('stroke-width', 3);
        } else {
          nodeElement.style('filter', 'none');
          nodeBackground.attr('stroke', getNodeColor(d.type, d.status)).attr('stroke-width', 2);
        }
      }
    });

    // Ensure proper z-index after visual state changes (but only if not dragging)
    if (!isDragging) {
      zIndexManager.organizeNodeZIndexImmediate(); // immediate layering
    }

    // Update connection selection state only - don't touch hover state
    connectionLayer.selectAll('.connection').each(function (d: any) {
      const connectionGroup = d3.select(this as SVGGElement);
      const pathElement = connectionGroup.select('.connection-path');
      const isSelected = selectedConnection?.id === d.id;
      const isCurrentlyHovered = connectionGroup.classed('connection-hover');

      // Update selection class
      connectionGroup.classed('connection-selected', isSelected);

      // Production selection effects removed - using CSS-based styling

      // Only update visual attributes if not currently hovered
      if (!isCurrentlyHovered) {
        if (isSelected) {
          pathElement
            .attr('stroke', '#2196F3')
            .attr('stroke-width', 3)
            .attr('marker-end', getConnectionMarker(d, 'selected'));
        } else {
          pathElement
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('marker-end', getConnectionMarker(d, 'default'));
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
    zIndexManager,
    svgRef,
  ]);

  // Connection state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) {
      return;
    }

    const svg = d3.select(svgRef.current);
    // Always operate on the main canvas root / connection layer
    const canvasRoot = svg.select<SVGGElement>('g.canvas-root');
    if (canvasRoot.empty()) {
      return;
    }
    const connectionLayer = canvasRoot.select<SVGGElement>('g.connection-layer');
    const targetLayer = connectionLayer.empty() ? canvasRoot : connectionLayer;

    // Handle connection preview via helper
    targetLayer.selectAll('.connection-preview').remove();
    renderConnectionPreviewPath(targetLayer, {
      isConnecting,
      connectionStart,
      connectionPreview,
      nodes,
      nodeMap,
      nodeVariant,
      modeId: workflowContextState.designerMode as DesignerMode,
      getDims: getConfigurableDimensions as any,
      getArrowMarkerForMode,
      dbg,
    });

    // Architecture mode: temporarily tag side-ports as input/output groups during connection
    tagSidePortsDuringConnection(svg, {
      modeId: workflowContextState.designerMode as DesignerMode,
      isConnecting,
      connectionStart,
    });

    // Update port visual states during connection via helper

    updatePortsVisualState(svg, {
      isConnecting,
      connectionStart,
      canDropOnPort,
      modeId: workflowContextState.designerMode as DesignerMode,
      getDims: getConfigurableDimensions as any,
      updatePortHighlighting,
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
    nodes,
    canDropOnPort,
    getConfigurableDimensions,
    getArrowMarkerForMode,
    updatePortHighlighting,
    svgRef,
    dbg,
  ]);

  // Connection cleanup effect - clear port highlighting when connection ends
  useEffect(() => {
    if (!svgRef.current || !isInitialized) {
      return;
    }

    // Clear all port highlighting when connection ends
    if (!isConnecting) {
      const svg = d3.select(svgRef.current);

      // Remove can-dropped class from all port groups
      svg.selectAll('.input-port-group').classed('can-dropped', false);
      svg.selectAll('.output-port-group').classed('can-dropped', false);
      svg.selectAll('.port-group').classed('can-dropped', false);

      // Note: This is an expected, noise-only event; avoid warn-level logging to prevent React DevTools
      // from printing a component stack for non-issues.
      // (Intentionally silenced)
    }
  }, [isConnecting, isInitialized, svgRef, dbg]);

  // Global ESC to cancel current connection gesture quickly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isConnectingRef.current || dragConnectionDataRef.current) {
          // Clear preview and connection state via dispatch path
          dragConnectionDataRef.current = null;
          if (onPortDragEndProp) {
            onPortDragEndProp(undefined, undefined, undefined, undefined);
          } else {
            dispatch?.({ type: 'CLEAR_CONNECTION_STATE' });
          }
          e.stopPropagation();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
  }, [dispatch, onPortDragEndProp]);

  // Canvas state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const gridLayer = svg.select('.grid-layer');

    // Update grid and toolbar
    const rect = svgRef.current.getBoundingClientRect();
    createGrid(gridLayer as any, canvasTransform, rect.width, rect.height);
  }, [canvasTransform, isInitialized, createGrid, svgRef]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // rafScheduler manages its own rAF lifecycle
      // Clear connection path cache managed by hook
      clearConnCache();
      gridCacheRef.current = null;
    };
  }, [clearConnCache]);

  return null; // This component only manages D3 rendering
}

export default WorkflowCanvas;
