/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import * as d3 from 'd3'
import type { WorkflowNode, Connection, NodeVariant, NodePort } from '../types'
import { useWorkflowContext } from '../contexts/WorkflowContext'
import { getVisibleCanvasBounds } from '../utils/canvas-utils'
import { 
  getNodeColor, 
  getPortColor, 
  getNodeIcon,
  getNodeShape,
  getShapeAwareDimensions,
  getNodeShapePath,
  getPortPositions,
  NodeTypes
} from '../utils/node-utils'
// Removed unused import: getNodeDimensions
import { 
  generateVariantAwareConnectionPath, 
  generateMultipleConnectionPath,
  calculateConnectionPreviewPath, 
  calculatePortPosition,
  getConnectionGroupInfo
} from '../utils/connection-utils'
import { 
  initializeProductionConnections,
  generateProductionConnectionPath,
  getProductionConnectionManager,
  applyProductionEffects,
  animateProductionConnection,
  type ProductionConnectionConfig
} from '../utils/enhanced-connection-production'
import { 
  getOptimalConfig,
  PERFORMANCE_THRESHOLDS,
  FEATURE_FLAGS
} from '../utils/connection-config'

// Type aliases for better maintainability
type CallbackPriority = 'high' | 'normal' | 'low'
type NodeZIndexState = 'normal' | 'selected' | 'dragging'

export interface WorkflowCanvasProps {
  // SVG ref
  svgRef: React.RefObject<SVGSVGElement>
  
  // Data
  nodes: WorkflowNode[]
  connections: Connection[]
  
  // Canvas state
  showGrid: boolean
  canvasTransform: { x: number; y: number; k: number }
  
  // Node rendering configuration
  nodeVariant?: NodeVariant
  
  // Selection state
  selectedNodes: Set<string>
  selectedConnection: Connection | null
  isNodeSelected: (nodeId: string) => boolean
  
  // Connection state
  isConnecting: boolean
  connectionStart: { nodeId: string; portId: string; type: 'input' | 'output' } | null
  connectionPreview: { x: number; y: number } | null
  
  // Event handlers
  onNodeClick: (node: WorkflowNode, ctrlKey: boolean) => void
  onNodeDoubleClick: (node: WorkflowNode) => void
  onNodeDrag: (nodeId: string, x: number, y: number) => void
  onConnectionClick: (connection: Connection) => void
  onPortClick: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onCanvasClick: () => void
  onCanvasMouseMove: (x: number, y: number) => void
  
  // Drag & Drop handlers
  onPortDragStart: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDrag: (x: number, y: number) => void
  onPortDragEnd: (targetNodeId?: string, targetPortId?: string) => void
  
  // Drop validation
  canDropOnPort: (targetNodeId: string, targetPortId: string, targetPortType?: 'input' | 'output') => boolean
  canDropOnNode: (targetNodeId: string) => boolean
  
  // Plus button handler for bottom ports
  onPlusButtonClick?: (nodeId: string, portId: string) => void
  
  // Canvas transform
  onTransformChange: (transform: d3.ZoomTransform) => void
  onZoomLevelChange?: (zoomLevel: number) => void
  onRegisterZoomBehavior?: (zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>) => void
}

const WorkflowCanvas = React.memo(function WorkflowCanvas({
  svgRef,
  nodes,
  connections,
  showGrid,
  canvasTransform,
  nodeVariant = 'standard',
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
    endDragging 
  } = useWorkflowContext()
  
  // Production connection system state
  const [enhancedConnectionsEnabled, setEnhancedConnectionsEnabled] = useState(FEATURE_FLAGS.ENABLE_ENHANCED_CONNECTIONS)
  const productionManagerRef = useRef<any>(null)
  const performanceMetricsRef = useRef<any>({})
  const lastMaintenanceRef = useRef<number>(Date.now())

  // Expose controls for debugging/testing (can be removed in production)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).toggleEnhancedConnections = () => {
        setEnhancedConnectionsEnabled(prev => {
          console.log('🔄 Enhanced connections toggled:', !prev)
          return !prev
        })
      }
      (window as any).getEnhancedConnectionManager = () => productionManagerRef.current
    }
  }, [])
  
  // Remove hover state from React - manage it directly in D3
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Performance state
  const [isInitialized, setIsInitialized] = useState(false)
  const rafIdRef = useRef<number | null>(null)
  const rafScheduledRef = useRef<boolean>(false)
  
  // Enhanced drag performance state
  const connectionUpdateQueueRef = useRef<Set<string>>(new Set())
  const batchedConnectionUpdateRef = useRef<number | null>(null)
  const visualUpdateQueueRef = useRef<Set<string>>(new Set())
  const batchedVisualUpdateRef = useRef<number | null>(null)
  
  // Cleanup timeouts and RAF callbacks on unmount
  useEffect(() => {
    const updateTimeout = updateTimeoutRef.current
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      if (updateTimeout) {
        clearTimeout(updateTimeout)
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      if (batchedConnectionUpdateRef.current) {
        cancelAnimationFrame(batchedConnectionUpdateRef.current)
      }
      if (batchedVisualUpdateRef.current) {
        cancelAnimationFrame(batchedVisualUpdateRef.current)
      }
      // Cleanup production connection manager
      if (productionManagerRef.current) {
        productionManagerRef.current.dispose()
      }
    }
  }, [])

  // Initialize enhanced connection system
  useEffect(() => {
    if (!svgRef.current || !enhancedConnectionsEnabled) return

    try {
      // Get canvas bounds
      const rect = svgRef.current.getBoundingClientRect()
      const canvasBounds = {
        x: canvasTransform.x,
        y: canvasTransform.y,
        width: rect.width,
        height: rect.height,
        zoom: canvasTransform.k
      }

      // Intelligent configuration based on context
      const productionConfig = getOptimalConfig({
        nodeCount: nodes.length,
        connectionCount: connections.length,
        isMobile: window.innerWidth < 768,
        isArchitectureMode: workflowContextState.designerMode === 'architecture'
      })

      // Initialize production connection manager
      const svg = d3.select(svgRef.current)
      const defs = svg.select<SVGDefsElement>('defs')
      
      productionManagerRef.current = initializeProductionConnections(
        defs.empty() ? undefined : defs,
        productionConfig
      )

      console.log('🚀 Production connection system initialized', {
        mode: workflowContextState.designerMode,
        config: productionConfig,
        nodesCount: nodes.length,
        connectionsCount: connections.length
      })
    } catch (error) {
      console.warn('⚠️ Failed to initialize enhanced connections, falling back to standard:', error)
      setEnhancedConnectionsEnabled(false)
    }
  }, [svgRef, workflowContextState.designerMode, enhancedConnectionsEnabled, nodes.length, connections.length, canvasTransform])

  // Update enhanced connection manager when canvas changes
  useEffect(() => {
    if (!productionManagerRef.current || !svgRef.current) return

    // Update viewport for performance optimization if available
    if (productionManagerRef.current.updateViewport) {
      const rect = svgRef.current.getBoundingClientRect()
      const canvasBounds = {
        x: canvasTransform.x,
        y: canvasTransform.y,
        width: rect.width,
        height: rect.height,
        zoom: canvasTransform.k
      }

      productionManagerRef.current.updateViewport(canvasBounds)
    }
  }, [canvasTransform, nodes.length, svgRef])

  // Performance monitoring and maintenance
  useEffect(() => {
    if (!productionManagerRef.current || !FEATURE_FLAGS.ENABLE_PERFORMANCE_MONITORING) return

    const monitorPerformance = () => {
      try {
        const metrics = productionManagerRef.current.getMetrics()
        performanceMetricsRef.current = metrics

        // Log performance warnings if needed
        if (metrics.renderTime > PERFORMANCE_THRESHOLDS.MAX_RENDER_TIME_MS) {
          console.warn('🐌 Slow connection rendering detected:', metrics)
        }

        // Perform maintenance if needed
        const now = Date.now()
        if (now - lastMaintenanceRef.current > PERFORMANCE_THRESHOLDS.MEMORY_CLEANUP_INTERVAL_MS) {
          productionManagerRef.current.performMaintenance()
          lastMaintenanceRef.current = now
          console.log('🧹 Connection system maintenance completed')
        }
      } catch (error) {
        console.warn('⚠️ Performance monitoring error:', error)
      }
    }

    const interval = setInterval(monitorPerformance, 10000) // Monitor every 10 seconds
    return () => clearInterval(interval)
  }, [enhancedConnectionsEnabled])
  
  // Track current transform with ref for immediate access
  const currentTransformRef = useRef(canvasTransform)
  
  /**
   * Helper function to determine connection direction and appropriate arrow marker
   * Now includes mode-specific styling for workflow vs architecture modes
   */
  const getConnectionMarker = useCallback((connection: Connection, state: 'default' | 'selected' | 'hover' = 'default') => {
    const sourceNode = nodes.find(n => n.id === connection.sourceNodeId)
    const targetNode = nodes.find(n => n.id === connection.targetNodeId)
    
    if (!sourceNode || !targetNode) return 'url(#arrowhead)'
    
    // Use designer mode from context state
    const isWorkflowMode = workflowContextState.designerMode === 'workflow'
    
    // Check if source is a bottom port
    const isSourceBottomPort = sourceNode.bottomPorts?.some(p => p.id === connection.sourcePortId)
    
    if (isSourceBottomPort) {
      // Bottom ports typically connect horizontally to target nodes from the left
      // Check if target is to the right of source (normal left-to-right flow)
      const isLeftToRight = targetNode.x > sourceNode.x
      
      if (isLeftToRight) {
        // Standard right-pointing arrow - mode-specific
        if (isWorkflowMode) {
          switch (state) {
            case 'selected': return 'url(#arrowhead-workflow-selected)'
            case 'hover': return 'url(#arrowhead-workflow-hover)'
            default: return 'url(#arrowhead-workflow)'
          }
        } else {
          switch (state) {
            case 'selected': return 'url(#arrowhead-architecture-selected)'
            case 'hover': return 'url(#arrowhead-architecture-hover)'
            default: return 'url(#arrowhead-architecture)'
          }
        }
      } else {
        // Left-pointing arrow for right-to-left connections (keep generic for now)
        switch (state) {
          case 'selected': return 'url(#arrowhead-left-selected)'
          case 'hover': return 'url(#arrowhead-left-hover)'
          default: return 'url(#arrowhead-left)'
        }
      }
    }
    
    // Regular connections use mode-specific right-pointing arrows
    if (isWorkflowMode) {
      switch (state) {
        case 'selected': return 'url(#arrowhead-workflow-selected)'
        case 'hover': return 'url(#arrowhead-workflow-hover)'
        default: return 'url(#arrowhead-workflow)'
      }
    } else {
      switch (state) {
        case 'selected': return 'url(#arrowhead-architecture-selected)'
        case 'hover': return 'url(#arrowhead-architecture-hover)'
        default: return 'url(#arrowhead-architecture)'
      }
    }
  }, [nodes, workflowContextState.designerMode])
  useEffect(() => {
    currentTransformRef.current = canvasTransform
  }, [canvasTransform])
  
  
  
  // Drag state with context integration
  const draggedElementRef = useRef<d3.Selection<any, any, any, any> | null>(null)
  const draggedNodeElementRef = useRef<SVGGElement | null>(null)
  const nodeLayerRef = useRef<SVGGElement | null>(null)
  const allNodeElementsRef = useRef<Map<string, SVGGElement>>(new Map())
  
  // Enhanced dragging state management for stability with context integration
  const dragStateCleanupRef = useRef<NodeJS.Timeout | null>(null)
  
  // Use context-based dragging state
  const isDragging = isContextDragging()
  const draggedNodeId = getDraggedNodeId()
  
  // Cache refs for performance with size limits to prevent memory leaks
  const connectionPathCacheRef = useRef<Map<string, string>>(new Map())
  const gridCacheRef = useRef<{ 
    transform: string; 
    bounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      width: number;
      height: number;
    }
  } | null>(null)
  const nodePositionCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  
  // Cache size limits to prevent memory issues
  const MAX_CACHE_SIZE = 1000
  const CACHE_CLEANUP_THRESHOLD = 1200

  // High-performance pattern-based grid creation (95% faster than individual dots)
  const createGrid = useCallback((
    gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    transform: { x: number; y: number; k: number },
    viewportWidth: number,
    viewportHeight: number
  ) => {
    const startTime = performance.now() // Performance monitoring
    if (!showGrid) {
      gridLayer.selectAll('*').remove()
      gridCacheRef.current = null
      return
    }

    const baseGridSize = 20
    const gridSize = baseGridSize * transform.k
    
    // Hide grid when too small to see effectively
    if (gridSize < 8) {
      gridLayer.selectAll('*').remove()
      gridCacheRef.current = null
      return
    }

    // Create cache key with rounded values for better cache hits
    const roundedTransform = {
      x: Math.round(transform.x / 5) * 5,
      y: Math.round(transform.y / 5) * 5,
      k: Math.round(transform.k * 100) / 100
    }
    const transformString = `${roundedTransform.x},${roundedTransform.y},${roundedTransform.k}`
    const cached = gridCacheRef.current
    
    // Use cached grid if transform hasn't changed significantly
    if (cached && cached.transform === transformString) {
      return
    }

    // Calculate dot appearance based on zoom level
    const dotRadius = Math.max(0.8, Math.min(2.5, transform.k * 1.2))
    const dotOpacity = Math.max(0.3, Math.min(0.8, transform.k * 0.6))

    // Get or create the pattern definition
    const svg = gridLayer.node()?.closest('svg')
    if (!svg) return

    const svgSelection = d3.select(svg)
    let defs = svgSelection.select<SVGDefsElement>('defs')
    if (defs.empty()) {
      defs = svgSelection.insert<SVGDefsElement>('defs', ':first-child')
    }

    const patternId = 'dot-grid-pattern'
    const pattern = defs.select(`#${patternId}`)
    
    // Create or update the pattern
    if (pattern.empty()) {
      const newPattern = defs.append('pattern')
        .attr('id', patternId)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', baseGridSize)
        .attr('height', baseGridSize)

      newPattern.append('circle')
        .attr('cx', baseGridSize / 2)
        .attr('cy', baseGridSize / 2)
        .attr('class', 'pattern-dot')
    }

    // Update pattern attributes
    defs.select(`#${patternId}`)
      .attr('width', baseGridSize)
      .attr('height', baseGridSize)
      .select('.pattern-dot')
      .attr('r', dotRadius / transform.k) // Adjust for zoom
      .attr('fill', '#d1d5db')
      .attr('opacity', dotOpacity)

    // Clear existing grid elements
    gridLayer.selectAll('*').remove()

    // Calculate bounds with some padding for smooth scrolling
    const bounds = getVisibleCanvasBounds(transform, viewportWidth, viewportHeight, 200)
    
    // Create a single rectangle that uses the pattern
    gridLayer.append('rect')
      .attr('class', 'grid-pattern-rect')
      .attr('x', bounds.minX)
      .attr('y', bounds.minY) 
      .attr('width', bounds.width)
      .attr('height', bounds.height)
      .attr('fill', `url(#${patternId})`)
      .style('pointer-events', 'none')

    // Cache the result
    gridCacheRef.current = {
      transform: transformString,
      bounds: bounds
    }

    // Performance logging in development
    if (process.env.NODE_ENV === 'development') {
      const renderTime = performance.now() - startTime
      if (renderTime > 10) {
        console.warn(`Grid rendering took ${renderTime.toFixed(2)}ms (expected <10ms)`)
      }
    }
  }, [showGrid])

  // Enhanced RAF scheduling system with priority queues
  const rafCallbackQueueRef = useRef<Array<{ callback: () => void; priority: CallbackPriority }>>([])
  
  const processRAFQueue = useCallback(() => {
    if (rafCallbackQueueRef.current.length === 0) {
      rafScheduledRef.current = false
      rafIdRef.current = null
      return
    }

    // Sort callbacks by priority (high -> normal -> low)
    const sortedCallbacks = [...rafCallbackQueueRef.current].sort((a, b) => {
      const priorities = { high: 3, normal: 2, low: 1 }
      return priorities[b.priority] - priorities[a.priority]
    })

    // Process high priority callbacks first, with a limit to prevent blocking
    const highPriorityCallbacks = sortedCallbacks.filter(item => item.priority === 'high').slice(0, 3)
    const otherCallbacks = sortedCallbacks.filter(item => item.priority !== 'high').slice(0, 2)
    
    const callbacksToProcess = [...highPriorityCallbacks, ...otherCallbacks]
    
    // Execute callbacks
    callbacksToProcess.forEach(item => {
      try {
        item.callback()
      } catch (error) {
        console.warn('RAF callback error:', error)
      }
    })

    // Remove processed callbacks
    rafCallbackQueueRef.current = rafCallbackQueueRef.current.filter(
      item => !callbacksToProcess.includes(item)
    )

    // Schedule next frame if there are more callbacks
    if (rafCallbackQueueRef.current.length > 0) {
      rafIdRef.current = requestAnimationFrame(processRAFQueue)
    } else {
      rafScheduledRef.current = false
      rafIdRef.current = null
    }
  }, [])

  const scheduleRAF = useCallback((callback: () => void, priority: CallbackPriority = 'normal') => {
    rafCallbackQueueRef.current.push({ callback, priority })
    
    if (!rafScheduledRef.current) {
      rafScheduledRef.current = true
      rafIdRef.current = requestAnimationFrame(processRAFQueue)
    }
  }, [processRAFQueue])

  // Enhanced Z-Index Management with change detection to reduce DOM manipulation
  const lastZIndexStateRef = useRef<Map<string, NodeZIndexState>>(new Map())

  const organizeNodeZIndex = useCallback((immediate = false) => {
    const nodeLayer = nodeLayerRef.current
    if (!nodeLayer || allNodeElementsRef.current.size === 0) return

    const executeZIndexUpdate = () => {
      const normalNodes: SVGGElement[] = []
      const selectedNodes: SVGGElement[] = []
      const draggingNodes: SVGGElement[] = []
      const currentState = new Map<string, NodeZIndexState>()
      let hasChanges = false

      allNodeElementsRef.current.forEach((element, nodeId) => {
        if (!nodeLayer.contains(element)) return
        
        const isNodeDragging = isDragging && nodeId === draggedNodeId
        const isSelected = isNodeSelected(nodeId)
        
        let state: NodeZIndexState
        if (isNodeDragging) {
          draggingNodes.push(element)
          state = 'dragging'
        } else if (isSelected) {
          selectedNodes.push(element)
          state = 'selected'
        } else {
          normalNodes.push(element)
          state = 'normal'
        }
        
        currentState.set(nodeId, state)
        
        // Check if state changed
        if (lastZIndexStateRef.current.get(nodeId) !== state) {
          hasChanges = true
        }
      })

      // Only reorder DOM if there are actual changes
      if (hasChanges || lastZIndexStateRef.current.size !== currentState.size) {
        // Reorder DOM elements: normal → selected → dragging
        const orderedElements = [...normalNodes, ...selectedNodes, ...draggingNodes]
        
        // Use document fragment for batch DOM operations
        const fragment = document.createDocumentFragment()
        orderedElements.forEach(element => {
          fragment.appendChild(element)
        })
        nodeLayer.appendChild(fragment)
        
        lastZIndexStateRef.current = currentState
      }
    }

    if (immediate) {
      executeZIndexUpdate()
    } else {
      scheduleRAF(executeZIndexUpdate, 'high') // Z-index updates are high priority for visual feedback
    }
  }, [isNodeSelected, scheduleRAF, isDragging, draggedNodeId])

  // Optimized immediate node dragging z-index management
  const setNodeAsDragging = useCallback((nodeId: string) => {
    const element = allNodeElementsRef.current.get(nodeId)
    const nodeLayer = nodeLayerRef.current
    
    if (element && nodeLayer) {
      // Mark state as changed and trigger immediate z-index organization
      lastZIndexStateRef.current.set(nodeId, 'dragging')
      organizeNodeZIndex(true) // Use immediate execution
    }
  }, [organizeNodeZIndex])


  // Optimized node lookup with memoization
  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>()
    nodes.forEach(node => map.set(node.id, node))
    return map
  }, [nodes])

  // Stable reference for selectedNodes to prevent unnecessary re-renders
  const selectedNodesRef = useRef(selectedNodes)
  selectedNodesRef.current = selectedNodes

  // Throttle drag updates for better performance
  const lastDragUpdateRef = useRef(0)
  const dragUpdateThrottle = 16 // ~60fps for better performance balance
  const connectionBatchSize = 10 // Maximum connections to update per batch
  
  // Track last updated paths to prevent unnecessary redraws
  const lastConnectionPathsRef = useRef<Map<string, string>>(new Map())
  
  // Track current drag positions to prevent position conflicts
  const currentDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())


  /**
   * Function to check if a bottom port can accept additional connections
   * Based on business rules for different port types:
   * - ai-model: Single connection only (no plus button when connected)
   * - memory: Single connection only (no plus button when connected)
   * - tool: Multiple connections allowed (always show plus button)
   * - Other array types: Multiple connections allowed
   * - Other single types: Single connection only
   */
  const canBottomPortAcceptConnection = useCallback((nodeId: string, portId: string, connections: Connection[], designerMode?: 'workflow' | 'architecture') => {
    // Get the node to check its bottom ports configuration
    const node = nodeMap.get(nodeId)
    if (!node?.bottomPorts) return false
    
    const port = node.bottomPorts.find(p => p.id === portId)
    if (!port) return false
    
    // Count existing connections for this port
    const existingConnections = connections.filter(conn => 
      conn.sourceNodeId === nodeId && conn.sourcePortId === portId
    )
    
    // In architecture mode, be more permissive for legacy system support
    if (designerMode === 'architecture') {
      // Allow multiple connections to most ports in architecture mode
      // This supports legacy systems with multiple endpoints
      switch (portId) {
        case 'ai-model':
          // Even AI Model ports can have multiple connections in architecture mode
          // (e.g., different model versions or fallback models)
          return true
          
        case 'memory':
          // Memory ports can connect to multiple stores in architecture mode
          return true
          
        case 'tool':
          // Tool port: Always allows multiple connections
          return true
          
        default:
          // In architecture mode, allow multiple connections for all ports
          // This supports legacy systems with multiple endpoints
          return true
      }
    }
    
    // Original workflow mode logic (stricter validation)
    switch (portId) {
      case 'ai-model':
        // AI Model port: Only allows 1 connection (can replace existing)
        // Show plus button only when no connection exists
        return existingConnections.length === 0
        
      case 'memory':
        // Memory port: Typically allows only 1 connection
        return existingConnections.length === 0
        
      case 'tool':
        // Tool port: Allows multiple connections (array of tools)
        return true
        
      default:
        // For other ports, check if dataType suggests multiple connections
        if (port.dataType === 'array') {
          // Array types can accept multiple connections
          return true
        } else {
          // Single value types typically allow only one connection
          return existingConnections.length === 0
        }
    }
  }, [nodeMap])

  // Helper function to check if a port has multiple connections
  const hasMultipleConnections = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    if (portType === 'input') {
      return connections.filter(conn => 
        conn.targetNodeId === nodeId && conn.targetPortId === portId
      ).length > 1
    } else {
      return connections.filter(conn => 
        conn.sourceNodeId === nodeId && conn.sourcePortId === portId
      ).length > 1
    }
  }, [connections])

  // Helper function to determine if a node is a legacy endpoint
  const isLegacyEndpoint = useCallback((node: WorkflowNode) => {
    // Mark nodes as legacy endpoints based on certain criteria
    return node.config?.isLegacyEndpoint || 
           node.type === 'legacy-api' || 
           node.type === 'legacy-service' ||
           (node.inputs && node.inputs.length > 3) || // Many input ports suggest legacy system
           (workflowContextState.designerMode === 'architecture' && 
            connections.filter(conn => conn.targetNodeId === node.id).length > 2) // Multiple incoming connections
  }, [connections, workflowContextState.designerMode])

  // Enhanced port highlighting for architecture mode
  const getPortHighlightClass = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    if (workflowContextState.designerMode !== 'architecture') return ''
    
    const isMultiple = hasMultipleConnections(nodeId, portId, portType)
    const classes = []
    
    if (isMultiple) {
      classes.push('has-multiple-connections')
    }
    
    return classes.join(' ')
  }, [workflowContextState.designerMode, hasMultipleConnections])


  // Cache cleanup utility to prevent memory leaks
  const cleanupConnectionCache = useCallback(() => {
    const cache = connectionPathCacheRef.current
    if (cache.size > CACHE_CLEANUP_THRESHOLD) {
      // Remove oldest entries (first 200) to keep cache at reasonable size
      const entries = Array.from(cache.entries())
      const entriesToKeep = entries.slice(-MAX_CACHE_SIZE)
      cache.clear()
      entriesToKeep.forEach(([key, value]) => cache.set(key, value))
    }
  }, [MAX_CACHE_SIZE, CACHE_CLEANUP_THRESHOLD])

  // Memoized connection path calculation with drag position support and memory management
  const getConnectionPath = useCallback((connection: Connection, useDragPositions = false) => {
    const cacheKey = `${connection.id}-${connection.sourceNodeId}-${connection.sourcePortId}-${connection.targetNodeId}-${connection.targetPortId}-${nodeVariant}${useDragPositions ? '-drag' : ''}`
    
    // Skip cache for drag positions to ensure real-time updates
    if (!useDragPositions) {
      const cached = connectionPathCacheRef.current.get(cacheKey)
      if (cached) return cached
    }
    
    let sourceNode = nodeMap.get(connection.sourceNodeId)
    let targetNode = nodeMap.get(connection.targetNodeId)
    if (!sourceNode || !targetNode) return ''
    
    // Use current drag positions if available
    if (useDragPositions) {
      const sourceDragPos = currentDragPositionsRef.current.get(connection.sourceNodeId)
      const targetDragPos = currentDragPositionsRef.current.get(connection.targetNodeId)
      
      if (sourceDragPos) {
        sourceNode = { ...sourceNode, x: sourceDragPos.x, y: sourceDragPos.y }
      }
      if (targetDragPos) {
        targetNode = { ...targetNode, x: targetDragPos.x, y: targetDragPos.y }
      }
    }
    
    // Check if this is part of multiple connections between same nodes
    const groupInfo = getConnectionGroupInfo(connection.id, connections)
    
    console.log('🔍 Connection group info:', {
      connectionId: connection.id,
      sourceNodeId: connection.sourceNodeId,
      targetNodeId: connection.targetNodeId,
      groupInfo,
      totalConnections: connections.length
    })
    
    let path: string
    if (groupInfo.isMultiple) {
      console.log('🔧 Using generateMultipleConnectionPath for multiple connections')
      // For multiple connections, always use the working generateMultipleConnectionPath
      // Skip production manager to avoid NaN issues with path smoothing
      path = generateMultipleConnectionPath(
        sourceNode,
        connection.sourcePortId,
        targetNode,
        connection.targetPortId,
        groupInfo.index,
        groupInfo.total,
        nodeVariant
      )
    } else {
      // Use production-ready standard connection path for single connections
      if (enhancedConnectionsEnabled && productionManagerRef.current) {
        path = generateProductionConnectionPath(
          sourceNode, 
          connection.sourcePortId, 
          targetNode, 
          connection.targetPortId,
          0, // connectionIndex
          1, // totalConnections
          nodeVariant,
          true // enable enhanced features
        )
      } else {
        path = generateVariantAwareConnectionPath(
          sourceNode, 
          connection.sourcePortId, 
          targetNode, 
          connection.targetPortId,
          nodeVariant
        )
      }
    }
    
    if (!useDragPositions) {
      connectionPathCacheRef.current.set(cacheKey, path)
      
      // Periodic cache cleanup to prevent memory leaks
      if (connectionPathCacheRef.current.size > CACHE_CLEANUP_THRESHOLD) {
        cleanupConnectionCache()
      }
    }
    return path
  }, [nodeMap, nodeVariant, connections, enhancedConnectionsEnabled, cleanupConnectionCache])

  // Memoized configurable dimensions calculation (shape-aware)
  const getConfigurableDimensions = useMemo(() => {
    const dimensionsCache = new Map<string, any>()
    
    return (node: WorkflowNode) => {
      const cacheKey = `${node.id}-${nodeVariant}`
      const cached = dimensionsCache.get(cacheKey)
      if (cached) return cached
      
      const shapeDimensions = getShapeAwareDimensions(node)
      
      // Adjust dimensions based on variant
      const result = nodeVariant === 'compact' 
        ? {
            ...shapeDimensions,
            width: shapeDimensions.width * 0.8,
            height: shapeDimensions.height * 0.8,
            portRadius: shapeDimensions.portRadius || 6
          }
        : {
            ...shapeDimensions,
            portRadius: shapeDimensions.portRadius || 6
          }
      
      dimensionsCache.set(cacheKey, result)
      return result
    }
  }, [nodeVariant])

  // Helper function to calculate optimal bottom port positioning
  // Uses either 80% of node width OR node width minus 40px (whichever is smaller)
  const calculateBottomPortLayout = useCallback((nodeData: any, portIndex: number) => {
    const dimensions = getConfigurableDimensions(nodeData)
    const nodeWidth = dimensions.width || 200
    const nodeHeight = dimensions.height || 80
    const portCount = nodeData.bottomPorts?.length || 0
    
    if (portCount === 0) return { x: 0, y: nodeHeight / 2 }
    
    // Use the smaller of: 80% width OR (width - 40px)
    // This ensures proper spacing for both narrow and wide nodes
    const usableWidth = Math.min(nodeWidth * 0.8, nodeWidth - 70)
    
    if (portCount === 1) {
      // Single port: center it
      return {
        x: 0,
        y: nodeHeight / 2
      }
    } else if (portCount === 2) {
      // Two ports: optimized positioning for visual balance
      const spacing = usableWidth / 3 // Divide available space into thirds
      const positions = [-spacing, spacing] // Place at 1/3 and 2/3 positions
      return {
        x: positions[portIndex] || 0,
        y: nodeHeight / 2
      }
    } else if (portCount === 3) {
      // Three ports: center one, balance others
      const halfWidth = usableWidth / 2
      const positions = [-halfWidth, 0, halfWidth]
      return {
        x: positions[portIndex] || 0,
        y: nodeHeight / 2
      }
    } else {
      // Multiple ports (4+): distribute evenly with optimal spacing
      const spacing = usableWidth / (portCount - 1)
      const x = -usableWidth / 2 + spacing * portIndex
      return {
        x: x,
        y: nodeHeight / 2
      }
    }
  }, [getConfigurableDimensions])

  // Enhanced visual feedback system with batching and caching
  const processBatchedVisualUpdates = useCallback(() => {
    if (visualUpdateQueueRef.current.size === 0) return

    const nodesToProcess = Array.from(visualUpdateQueueRef.current)
    
    // Process visual updates in batches
    nodesToProcess.forEach(nodeId => {
      const element = allNodeElementsRef.current.get(nodeId)
      if (!element) return

      const nodeElement = d3.select(element)
      const nodeBackground = nodeElement.select('.node-background')
      
      // Apply drag visual style
      nodeElement
        .style('opacity', 0.9)
        .style('filter', 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))')
      
      // Always use blue border for drag visual style (consistent with immediate styling)
      nodeBackground.attr('stroke', '#2196F3').attr('stroke-width', 3)
    })
    
    visualUpdateQueueRef.current.clear()
    batchedVisualUpdateRef.current = null
  }, [])

  const applyDragVisualStyle = useCallback((nodeElement: any, nodeId: string) => {
    // CRITICAL: Apply visual styling IMMEDIATELY during drag start for stable feedback
    const nodeBackground = nodeElement.select('.node-background')
    
    // Apply drag visual style immediately
    nodeElement
      .style('opacity', 0.9)
      .style('filter', 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))')
    
    // Always use blue border when dragging (regardless of selection state)
    nodeBackground.attr('stroke', '#2196F3').attr('stroke-width', 3)
    
    // Applied blue drag visual style immediately
    
    // Also queue for batched processing as backup
    visualUpdateQueueRef.current.add(nodeId)
    
    // Start batched processing if not already running
    if (!batchedVisualUpdateRef.current) {
      batchedVisualUpdateRef.current = requestAnimationFrame(processBatchedVisualUpdates)
    }
  }, [processBatchedVisualUpdates])

  // Memoized connection lookup for better drag performance
  const nodeConnectionsMap = useMemo(() => {
    const map = new Map<string, Connection[]>()
    connections.forEach(conn => {
      // Index by source node
      if (!map.has(conn.sourceNodeId)) {
        map.set(conn.sourceNodeId, [])
      }
      map.get(conn.sourceNodeId)!.push(conn)
      
      // Index by target node (if different from source)
      if (conn.targetNodeId !== conn.sourceNodeId) {
        if (!map.has(conn.targetNodeId)) {
          map.set(conn.targetNodeId, [])
        }
        map.get(conn.targetNodeId)!.push(conn)
      }
    })
    return map
  }, [connections])

  // Batched connection update system for better performance
  const processBatchedConnectionUpdates = useCallback(() => {
    if (connectionUpdateQueueRef.current.size === 0) return

    const svg = d3.select(svgRef.current!)
    const connectionLayer = svg.select('.connection-layer')
    
    // Process connections in batches to avoid blocking the main thread
    const nodesToProcess = Array.from(connectionUpdateQueueRef.current)
    const batchSize = Math.min(connectionBatchSize, nodesToProcess.length)
    
    for (let i = 0; i < batchSize; i++) {
      const nodeId = nodesToProcess[i]
      const affectedConnections = nodeConnectionsMap.get(nodeId) || []
      
      if (affectedConnections.length === 0) continue

      // Update connections using cached selections for better performance
      affectedConnections.forEach(conn => {
        const connectionElement = connectionLayer.select(`[data-connection-id="${conn.id}"]`)
        if (!connectionElement.empty()) {
          const pathElement = connectionElement.select('.connection-path')
          const newPath = getConnectionPath(conn, true)
          pathElement.attr('d', newPath)
        }
      })
      
      connectionUpdateQueueRef.current.delete(nodeId)
    }

    // Schedule next batch if there are more connections to process
    if (connectionUpdateQueueRef.current.size > 0) {
      batchedConnectionUpdateRef.current = requestAnimationFrame(processBatchedConnectionUpdates)
    } else {
      batchedConnectionUpdateRef.current = null
    }
  }, [nodeConnectionsMap, getConnectionPath, connectionBatchSize])

  const updateDraggedNodePosition = useCallback((nodeId: string, newX: number, newY: number) => {
    // Always update node position immediately for smooth dragging
    if (draggedElementRef.current) {
      draggedElementRef.current.attr('transform', `translate(${newX}, ${newY})`)
    }

    // Store current drag position
    currentDragPositionsRef.current.set(nodeId, { x: newX, y: newY })

    // Throttle connection updates to improve performance
    const now = Date.now()
    if (now - lastDragUpdateRef.current < dragUpdateThrottle) {
      return
    }
    lastDragUpdateRef.current = now

    // Queue connection updates for batched processing
    const affectedConnections = nodeConnectionsMap.get(nodeId) || []
    if (affectedConnections.length > 0) {
      connectionUpdateQueueRef.current.add(nodeId)
      
      // Start batched processing if not already running
      if (!batchedConnectionUpdateRef.current) {
        batchedConnectionUpdateRef.current = requestAnimationFrame(processBatchedConnectionUpdates)
      }
    }
  }, [nodeConnectionsMap, processBatchedConnectionUpdates, dragUpdateThrottle])

  const resetNodeVisualStyle = useCallback((nodeElement: any, nodeId: string) => {
    const isSelected = isNodeSelected(nodeId)
    const nodeBackground = nodeElement.select('.node-background')
    const node = nodeMap.get(nodeId)
    
    if (isSelected) {
      nodeElement
        .style('opacity', 1)
        .style('filter', 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))')
      nodeBackground
        .attr('stroke', '#2196F3')
        .attr('stroke-width', 3)
    } else {
      nodeElement
        .style('opacity', 1)
        .style('filter', 'none')
      if (node) {
        nodeBackground
          .attr('stroke', getNodeColor(node.type, node.status))
          .attr('stroke-width', 2)
      }
    }
  }, [isNodeSelected, nodeMap])

  // Enhanced cache management with memory optimization
  const clearAllCaches = useCallback(() => {
    connectionPathCacheRef.current.clear()
    nodePositionCacheRef.current.clear()
    lastConnectionPathsRef.current.clear()
    currentDragPositionsRef.current.clear()
    connectionUpdateQueueRef.current.clear()
    visualUpdateQueueRef.current.clear()
    lastZIndexStateRef.current.clear()
    rafCallbackQueueRef.current = []
    
    // Cancel any pending batched updates and RAF callbacks
    if (batchedConnectionUpdateRef.current) {
      cancelAnimationFrame(batchedConnectionUpdateRef.current)
      batchedConnectionUpdateRef.current = null
    }
    if (batchedVisualUpdateRef.current) {
      cancelAnimationFrame(batchedVisualUpdateRef.current)
      batchedVisualUpdateRef.current = null
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    rafScheduledRef.current = false
  }, [])

  // Clear caches when nodes change
  useEffect(() => {
    clearAllCaches()
  }, [nodes, clearAllCaches])

  // Clear connection paths when connections change
  useEffect(() => {
    lastConnectionPathsRef.current.clear()
  }, [connections])

  // Immediate z-index organization for selection changes
  useEffect(() => {
    if (!isDragging && isInitialized) {
      // Use immediate update for selection changes to ensure proper layering
      const nodeLayer = nodeLayerRef.current
      if (!nodeLayer || allNodeElementsRef.current.size === 0) return

      const normalNodes: SVGGElement[] = []
      const selectedNodes: SVGGElement[] = []
      const draggingNodes: SVGGElement[] = []

      allNodeElementsRef.current.forEach((element, nodeId) => {
        if (!nodeLayer.contains(element)) return
        
        const isNodeDragging = isDragging && nodeId === draggedNodeId
        const isSelected = isNodeSelected(nodeId)

        if (isNodeDragging) {
          draggingNodes.push(element)
        } else if (isSelected) {
          selectedNodes.push(element)
        } else {
          normalNodes.push(element)
        }
      })

      // Reorder DOM elements immediately: normal → selected → dragging
      const orderedElements = [...normalNodes, ...selectedNodes, ...draggingNodes]
      
      orderedElements.forEach(element => {
        if (nodeLayer.contains(element) && nodeLayer.lastChild !== element) {
          nodeLayer.appendChild(element)
        }
      })
    }
  }, [selectedNodes, isNodeSelected, isInitialized, isDragging, draggedNodeId])

  // Monitor drag state changes to clean up DOM classes
  useEffect(() => {
    if (!svgRef.current) return
    
    const svg = d3.select(svgRef.current)
    
    // If we're not dragging, remove all dragging classes
    if (!isDragging) {
      svg.selectAll('.node.dragging').classed('dragging', false)
      // Clear draggedElementRef when not dragging
      if (draggedElementRef.current) {
        draggedElementRef.current = null
      }
    }
  }, [isDragging, draggedNodeId]) // svgRef doesn't need to be in deps as it's stable

  // Main D3 rendering effect - split into smaller, focused effects
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Add definitions for patterns and markers
    const defs = svg.append('defs')
    
    // Background rect
    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', '#f7f7f7')  
      .attr('class', 'svg-canvas-background')

    // Arrow markers with direction-aware positioning and optimized refX
    const createArrowMarker = (id: string, color: string, size = 14, direction: 'right' | 'left' = 'right') => {
      const marker = defs.append('marker')
        .attr('id', id)
        .attr('markerWidth', size)
        .attr('markerHeight', size)
        .attr('orient', 'auto')
        .attr('markerUnits', 'userSpaceOnUse')
      
      if (direction === 'right') {
        // Right-pointing arrow (default)
        // refX positioned at center of arrow tip for better alignment
        marker
          .attr('refX', size / 2)
          .attr('refY', size / 2)
          .append('polygon')
          .attr('points', `0,0 ${size - 1},${size / 2} 0,${size}`)
          .attr('fill', color)
          .attr('stroke', 'none')
      } else {
        // Left-pointing arrow for connections entering from left
        marker
          .attr('refX', size / 2)
          .attr('refY', size / 2)
          .append('polygon')
          .attr('points', `${size - 1},0 0,${size / 2} ${size - 1},${size}`)
          .attr('fill', color)
          .attr('stroke', 'none')
      }
    }
    
    // Create directional arrow markers
    createArrowMarker('arrowhead', '#666')
    createArrowMarker('arrowhead-selected', '#2196F3')
    createArrowMarker('arrowhead-hover', '#1976D2', 18)
    createArrowMarker('arrowhead-left', '#666', 14, 'left')
    createArrowMarker('arrowhead-left-selected', '#2196F3', 14, 'left')
    createArrowMarker('arrowhead-left-hover', '#1976D2', 18, 'left')
    
    // Mode-specific arrow markers for workflow mode
    createArrowMarker('arrowhead-workflow', '#2563eb', 14)
    createArrowMarker('arrowhead-workflow-selected', '#059669', 16)
    createArrowMarker('arrowhead-workflow-hover', '#1d4ed8', 18)
    
    // Mode-specific arrow markers for architecture mode
    createArrowMarker('arrowhead-architecture', '#7c3aed', 15)
    createArrowMarker('arrowhead-architecture-selected', '#dc2626', 18)
    createArrowMarker('arrowhead-architecture-hover', '#6d28d9', 20)

    // Layer hierarchy
    const g = svg.append('g')
    const gridLayer = g.append('g').attr('class', 'grid-layer').style('pointer-events', 'none')
    const connectionLayer = g.append('g').attr('class', 'connection-layer')
    const mainNodeLayer = g.append('g').attr('class', 'node-layer')
    // const labelLayer = g.append('g').attr('class', 'label-layer') // No longer needed
    
    // Store node layer reference
    nodeLayerRef.current = mainNodeLayer.node() as SVGGElement
    

    // Create initial grid
    const rect = svgRef.current.getBoundingClientRect()
    createGrid(gridLayer, canvasTransform, rect.width, rect.height)

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 4])
      .on('zoom', (event) => {
        const transform = event.transform
        
        g.attr('transform', transform.toString())
        !!onZoomLevelChange && currentTransformRef.current.k!=transform.k && onZoomLevelChange(transform.k)
        createGrid(gridLayer, transform, rect.width, rect.height)
        onTransformChange(transform)
        
        // Force nodes to re-render on zoom change by updating their visual state
        if (Math.abs(transform.k - currentTransformRef.current.k) > 0.01) {
          mainNodeLayer.selectAll('.node').each(function(d: any) {
            const node = d3.select(this)
            // Force update by re-applying transform
            node.attr('transform', `translate(${d.x}, ${d.y})`)
          })
        }
      })

    svg.call(zoom)
    
    // Register zoom behavior for programmatic control
    onRegisterZoomBehavior?.(zoom)

    // Set initial transform (not in dependencies to avoid infinite loop)
    svg.call(zoom.transform, d3.zoomIdentity
      .translate(canvasTransform.x, canvasTransform.y)
      .scale(canvasTransform.k))

    // Optimized drag functions

    function dragStarted(this: any, event: any, d: WorkflowNode) {
      const nodeElement = d3.select(this)
      const dragData = d as any
      const domNode = this as SVGGElement
      
      // Clear any pending state cleanup
      if (dragStateCleanupRef.current) {
        clearTimeout(dragStateCleanupRef.current)
        dragStateCleanupRef.current = null
      }
      
      const svgElement = svgRef.current!
      const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgElement)
      const transform = d3.zoomTransform(svgElement)
      const [canvasX, canvasY] = transform.invert([mouseX, mouseY])
      
      // Use context-based dragging state
      startDragging(d.id, { x: canvasX, y: canvasY })
      
      // Force apply dragging class with protection against removal
      nodeElement.classed('dragging', true)
      
      // Store reference to prevent class removal during updates
      draggedElementRef.current = nodeElement
      draggedNodeElementRef.current = domNode
      
      // Apply dragging visual style and ensure proper z-index
      applyDragVisualStyle(nodeElement, d.id)
      // Set z-index immediately to ensure dragged node is on top
      setNodeAsDragging(d.id)
      
      // Additional protection: force class persistence
      setTimeout(() => {
        if (draggedElementRef.current && getDraggedNodeId() === d.id) {
          draggedElementRef.current.classed('dragging', true)
        }
      }, 0)
      
      dragData.dragStartX = canvasX
      dragData.dragStartY = canvasY
      dragData.initialX = d.x
      dragData.initialY = d.y
      dragData.hasDragged = false
      dragData.dragStartTime = Date.now()
    }


    function dragged(this: any, event: any, d: WorkflowNode) {
      const dragData = d as any
      if (dragData.initialX === undefined || dragData.initialY === undefined) return

      const svgElement = svgRef.current!
      const sourceEvent = event.sourceEvent || event
      const [mouseX, mouseY] = d3.pointer(sourceEvent, svgElement)
      const transform = d3.zoomTransform(svgElement)
      const [currentCanvasX, currentCanvasY] = transform.invert([mouseX, mouseY])

      const deltaX = currentCanvasX - dragData.dragStartX
      const deltaY = currentCanvasY - dragData.dragStartY

      // Update context with current drag position
      updateDragPosition(currentCanvasX, currentCanvasY)

      // Mark as dragged if movement is significant - increase threshold for better click detection
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        dragData.hasDragged = true
      }

      // Ensure dragging class is maintained during drag operation
      const nodeElement = d3.select(this)
      if (!nodeElement.classed('dragging')) {
        nodeElement.classed('dragging', true)
      }

      const newX = dragData.initialX + deltaX
      const newY = dragData.initialY + deltaY

      // Throttle visual updates with debounced RAF
      updateDraggedNodePosition(d.id, newX, newY)
      
      // Notify parent component
      onNodeDrag(d.id, newX, newY)
    }


    function dragEnded(this: any, event: any, d: WorkflowNode) {
      const dragData = d as any
      const hasDragged = dragData.hasDragged
      const dragDuration = Date.now() - (dragData.dragStartTime || 0)
      const nodeElement = d3.select(this)

      // Clean up drag state
      delete dragData.dragStartX
      delete dragData.dragStartY
      delete dragData.initialX
      delete dragData.initialY
      delete dragData.hasDragged
      delete dragData.dragStartTime

      // Only end dragging if we're still in drag state to prevent premature cleanup
      const currentDraggedNodeId = getDraggedNodeId()
      const isCurrentlyDragging = isContextDragging()
      
      // Always end dragging first, then clean up DOM
      if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
        endDragging()
      }
      
      // ALWAYS remove dragging class after drag ends, regardless of state
      nodeElement.classed('dragging', false)
      
      // Clear draggedElementRef if it points to this element
      if (draggedElementRef.current && draggedElementRef.current.node() === this) {
        draggedElementRef.current = null
      }

      // Clear drag position tracking and remove from update queues
      currentDragPositionsRef.current.delete(d.id)
      connectionUpdateQueueRef.current.delete(d.id)
      visualUpdateQueueRef.current.delete(d.id)

      // Reset visual styles
      resetNodeVisualStyle(nodeElement, d.id)

      // Reorganize z-index immediately after drag ends to restore proper order
      organizeNodeZIndex(true) // Use immediate execution to ensure proper layering

      // If no significant drag occurred, treat as click
      if (!hasDragged && event.sourceEvent && dragDuration < 500) {
        const ctrlKey = event.sourceEvent.ctrlKey || event.sourceEvent.metaKey
        onNodeClick(d, ctrlKey)
      }
    }

    // Optimized connection rendering with caching
    const connectionPaths = connectionLayer.selectAll('.connection')
      .data(connections, (d: any) => d.id)
      
    connectionPaths.exit().remove()
    
    const connectionEnter = connectionPaths
      .enter()
      .append('g')
      .attr('class', 'connection')

    // Add invisible hitbox for better hover detection (especially for dashed lines)
    connectionEnter.append('path')
      .attr('class', 'connection-hitbox')
      .attr('fill', 'none')
      .on('click', (event, d) => {
        event.stopPropagation()
        onConnectionClick(d)
      })
      .on('mouseenter', function(this: any, _event: any, d: Connection) {
        const connectionGroup = d3.select(this.parentNode)
        const connectionPath = connectionGroup.select('.connection-path')
        const isSelected = selectedConnection?.id === d.id
        
        // Clear any pending timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
        }

        // Apply production hover effects if available
        if (enhancedConnectionsEnabled && productionManagerRef.current) {
          try {
            applyProductionEffects(
              connectionGroup,
              connectionPath.node() as SVGPathElement,
              'hover'
            )
          } catch (error) {
            console.warn('⚠️ Failed to apply enhanced hover effects:', error)
          }
        }
        
        // Apply hover immediately for non-selected connections
        if (!isSelected) {
          connectionGroup.classed('connection-hover', true)
          // Force immediate visual update on the visible path
          connectionPath
            .interrupt() // Stop any ongoing transitions
            .attr('stroke', '#1976D2')
            .attr('stroke-width', 3)
            .attr('marker-end', getConnectionMarker(d, 'hover'))
        }
      })
      .on('mouseleave', function(this: any, _event: any, d: Connection) {
        const connectionGroup = d3.select(this.parentNode)
        const connectionPath = connectionGroup.select('.connection-path')
        const isSelected = selectedConnection?.id === d.id
        
        // Apply production effects to reset hover state
        if (enhancedConnectionsEnabled && productionManagerRef.current) {
          try {
            applyProductionEffects(
              connectionGroup,
              connectionPath.node() as SVGPathElement,
              isSelected ? 'selected' : 'default'
            )
          } catch (error) {
            console.warn('⚠️ Failed to apply enhanced leave effects:', error)
          }
        }
        
        // Remove hover class
        connectionGroup.classed('connection-hover', false)
        
        // Delay the visual reset to prevent flickering
        hoverTimeoutRef.current = setTimeout(() => {
          if (!isSelected && !connectionGroup.classed('connection-hover')) {
            connectionPath
              .interrupt() // Stop any ongoing transitions
              .attr('stroke', 'white')
              .attr('stroke-width', 2)
              .attr('marker-end', getConnectionMarker(d, 'default'))
          }
        }, 50) // Small delay to prevent flicker on quick mouse movements
      })

    // Add visible connection path (no interaction events, use hitbox instead)
    connectionEnter.append('path')
      .attr('class', 'connection-path')
      .attr('fill', 'none')
      .style('pointer-events', 'none') // Disable events on visible path
      .each(function() {
        // Animate new connection drawing if production features are available
        if (enhancedConnectionsEnabled && productionManagerRef.current) {
          try {
            const pathElement = this as SVGPathElement
            animateProductionConnection(pathElement)
          } catch (error) {
            console.warn('⚠️ Failed to animate connection drawing:', error)
          }
        }
      })

    // Add connection labels (only in architecture mode for multiple connections)
    connectionEnter.append('text')
      .attr('class', 'connection-label')
      .attr('font-size', 10)
      .attr('font-weight', 'bold')
      .attr('fill', '#555')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .style('display', 'none') // Initially hidden
    
    const connectionUpdate = connectionEnter.merge(connectionPaths as any)
    
    // Update hitbox path (invisible but wide for better hover detection)
    connectionUpdate.select('.connection-hitbox')
      .attr('d', (d: any) => getConnectionPath(d))

    // Update visible path with enhanced features
    connectionUpdate.select('.connection-path')
      .attr('d', (d: any) => getConnectionPath(d))
      .attr('stroke', 'white') // Default stroke - CSS will override for selection/hover
      .attr('stroke-width', 2) // Default width - CSS will override for selection/hover
      .attr('marker-end', (d: any) => getConnectionMarker(d, 'default')) // Dynamic marker based on direction
      .each(function(d: any) {
        // Apply production effects if available
        if (enhancedConnectionsEnabled && productionManagerRef.current) {
          const pathElement = this as SVGPathElement
          const parentElement = (this as SVGElement).parentElement
          if (!parentElement) return
          const connectionGroup = d3.select(parentElement as unknown as SVGGElement)
          
          try {
            applyProductionEffects(
              connectionGroup,
              pathElement,
              'default'
            )
          } catch (error) {
            console.warn('⚠️ Failed to apply enhanced effects:', error)
          }
        }
      })
      .attr('class', (d: any) => {
        const groupInfo = getConnectionGroupInfo(d.id, connections)
        let classes = 'connection-path'
        
        if (groupInfo.isMultiple) {
          classes += ' multiple-connection'
          if (groupInfo.index === 1) classes += ' secondary'
          if (groupInfo.index === 2) classes += ' tertiary'
        }
        
        return classes
      })

    // Update connection labels
    connectionUpdate.select('.connection-label')
      .style('display', (d: any) => {
        // Show labels only in architecture mode for multiple connections
        if (workflowContextState.designerMode !== 'architecture') return 'none'
        
        const groupInfo = getConnectionGroupInfo(d.id, connections)
        return groupInfo.isMultiple ? 'block' : 'none'
      })
      .attr('x', (d: any) => {
        // Position label at midpoint of connection
        const sourceNode = nodeMap.get(d.sourceNodeId)
        const targetNode = nodeMap.get(d.targetNodeId)
        if (!sourceNode || !targetNode) return 0
        
        return (sourceNode.x + targetNode.x) / 2
      })
      .attr('y', (d: any) => {
        // Position label at midpoint of connection
        const sourceNode = nodeMap.get(d.sourceNodeId)
        const targetNode = nodeMap.get(d.targetNodeId)
        if (!sourceNode || !targetNode) return 0
        
        const groupInfo = getConnectionGroupInfo(d.id, connections)
        const yOffset = groupInfo.isMultiple ? (groupInfo.index - 1) * 15 - 10 : 0
        
        return (sourceNode.y + targetNode.y) / 2 + yOffset
      })
      .text((d: any) => {
        // Generate descriptive labels for different connection types
        const sourceNode = nodeMap.get(d.sourceNodeId)
        const targetNode = nodeMap.get(d.targetNodeId)
        const groupInfo = getConnectionGroupInfo(d.id, connections)
        
        if (!sourceNode || !targetNode || !groupInfo.isMultiple) return ''
        
        // Generate meaningful labels based on port types and node types
        const sourcePort = sourceNode.outputs?.find(p => p.id === d.sourcePortId)
        const targetPort = targetNode.inputs?.find(p => p.id === d.targetPortId)
        
        if (sourcePort && targetPort) {
          // Use port labels if available
          if (sourcePort.label && targetPort.label) {
            return `${sourcePort.label} → ${targetPort.label}`
          }
        }
        
        // Fallback to endpoint numbering
        return `Endpoint ${groupInfo.index + 1}`
      })

    // Render connection preview
    if (isConnecting && connectionStart) {
      console.log('🎯 Connection preview check:', { isConnecting, connectionStart, connectionPreview })
      const sourceNode = nodes.find(n => n.id === connectionStart.nodeId)
      if (sourceNode && connectionPreview) {
        console.log('🎯 Rendering connection preview from:', sourceNode.id, 'to:', connectionPreview)
        const previewPath = calculateConnectionPreviewPath(
          sourceNode,
          connectionStart.portId,
          connectionPreview,
          nodeVariant
        )
        
        // Determine preview marker based on source port type and direction
        const isSourceBottomPort = sourceNode.bottomPorts?.some(p => p.id === connectionStart.portId)
        const isLeftToRight = connectionPreview.x > sourceNode.x
        let previewMarker = 'url(#arrowhead)'
        
        if (isSourceBottomPort && !isLeftToRight) {
          previewMarker = 'url(#arrowhead-left)'
        }
        
        g.append('path')
          .attr('class', 'connection-preview')
          .attr('d', previewPath)
          .attr('stroke', '#2196F3')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5')
          .attr('fill', 'none')
          .attr('marker-end', previewMarker)
          .attr('pointer-events', 'none')
          .style('opacity', 0.7)
      } else {
        console.log('🎯 Not rendering preview:', { sourceNode: !!sourceNode, connectionPreview: !!connectionPreview })
      }
    }

    // Render nodes
    const nodeSelection = mainNodeLayer.selectAll('.node')
      .data(nodes, (d: any) => d.id)
    
    nodeSelection.exit()
      .each(function(d: any) {
        // Clean up from our centralized management
        allNodeElementsRef.current.delete(d.id)
      })
      .remove()
    
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .attr('data-node-id', (d: any) => d.id)
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'move')
      .each(function(d: any) {
        // Register node element in our centralized management
        allNodeElementsRef.current.set(d.id, this)
        
        // Essential: Preserve dragging state for newly created elements
        if (isDragging && draggedNodeId === d.id) {
          const nodeElement = d3.select(this)
          nodeElement.classed('dragging', true)
          // Update draggedElementRef to point to the new element
          draggedElementRef.current = nodeElement
        }
      })
      .call(d3.drag<any, WorkflowNode>()
        .container(g.node() as any)
        .clickDistance(5) // Increase click distance for better click detection
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded) as any)

    const nodeGroups = nodeEnter.merge(nodeSelection as any)
    
    // Enhanced: Immediately preserve dragging state after merge operation 
    // This must happen before any other node operations to prevent class removal
    nodeGroups.each(function(d: any) {
      const nodeElement = d3.select(this)
      const currentDraggedNodeId = getDraggedNodeId()
      const isCurrentlyDragging = isContextDragging()
      
      if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
        // Force apply dragging class immediately after merge
        nodeElement.classed('dragging', true)
        // Ensure draggedElementRef points to the correct merged element
        if (draggedElementRef.current === null || draggedElementRef.current.node() !== this) {
          draggedElementRef.current = nodeElement
        }
      }
    })

    // Add hover events for architecture mode port visibility
    nodeGroups
      .on('mouseenter', function() {
        const nodeElement = d3.select(this)
        const isArchitectureMode = workflowContextState.designerMode === 'architecture'
        
        if (isArchitectureMode) {
          // Show ports on hover in architecture mode
          nodeElement.selectAll('.input-port-group, .output-port-group')
            .style('opacity', 1)
            .style('pointer-events', 'all')
        }
      })
      .on('mouseleave', function() {
        const nodeElement = d3.select(this)
        const isArchitectureMode = workflowContextState.designerMode === 'architecture'
        
        if (isArchitectureMode) {
          // Hide ALL ports when not hovering in architecture mode (including connected ones)
          nodeElement.selectAll('.input-port-group, .output-port-group')
            .style('opacity', 0)
            .style('pointer-events', 'none')
        }
      })
    
    // Update positions for non-dragging nodes
    nodeGroups
      .filter(function() {
        return !d3.select(this).classed('dragging')
      })
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)


    // Node background (shape-aware)
    nodeEnter.append('path')
      .attr('class', 'node-background')
      .on('click', (event: any, d: WorkflowNode) => {
        // Fallback click handler for node background
        if (!isDragging) {
          event.stopPropagation()
          const ctrlKey = event.ctrlKey || event.metaKey
          onNodeClick(d, ctrlKey)
        }
      })
      .on('dblclick', (event: any, d: WorkflowNode) => {
        event.stopPropagation()
        event.preventDefault()
        onNodeDoubleClick(d)
      })
      .on('dragover', (event: any, d: WorkflowNode) => {
        // Allow drop if connecting and can drop on this node
        if (isConnecting && canDropOnNode?.(d.id)) {
          event.preventDefault()
          event.stopPropagation()
          // Add visual feedback with enhanced styling
          const nodeElement = d3.select(event.currentTarget.parentNode)
          nodeElement.classed('can-drop-node', true)
          d3.select(event.currentTarget).classed('can-drop', true)
          
          // Highlight available input ports
          nodeElement.selectAll('.input-port')
            .classed('drop-target-port', function(this: any, portData: any) {
              // Type-safe port data access
              const typedPortData = portData as (NodePort & { nodeId: string })
              
              // In architecture mode, allow multiple connections to the same port
              if (workflowContextState.designerMode === 'architecture') {
                // Only highlight if not an exact duplicate connection
                return !connections.some((conn: Connection) => 
                  conn.sourceNodeId === connectionStart?.nodeId &&
                  conn.sourcePortId === connectionStart?.portId &&
                  conn.targetNodeId === d.id && 
                  conn.targetPortId === typedPortData.id
                )
              }
              
              // In workflow mode, use original logic (no multiple connections to same port)
              return !connections.some((conn: Connection) => 
                conn.targetNodeId === d.id && conn.targetPortId === typedPortData.id
              )
            })
        }
      })
      .on('dragleave', (event: any) => {
        // Remove visual feedback
        const nodeElement = d3.select(event.currentTarget.parentNode)
        nodeElement.classed('can-drop-node', false)
        d3.select(event.currentTarget).classed('can-drop', false)
        
        // Remove port highlighting
        nodeElement.selectAll('.input-port').classed('drop-target-port', false)
      })
      .on('drop', (event: any, d: WorkflowNode) => {
        event.preventDefault()
        event.stopPropagation()
        
        // Remove visual feedback
        const nodeElement = d3.select(event.currentTarget.parentNode)
        nodeElement.classed('can-drop-node', false)
        d3.select(event.currentTarget).classed('can-drop', false)
        nodeElement.selectAll('.input-port').classed('drop-target-port', false)
        
        // Handle connection drop on node
        if (isConnecting && canDropOnNode?.(d.id)) {
          // Smart port selection based on designer mode
          let availableInputPorts: NodePort[] = []
          
          if (workflowContextState.designerMode === 'architecture') {
            // In architecture mode, allow connections to any input port (including already connected ones)
            // Only prevent exact duplicate connections
            availableInputPorts = d.inputs?.filter((port: NodePort) => {
              // Check if this exact connection already exists
              return !connections.some((conn: Connection) => 
                conn.sourceNodeId === connectionStart?.nodeId &&
                conn.sourcePortId === connectionStart?.portId &&
                conn.targetNodeId === d.id && 
                conn.targetPortId === port.id
              )
            }) || []
          } else {
            // In workflow mode, use original logic (only unconnected ports)
            availableInputPorts = d.inputs?.filter((port: NodePort) => {
              return !connections.some((conn: Connection) => 
                conn.targetNodeId === d.id && conn.targetPortId === port.id
              )
            }) || []
          }
          
          if (availableInputPorts.length > 0) {
            // Strategy: prefer first available port, but could be enhanced with type matching
            const targetPort = availableInputPorts[0]
            console.log(`📍 Node background drop (${workflowContextState.designerMode} mode) - connecting to port:`, d.id, targetPort.id)
            onPortDragEnd(d.id, targetPort.id)
          } else {
            // No available input ports
            console.log(`⚠️ Node background drop (${workflowContextState.designerMode} mode) - no available input ports on:`, d.id)
            onPortDragEnd()
          }
        }
      })
      
    // Update node background attributes (shape-aware)
    nodeGroups.select('.node-background')
      .attr('d', (d: any) => {
        const shape = getNodeShape(d.type)
        let borderRadius: number | { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number } = 0
        
        // Custom border radius for different node types
        if (d.type === 'start') {
          // Asymmetric border radius for start node: left 30%, right default
          const dimensions = getShapeAwareDimensions(d)
          const leftRadius = Math.min(dimensions.width, dimensions.height) * 0.3
          const rightRadius = 8 // default radius
          borderRadius = {
            topLeft: leftRadius,
            bottomLeft: leftRadius,
            topRight: rightRadius,
            bottomRight: rightRadius
          }
        } else if (shape === 'rectangle' || shape === 'square') {
          borderRadius = 8
        }
        
        const shapePath = getNodeShapePath(d, borderRadius)
        return shapePath.d
      })
      .attr('fill', '#ffffff')
      .attr('stroke', (d: any) => {
        // CRITICAL: Skip stroke color update for actively dragged node to preserve blue border
        const currentDraggedNodeId = getDraggedNodeId()
        const isCurrentlyDragging = isContextDragging()
        
        if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
          // Return blue color for dragged node
          return '#2196F3'
        }
        
        return getNodeColor(d.type, d.status)
      })
      .attr('stroke-width', (d: any) => {
        // CRITICAL: Skip stroke width update for actively dragged node
        const currentDraggedNodeId = getDraggedNodeId() 
        const isCurrentlyDragging = isContextDragging()
        
        if (isCurrentlyDragging && currentDraggedNodeId === d.id) {
          // Return thicker width for dragged node
          return 3
        }
        
        return 2
      })

    // Apply visual styling to all nodes using centralized system with improved stability
    nodeGroups.each(function(d: any) {
      const nodeElement = d3.select(this)
      const isSelected = isNodeSelected(d.id)
      
      // Add legacy endpoint class for architecture mode
      if (workflowContextState.designerMode === 'architecture' && isLegacyEndpoint(d)) {
        nodeElement.classed('legacy-endpoint', true)
      } else {
        nodeElement.classed('legacy-endpoint', false)
      }
      
      // Enhanced dragging state detection with context-based state using fresh values
      let isNodeDragging = false
      const currentDraggedNodeId = getDraggedNodeId()
      const isCurrentlyDragging = isContextDragging()
      
      // Check current DOM state first to preserve existing dragging class
      const hasExistingDraggingClass = nodeElement.classed('dragging')
      
      // Only process drag state if we have valid context state
      if (currentDraggedNodeId && isCurrentlyDragging && currentDraggedNodeId === d.id) {
        // Force apply dragging class for the dragged node - no stale checks during active drag
        if (!hasExistingDraggingClass) {
          nodeElement.classed('dragging', true)
        }
        isNodeDragging = true
        
        // Ensure we maintain the correct draggedElementRef reference
        const currentDraggedElement = draggedElementRef.current
        if (!currentDraggedElement || currentDraggedElement.node() !== this) {
          draggedElementRef.current = nodeElement
        }
      } else if (isCurrentlyDragging && currentDraggedNodeId && currentDraggedNodeId !== d.id) {
        // For other nodes during drag, ensure dragging class is removed
        if (hasExistingDraggingClass) {
          nodeElement.classed('dragging', false)
        }
      } else if (!isCurrentlyDragging) {
        // Only clean up when not dragging at all
        if (hasExistingDraggingClass) {
          nodeElement.classed('dragging', false)
        }
      } else {
        // Preserve existing dragging state if conditions are unclear
        isNodeDragging = hasExistingDraggingClass
      }
      
      // Fallback cleanup: Force remove dragging class if context says we're not dragging
      if (!isCurrentlyDragging && hasExistingDraggingClass) {
        nodeElement.classed('dragging', false)
        isNodeDragging = false
      }
      
      const nodeBackground = nodeElement.select('.node-background')
      
      // Apply CSS classes
      nodeElement.classed('selected', isSelected)
      
      // Apply visual styling with consistent blue border for selected/dragging states
      let opacity = 1
      let filter = 'none'
      let strokeColor = getNodeColor(d.type, d.status)
      let strokeWidth = 2
      
      // Priority: Selected OR Dragging should use blue border
      if (isSelected || isNodeDragging) {
        strokeColor = '#2196F3' // Always use blue for selected or dragging
        strokeWidth = 3
        
        if (isNodeDragging) {
          opacity = 0.9
          filter = 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))'
        } else if (isSelected) {
          filter = 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))'
        }
      }
      
      nodeElement
        .style('opacity', opacity)
        .style('filter', filter)
      
      nodeBackground
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
    })
    
    // Mark as initialized and organize z-index
    if (!isInitialized) {
      setIsInitialized(true)
      // Initial z-index organization - use immediate execution for initial setup
      setTimeout(() => {
        if (!isDragging) {
          organizeNodeZIndex(true) // Immediate execution for initialization
        }
      }, 0)
    }

    // Node icon
    nodeEnter.append('text')
      .attr('class', 'node-icon')
      .style('pointer-events', 'none')
    
    nodeGroups.select('.node-icon')
      .attr('x', (d: any) => {
        const dimensions = getConfigurableDimensions(d)
        return dimensions.iconOffset?.x || 0
      })
      .attr('y', (d: any) => {
        const dimensions = getConfigurableDimensions(d)
        return dimensions.iconOffset?.y || -8
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', (d: any) => getConfigurableDimensions(d).iconSize || 18)
      .attr('fill', '#333')
      .text((d: any) => getNodeIcon(d.type))

    // Node label
    nodeEnter.append('text')
      .attr('class', 'node-label')
      .style('pointer-events', 'none')

    // Legacy endpoint badge (only in architecture mode)
    nodeEnter.append('g')
      .attr('class', 'legacy-badge-group')
      .style('display', (d: any) => {
        return workflowContextState.designerMode === 'architecture' && isLegacyEndpoint(d) ? 'block' : 'none'
      })
    
    const legacyBadgeGroup = nodeEnter.select('.legacy-badge-group')
    
    // Badge background
    legacyBadgeGroup.append('rect')
      .attr('class', 'legacy-badge-bg')
      .attr('x', (d: any) => {
        const dimensions = getConfigurableDimensions(d)
        return (dimensions.width / 2) - 15
      })
      .attr('y', (d: any) => {
        const dimensions = getConfigurableDimensions(d)
        return -(dimensions.height / 2) - 10
      })
      .attr('width', 30)
      .attr('height', 16)
      .attr('rx', 3)
      .attr('fill', '#9C27B0')
      .attr('stroke', '#7B1FA2')
      .attr('stroke-width', 1)
    
    // Badge text
    legacyBadgeGroup.append('text')
      .attr('class', 'legacy-badge-text')
      .attr('x', (d: any) => {
        const dimensions = getConfigurableDimensions(d)
        return (dimensions.width / 2)
      })
      .attr('y', (d: any) => {
        const dimensions = getConfigurableDimensions(d)
        return -(dimensions.height / 2) - 2
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .text('LEGACY')
    
    nodeGroups.select('.node-label')
      .attr('x', (d: any) => {
        const dimensions = getConfigurableDimensions(d)
        return dimensions.labelOffset?.x || 0
      })
      .attr('y', (d: any) => {
        const dimensions = getConfigurableDimensions(d)
        return dimensions.labelOffset?.y || 15
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', (d: any) => (getConfigurableDimensions(d).fontSize || 12) - 1)
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text((d: any) => {
        // Use the proper label from NodeTypes based on type, fallback to d.label
        const nodeTypeInfo = NodeTypes[d.type as keyof typeof NodeTypes]
        return nodeTypeInfo?.label || d.label || d.type
      })

    // Update legacy badge visibility for existing nodes
    nodeGroups.select('.legacy-badge-group')
      .style('display', (d: any) => {
        return workflowContextState.designerMode === 'architecture' && isLegacyEndpoint(d) ? 'block' : 'none'
      })

    // Render simple ports for both variants
    // Input ports
    const inputPortGroups = nodeGroups.selectAll('.input-port-group')
      .data((d: any) => d.inputs.map((input: any) => ({ ...input, nodeId: d.id, nodeData: d })))
      .join('g')
      .attr('class', (d: any) => {
        // Check if this port has any connections
        const hasConnection = connections.some(conn => 
          conn.targetNodeId === d.nodeId && conn.targetPortId === d.id
        )
        
        // Add architecture mode specific classes
        const baseClass = hasConnection ? 'input-port-group connected' : 'input-port-group'
        const highlightClass = getPortHighlightClass(d.nodeId, d.id, 'input')
        
        return `${baseClass} ${highlightClass}`.trim()
      })
      .style('cursor', 'crosshair')
      .style('pointer-events', 'all')
      .on('click', (event: any, d: any) => {
        event.stopPropagation()
        onPortClick(d.nodeId, d.id, 'input')
      })
      .call(d3.drag<any, any>()
        .on('start', (event: any, d: any) => {
          event.sourceEvent.stopPropagation()
          event.sourceEvent.preventDefault()
          onPortDragStart(d.nodeId, d.id, 'input')
          
          const [x, y] = d3.pointer(event.sourceEvent, event.sourceEvent.target.ownerSVGElement)
          const transform = d3.zoomTransform(event.sourceEvent.target.ownerSVGElement)
          const [canvasX, canvasY] = transform.invert([x, y])
          onPortDrag(canvasX, canvasY)
        })
        .on('drag', (event: any) => {
          const [x, y] = d3.pointer(event.sourceEvent, event.sourceEvent.target.ownerSVGElement)
          const transform = d3.zoomTransform(event.sourceEvent.target.ownerSVGElement)
          const [canvasX, canvasY] = transform.invert([x, y])
          onPortDrag(canvasX, canvasY)
        })
        .on('end', (event: any) => {
          console.log('Input port drag end', event.sourceEvent.clientX, event.sourceEvent.clientY)
          
          // Alternative method: use D3 pointer and hit testing
          const svgElement = event.sourceEvent.target.ownerSVGElement
          const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgElement)
          console.log('Mouse position in SVG (input):', mouseX, mouseY)
          
          let targetNodeId: string | undefined
          let targetPortId: string | undefined
          
          // Find all output port circles and check if mouse is over them
          const allOutputPorts = d3.select(svgElement).selectAll('.output-port-circle')
          
          allOutputPorts.each(function(d: any) {
            const circle = d3.select(this)
            const cx = parseFloat(circle.attr('cx'))
            const cy = parseFloat(circle.attr('cy'))
            const r = parseFloat(circle.attr('r'))
            
            // Get the port's parent group transform
            const element = this as SVGElement
            const portGroup = d3.select(element.parentNode as SVGElement)
            const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGElement)
            const transform = nodeGroup.attr('transform')
            
            let nodeX = 0, nodeY = 0
            if (transform) {
              const regex = /translate\(([^,]+),([^)]+)\)/
              const match = regex.exec(transform)
              if (match) {
                nodeX = parseFloat(match[1])
                nodeY = parseFloat(match[2])
              }
            }
            
            const actualX = nodeX + cx
            const actualY = nodeY + cy
            
            // Check if mouse is within port radius
            const distance = Math.sqrt((mouseX - actualX) ** 2 + (mouseY - actualY) ** 2)
            if (distance <= r + 5) { // Add 5px tolerance
              targetNodeId = nodeGroup.attr('data-node-id')
              targetPortId = d.id
              console.log('Found output port via hit test:', targetNodeId, targetPortId, 'distance:', distance)
            }
          })
          
          console.log('Final target (input drag):', targetNodeId, targetPortId)
          onPortDragEnd(targetNodeId, targetPortId)
        })
      )

    inputPortGroups.selectAll('circle').remove()
    inputPortGroups.append('circle')
      .attr('class', 'input-port-circle')
      .attr('cx', (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, 'input')
        return positions[i]?.x || 0
      })
      .attr('cy', (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, 'input')
        return positions[i]?.y || 0
      })
      .attr('r', (d: any) => getConfigurableDimensions(d.nodeData).portRadius || 6)
      .attr('fill', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'output') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'input')
          return canDrop ? '#4CAF50' : getPortColor('any')
        }
        return getPortColor('any')
      })
      .attr('stroke', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'output') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'input')
          return canDrop ? '#4CAF50' : '#ff5722'
        }
        return '#333'
      })
      .attr('stroke-width', 2)

    //console.log('🔵 Created', inputPortGroups.selectAll('circle').size(), 'input port circles')

    // Add port capacity indicators (only in architecture mode)
    inputPortGroups.selectAll('.port-capacity-indicator').remove()
    inputPortGroups.filter(() => workflowContextState.designerMode === 'architecture')
      .append('text')
      .attr('class', 'port-capacity-indicator')
      .attr('x', (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, 'input')
        return positions[i]?.x || 0
      })
      .attr('y', (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, 'input')
        return (positions[i]?.y || 0) + 20
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', '#666')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        const connectionCount = connections.filter(conn => 
          conn.targetNodeId === d.nodeId && conn.targetPortId === d.id
        ).length
        
        if (connectionCount === 0) return 'Multi ∞'
        return `${connectionCount} conn${connectionCount !== 1 ? 's' : ''}`
      })

    // Output ports
    const outputPortGroups = nodeGroups.selectAll('.output-port-group')
      .data((d: any) => d.outputs.map((output: any) => ({ ...output, nodeId: d.id, nodeData: d })))
      .join('g')
      .attr('class', (d: any) => {
        // Check if this port has any connections
        const hasConnection = connections.some(conn => 
          conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        )
        return hasConnection ? 'output-port-group connected' : 'output-port-group'
      })
      .style('cursor', 'crosshair')
      .style('pointer-events', 'all')
      .on('click', (event: any, d: any) => {
        event.stopPropagation()
        onPortClick(d.nodeId, d.id, 'output')
      })
      .call(d3.drag<any, any>()
        .on('start', (event: any, d: any) => {
          event.sourceEvent.stopPropagation()
          event.sourceEvent.preventDefault()
          console.log('🚀 Output port drag START:', d.nodeId, d.id)
          onPortDragStart(d.nodeId, d.id, 'output')
        })
        .on('drag', (event: any) => {
          const [x, y] = d3.pointer(event.sourceEvent, event.sourceEvent.target.ownerSVGElement)
          const transform = d3.zoomTransform(event.sourceEvent.target.ownerSVGElement)
          const [canvasX, canvasY] = transform.invert([x, y])
          console.log('🚀 Output port DRAGGING to:', canvasX, canvasY)
          onPortDrag(canvasX, canvasY)
        })
        .on('end', (event: any) => {
          console.log('🚀 Output port drag END')
          
          // Get correct SVG element and apply zoom transform
          const svgElement = event.sourceEvent.target.ownerSVGElement
          const svgSelection = d3.select(svgElement)
          
          // Get current zoom transform to correct coordinates
          const currentTransform = d3.zoomTransform(svgElement)
          console.log('🔍 Current zoom transform:', {
            k: currentTransform.k,
            x: currentTransform.x, 
            y: currentTransform.y
          })
          
          // Get mouse position in screen coordinates first
          const [screenX, screenY] = d3.pointer(event.sourceEvent, svgElement)
          console.log('📍 Screen coordinates:', screenX, screenY)
          
          // Apply inverse transform to get canvas coordinates
          const [canvasX, canvasY] = currentTransform.invert([screenX, screenY])
          console.log('🎯 Canvas coordinates:', canvasX, canvasY)
          
          let targetNodeId: string | undefined
          let targetPortId: string | undefined
          
          // Find target input port by checking all input port circles and bottom port diamonds
          const allInputPorts = svgSelection.selectAll('.input-port-circle')
          const allBottomPorts = svgSelection.selectAll('.bottom-port-diamond')
          let minDistance = Infinity
          
          console.log('🔍 Found', allInputPorts.size(), 'input ports and', allBottomPorts.size(), 'bottom ports to check')
          
          allInputPorts.each(function(portData: any) {
            const circle = d3.select(this)
            const element = this as SVGElement
            
            // Get port position in SVG coordinates
            const portGroup = d3.select(element.parentNode as SVGElement)
            const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGElement)
            
            if (nodeGroup.empty()) {
              console.log('⚠️ Could not find parent node group for port')
              return
            }
            
            const nodeId = nodeGroup.attr('data-node-id')
            const transform = nodeGroup.attr('transform')
            let nodeSvgX = 0, nodeSvgY = 0
            
            if (transform) {
              const match = /translate\(([^,]+),([^)]+)\)/.exec(transform)
              if (match) {
                nodeSvgX = parseFloat(match[1])
                nodeSvgY = parseFloat(match[2])
              }
            }
            
            const cx = parseFloat(circle.attr('cx') || '0')
            const cy = parseFloat(circle.attr('cy') || '0')
            const r = parseFloat(circle.attr('r') || '8')
            
            // Port position in SVG coordinates (this is already in canvas space)
            const portCanvasX = nodeSvgX + cx
            const portCanvasY = nodeSvgY + cy
            
            // Calculate distance directly in canvas coordinates
            const distance = Math.sqrt((canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2)
            const tolerance = r + 15 // Increased tolerance for easier dropping
            
            console.log('🎯 Checking port:', {
              nodeId,
              portId: portData.id,
              portCanvasPos: { x: portCanvasX, y: portCanvasY },
              mouseCanvasPos: { x: canvasX, y: canvasY },
              distance,
              tolerance,
              isWithinRange: distance <= tolerance
            })
            
            // Use closest valid input port with tolerance
            if (distance <= tolerance && distance < minDistance) {
              minDistance = distance
              targetNodeId = nodeId
              targetPortId = portData.id
              console.log('🎯✅ Found best input port target:', targetNodeId, targetPortId, 'distance:', distance)
            }
          })
          
          // Also check bottom ports (diamond shapes)
          allBottomPorts.each(function(portData: any) {
            const diamond = d3.select(this)
            const element = this as SVGElement
            
            // Get port position in SVG coordinates
            const portGroup = d3.select(element.parentNode as SVGElement)
            const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGElement)
            
            if (nodeGroup.empty()) {
              console.log('⚠️ Could not find parent node group for bottom port')
              return
            }
            
            const nodeId = nodeGroup.attr('data-node-id')
            const nodeTransform = nodeGroup.attr('transform')
            let nodeSvgX = 0, nodeSvgY = 0
            
            if (nodeTransform) {
              const match = /translate\(([^,]+),([^)]+)\)/.exec(nodeTransform)
              if (match) {
                nodeSvgX = parseFloat(match[1])
                nodeSvgY = parseFloat(match[2])
              }
            }
            
            // Get diamond position from its transform
            const diamondTransform = diamond.attr('transform')
            let diamondX = 0, diamondY = 0
            
            if (diamondTransform) {
              const match = /translate\(([^,]+),([^)]+)\)/.exec(diamondTransform)
              if (match) {
                diamondX = parseFloat(match[1])
                diamondY = parseFloat(match[2])
              }
            }
            
            // Port position in SVG coordinates (this is already in canvas space)
            const portCanvasX = nodeSvgX + diamondX
            const portCanvasY = nodeSvgY + diamondY
            
            // Calculate distance directly in canvas coordinates
            const distance = Math.sqrt((canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2)
            const tolerance = 15 // Tolerance for diamond shape
            
            console.log('🎯 Checking bottom port (diamond):', {
              nodeId,
              portId: portData.id,
              portCanvasPos: { x: portCanvasX, y: portCanvasY },
              mouseCanvasPos: { x: canvasX, y: canvasY },
              distance,
              tolerance,
              isWithinRange: distance <= tolerance
            })
            
            // Use closest valid bottom port with tolerance
            if (distance <= tolerance && distance < minDistance) {
              minDistance = distance
              targetNodeId = nodeId
              targetPortId = portData.id
              console.log('🎯✅ Found best bottom port target:', targetNodeId, targetPortId, 'distance:', distance)
            }
          })

          // If no port target found, check for node background drop areas
          if (!targetNodeId) {
            console.log('🎯 No port target found, checking node background areas')
            
            // Find all nodes and check if mouse is within their boundaries
            const allNodes = svgSelection.selectAll('g[data-node-id]')
            let minNodeDistance = Infinity
            
            allNodes.each(function(nodeData: any) {
              const nodeGroup = d3.select(this)
              const nodeId = nodeGroup.attr('data-node-id')
              
              // Skip if this is the source node (can't connect to self)
              if (connectionStart && nodeId === connectionStart.nodeId) {
                return
              }
              
              // Check if we can drop on this node
              if (!canDropOnNode?.(nodeId)) {
                return
              }
              
              // Get node transform (position)
              const transform = nodeGroup.attr('transform')
              let nodeSvgX = 0, nodeSvgY = 0
              
              if (transform) {
                const match = /translate\(([^,]+),([^)]+)\)/.exec(transform)
                if (match) {
                  nodeSvgX = parseFloat(match[1])
                  nodeSvgY = parseFloat(match[2])
                }
              }
              
              // Get node dimensions and shape
              const nodeDimensions = getShapeAwareDimensions(nodeData)
              const nodeShape = getNodeShape(nodeData.type)
              
              console.log('🎯 Checking node background area:', {
                nodeId,
                nodePosition: { x: nodeSvgX, y: nodeSvgY },
                mousCanvas: { x: canvasX, y: canvasY },
                dimensions: nodeDimensions,
                shape: nodeShape
              })
              
              // Check if mouse is within node boundaries
              let isWithinNode = false
              const tolerance = 10 // Small tolerance for easier dropping
              
              if (nodeShape === 'circle') {
                // Circular node - check radius
                const radius = Math.max(nodeDimensions.width, nodeDimensions.height) / 2
                const distance = Math.sqrt((canvasX - nodeSvgX) ** 2 + (canvasY - nodeSvgY) ** 2)
                isWithinNode = distance <= (radius + tolerance)
                
                if (isWithinNode && distance < minNodeDistance) {
                  minNodeDistance = distance
                  targetNodeId = nodeId
                  console.log('🎯✅ Found node background target (circle):', nodeId, 'distance:', distance)
                }
              } else {
                // Rectangular node - check bounds
                const halfWidth = nodeDimensions.width / 2
                const halfHeight = nodeDimensions.height / 2
                
                const isWithinX = canvasX >= (nodeSvgX - halfWidth - tolerance) && 
                                 canvasX <= (nodeSvgX + halfWidth + tolerance)
                const isWithinY = canvasY >= (nodeSvgY - halfHeight - tolerance) && 
                                 canvasY <= (nodeSvgY + halfHeight + tolerance)
                
                isWithinNode = isWithinX && isWithinY
                
                if (isWithinNode) {
                  // Calculate distance from node center for priority
                  const distance = Math.sqrt((canvasX - nodeSvgX) ** 2 + (canvasY - nodeSvgY) ** 2)
                  
                  if (distance < minNodeDistance) {
                    minNodeDistance = distance
                    targetNodeId = nodeId
                    console.log('🎯✅ Found node background target (rectangle):', nodeId, 'distance:', distance)
                  }
                }
              }
            })
            
            // If we found a node background target, use smart port selection
            if (targetNodeId) {
              console.log('🎯 Node background drop detected, finding best input port for:', targetNodeId)
              
              // Find the target node data
              const targetNode = nodes.find(n => n.id === targetNodeId)
              if (targetNode?.inputs?.length) {
                // Smart port selection: find the best available input port
                const availableInputPorts = targetNode.inputs.filter((port: any) => {
                  if (!canDropOnPort || !targetNodeId) return true
                  return canDropOnPort(targetNodeId, port.id, 'input')
                })
                
                if (availableInputPorts.length > 0) {
                  // Strategy: prefer first available port, could be enhanced with type matching
                  targetPortId = availableInputPorts[0].id
                  console.log('🎯✅ Selected input port for node background drop:', targetPortId)
                } else {
                  console.log('⚠️ No available input ports on target node:', targetNodeId)
                  targetNodeId = undefined // Reset if no valid ports
                }
              } else {
                console.log('⚠️ Target node has no input ports:', targetNodeId)
                targetNodeId = undefined // Reset if no input ports
              }
            }
          }

          console.log('🏁 Final target result:', { targetNodeId, targetPortId, minDistance })
          onPortDragEnd(targetNodeId, targetPortId)
        })
      )

    // Create output port circles
    outputPortGroups.selectAll('circle').remove()
    outputPortGroups.append('circle')
      .attr('class', 'output-port-circle')
      .attr('cx', (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, 'output')
        return positions[i]?.x || 0
      })
      .attr('cy', (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, 'output')
        return positions[i]?.y || 0
      })
      .attr('r', (d: any) => getConfigurableDimensions(d.nodeData).portRadius || 6)
      .attr('fill', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'input') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'output')
          return canDrop ? '#4CAF50' : getPortColor('any')
        }
        return getPortColor('any')
      })
      .attr('stroke', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'input') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'output')
          return canDrop ? '#4CAF50' : '#ff5722'
        }
        return '#333'
      })
      .attr('stroke-width', 2)

    //console.log('🔴 Created', outputPortGroups.selectAll('circle').size(), 'output port circles')

    // Add output port capacity indicators (only in architecture mode)
    outputPortGroups.selectAll('.port-capacity-indicator').remove()
    outputPortGroups.filter(() => workflowContextState.designerMode === 'architecture')
      .append('text')
      .attr('class', 'port-capacity-indicator')
      .attr('x', (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, 'output')
        return positions[i]?.x || 0
      })
      .attr('y', (d: any, i: number) => {
        const positions = getPortPositions(d.nodeData, 'output')
        return (positions[i]?.y || 0) + 20
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', '#666')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        const connectionCount = connections.filter(conn => 
          conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        ).length
        
        if (connectionCount === 0) return 'Multi ∞'
        return `${connectionCount} conn${connectionCount !== 1 ? 's' : ''}`
      })

    // Bottom ports - สำหรับ AI Agent nodes ที่มี bottomPorts
    const bottomPortGroups = nodeGroups.filter((d: any) => d.bottomPorts && d.bottomPorts.length > 0)
      .selectAll('.bottom-port-group')
      .data((d: any) => {
        if (!d.bottomPorts) return []
        
        // Return all bottom ports (both connected and unconnected) for the diamond shapes
        // The connector lines and plus buttons will be handled separately
        return d.bottomPorts.map((port: any) => ({ ...port, nodeId: d.id, nodeData: d }))
      })
      .join('g')
      .attr('class', 'bottom-port-group')
      .style('cursor', 'crosshair')
      .style('pointer-events', 'all')
      // Add drag behavior for bottom port diamonds
      .call(d3.drag<any, any>()
        .on('start', (event: any, d: any) => {
          console.log('🚀 Bottom port diamond drag START:', d.nodeId, d.id)
          event.sourceEvent.stopPropagation()
          event.sourceEvent.preventDefault()
          // Start connection drag as if it's an output port
          onPortDragStart(d.nodeId, d.id, 'output')
          
          const [x, y] = d3.pointer(event.sourceEvent, event.sourceEvent.target.ownerSVGElement)
          const transform = d3.zoomTransform(event.sourceEvent.target.ownerSVGElement)
          const [canvasX, canvasY] = transform.invert([x, y])
          onPortDrag(canvasX, canvasY)
        })
        .on('drag', (event: any) => {
          const [x, y] = d3.pointer(event.sourceEvent, event.sourceEvent.target.ownerSVGElement)
          const transform = d3.zoomTransform(event.sourceEvent.target.ownerSVGElement)
          const [canvasX, canvasY] = transform.invert([x, y])
          console.log('🚀 Bottom port diamond DRAGGING to:', canvasX, canvasY)
          onPortDrag(canvasX, canvasY)
        })
        .on('end', (event: any) => {
          console.log('🚀 Bottom port diamond drag END')
          
          // Get correct SVG element and apply zoom transform
          const svgElement = event.sourceEvent.target.ownerSVGElement
          const svgSelection = d3.select(svgElement)
          
          // Get current zoom transform to correct coordinates
          const currentTransform = d3.zoomTransform(svgElement)
          
          // Get mouse position in screen coordinates first
          const [screenX, screenY] = d3.pointer(event.sourceEvent, svgElement)
          
          // Apply inverse transform to get canvas coordinates
          const [canvasX, canvasY] = currentTransform.invert([screenX, screenY])
          
          let targetNodeId: string | undefined
          let targetPortId: string | undefined
          
          // Find target input port by checking all input port circles and bottom port diamonds
          const allInputPorts = svgSelection.selectAll('.input-port-circle')
          const allBottomPorts = svgSelection.selectAll('.bottom-port-diamond')
          let minDistance = Infinity
          
          // Check input ports
          allInputPorts.each(function(portData: any) {
            const circle = d3.select(this)
            const element = this as SVGElement
            
            // Get port position in SVG coordinates
            const portGroup = d3.select(element.parentNode as SVGElement)
            const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGElement)
            
            if (nodeGroup.empty()) return
            
            const nodeId = nodeGroup.attr('data-node-id')
            const transform = nodeGroup.attr('transform')
            let nodeSvgX = 0, nodeSvgY = 0
            
            if (transform) {
              const match = /translate\(([^,]+),([^)]+)\)/.exec(transform)
              if (match) {
                nodeSvgX = parseFloat(match[1])
                nodeSvgY = parseFloat(match[2])
              }
            }
            
            const cx = parseFloat(circle.attr('cx') || '0')
            const cy = parseFloat(circle.attr('cy') || '0')
            const r = parseFloat(circle.attr('r') || '8')
            
            // Port position in SVG coordinates (this is already in canvas space)
            const portCanvasX = nodeSvgX + cx
            const portCanvasY = nodeSvgY + cy
            
            // Calculate distance directly in canvas coordinates
            const distance = Math.sqrt((canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2)
            const tolerance = r + 15 // Increased tolerance for easier dropping
            
            // Use closest valid input port with tolerance
            if (distance <= tolerance && distance < minDistance) {
              minDistance = distance
              targetNodeId = nodeId
              targetPortId = portData.id
            }
          })
          
          // Also check bottom ports (diamond shapes)
          allBottomPorts.each(function(portData: any) {
            const diamond = d3.select(this)
            const element = this as SVGElement
            
            // Get port position in SVG coordinates
            const portGroup = d3.select(element.parentNode as SVGElement)
            const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGElement)
            
            if (nodeGroup.empty()) return
            
            const nodeId = nodeGroup.attr('data-node-id')
            const nodeTransform = nodeGroup.attr('transform')
            let nodeSvgX = 0, nodeSvgY = 0
            
            if (nodeTransform) {
              const match = /translate\(([^,]+),([^)]+)\)/.exec(nodeTransform)
              if (match) {
                nodeSvgX = parseFloat(match[1])
                nodeSvgY = parseFloat(match[2])
              }
            }
            
            // Get diamond position from its transform
            const diamondTransform = diamond.attr('transform')
            let diamondX = 0, diamondY = 0
            
            if (diamondTransform) {
              const match = /translate\(([^,]+),([^)]+)\)/.exec(diamondTransform)
              if (match) {
                diamondX = parseFloat(match[1])
                diamondY = parseFloat(match[2])
              }
            }
            
            // Port position in SVG coordinates (this is already in canvas space)
            const portCanvasX = nodeSvgX + diamondX
            const portCanvasY = nodeSvgY + diamondY
            
            // Calculate distance directly in canvas coordinates
            const distance = Math.sqrt((canvasX - portCanvasX) ** 2 + (canvasY - portCanvasY) ** 2)
            const tolerance = 15 // Tolerance for diamond shape
            
            // Use closest valid bottom port with tolerance
            if (distance <= tolerance && distance < minDistance) {
              minDistance = distance
              targetNodeId = nodeId
              targetPortId = portData.id
            }
          })

          console.log('🏁 Bottom port diamond drag final target:', { targetNodeId, targetPortId, minDistance })
          onPortDragEnd(targetNodeId, targetPortId)
        })
      )

    // Create bottom port diamonds
    bottomPortGroups.selectAll('path').remove()
    bottomPortGroups.append('path')
      .attr('class', 'bottom-port-diamond')
      .attr('d', (d: any) => {
        const size = getConfigurableDimensions(d.nodeData).portRadius || 6
        // Create diamond shape: move to top, line to right, line to bottom, line to left, close
        return `M 0,${-size} L ${size},0 L 0,${size} L ${-size},0 Z`
      })
      .attr('transform', (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex((p: any) => p.id === d.id)
        const position = calculateBottomPortLayout(d.nodeData, portIndex)
        return `translate(${position.x}, ${position.y})`
      })
      .attr('fill', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'output') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'input')
          return canDrop ? '#4CAF50' : '#ff5722'
        }
        return '#A8A9B4' // Beautiful pastel gray tone
      })
      .attr('stroke', 'none') // No border

    // Add connector lines from bottom ports (only for ports without connections OR when node is selected)
    bottomPortGroups.selectAll('line').remove()
    bottomPortGroups.append('line')
      .attr('class', 'bottom-port-connector')
      .attr('x1', (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex((p: any) => p.id === d.id)
        const position = calculateBottomPortLayout(d.nodeData, portIndex)
        return position.x
      })
      .attr('y1', (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex((p: any) => p.id === d.id)
        const position = calculateBottomPortLayout(d.nodeData, portIndex)
        return position.y
      })
      .attr('x2', (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex((p: any) => p.id === d.id)
        const position = calculateBottomPortLayout(d.nodeData, portIndex)
        return position.x
      })
      .attr('y2', (d: any) => {
        // Find the correct index of this port in the bottomPorts array
        const portIndex = d.nodeData.bottomPorts.findIndex((p: any) => p.id === d.id)
        const position = calculateBottomPortLayout(d.nodeData, portIndex)
        // Check if this bottom port has a connection
        const hasConnection = connections.some(conn => 
          conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        )
        const nodeIsSelected = isNodeSelected(d.nodeId)
        
        // Show line if: 
        // 1. No connection (always show for unconnected ports), OR
        // 2. Node is selected AND port can accept additional connections
        let shouldShowLine = false
        
        if (!hasConnection) {
          shouldShowLine = true // Always show for unconnected ports
        } else if (nodeIsSelected) {
          // Only show for connected ports if they can accept more connections
          shouldShowLine = canBottomPortAcceptConnection(d.nodeId, d.id, connections, workflowContextState.designerMode)
        }
        
        // Return position.y + line length (or just position.y if no line)
        return shouldShowLine ? position.y + 28 : position.y
      })
      .attr('stroke', (d: any) => {
        // Different colors for selected nodes based on connection capability
        const nodeIsSelected = isNodeSelected(d.nodeId)
        const hasConnection = connections.some(conn => 
          conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        )
        
        if (nodeIsSelected && hasConnection) {
          const canAcceptMore = canBottomPortAcceptConnection(d.nodeId, d.id, connections, workflowContextState.designerMode)
          if (canAcceptMore) {
            return '#4CAF50' // Green for ports that can accept more connections (like 'tool')
          }
        }
        return '#A8A9B4' // Default pastel gray
      })
      .attr('stroke-width', (d: any) => {
        const nodeIsSelected = isNodeSelected(d.nodeId)
        const hasConnection = connections.some(conn => 
          conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        )
        
        if (nodeIsSelected && hasConnection) {
          return 3 // Thicker line for selected nodes with connections
        }
        return 2 // Default thickness
      })
      .style('pointer-events', 'none')

    // Add plus buttons and labels to bottom port groups (integrated approach)
    bottomPortGroups.each(function(d: any) {
      const group = d3.select(this)
      
      // Check if this bottom port already has a connection
      const hasConnection = connections.some(conn => 
        conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
      )
      
      const nodeIsSelected = isNodeSelected(d.nodeId)
      
      // Determine if plus button should be shown
      let shouldShowButton = false
      
      if (nodeIsSelected) {
        // When node is selected, show plus button only for ports that can accept additional connections
        shouldShowButton = canBottomPortAcceptConnection(d.nodeId, d.id, connections, workflowContextState.designerMode)
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔍 Port ${d.id} on selected node ${d.nodeId}: canAccept=${shouldShowButton}, hasConnection=${hasConnection}`)
        }
      } else {
        // When node is not selected, show only for unconnected ports (original behavior)
        shouldShowButton = !hasConnection
      }
      
      // Remove existing plus button and label
      group.selectAll('.plus-button-container').remove()
      group.selectAll('.bottom-port-label-container').remove()
      
      // Add plus button if needed
      if (shouldShowButton) {
        const node = nodes.find(n => n.id === d.nodeId)
        if (node) {
          const portIndex = d.nodeData.bottomPorts.findIndex((p: any) => p.id === d.id)
          const position = calculateBottomPortLayout(d.nodeData, portIndex)
          const x = position.x
          const y = position.y + 36 // Beyond the connector line
          
          const plusButtonContainer = group.append('g')
            .attr('class', 'plus-button-container')
            .attr('transform', `translate(${x}, ${y})`)
            .style('cursor', 'crosshair')
            .style('pointer-events', 'all')

          const plusButton = plusButtonContainer.append('g')
            .attr('class', 'plus-button')
            .style('cursor', 'crosshair')
            .style('pointer-events', 'all')
            .call(d3.drag<any, any>()
              .on('start', (event: any) => {
                console.log('🚀 Plus button drag START:', d.nodeId, d.id)
                event.sourceEvent.stopPropagation()
                event.sourceEvent.preventDefault()
                
                // Start connection from bottom port
                onPortDragStart(d.nodeId, d.id, 'output')
              })
              .on('drag', (event: any) => {
                // Get canvas coordinates
                const [x, y] = d3.pointer(event.sourceEvent, event.sourceEvent.target.ownerSVGElement)
                const transform = d3.zoomTransform(event.sourceEvent.target.ownerSVGElement)
                const [canvasX, canvasY] = transform.invert([x, y])
                
                // Update connection preview
                onPortDrag(canvasX, canvasY)
              })
              .on('end', (event: any) => {
                console.log('🚀 Plus button drag END')
                
                // Get canvas coordinates where drag ended
                const [x, y] = d3.pointer(event.sourceEvent, event.sourceEvent.target.ownerSVGElement)
                const transform = d3.zoomTransform(event.sourceEvent.target.ownerSVGElement)
                const [canvasX, canvasY] = transform.invert([x, y])
                
                console.log('🔍 Drag ended at canvas coordinates:', canvasX, canvasY)
                
                // Find target port using the existing WorkflowCanvas port detection
                let targetNodeId: string | undefined
                let targetPortId: string | undefined
                let minDistance = 50 // 50px tolerance
                
                // Check all nodes for input ports within range
                nodes.forEach(node => {
                  if (node.id === d.nodeId) return // Don't connect to same node
                  
                  // Check input ports
                  node.inputs.forEach(input => {
                    const inputPortPosition = calculatePortPosition(node, input.id, 'input', nodeVariant)
                    const distance = Math.sqrt(
                      Math.pow(canvasX - inputPortPosition.x, 2) + 
                      Math.pow(canvasY - inputPortPosition.y, 2)
                    )
                    
                    if (distance < minDistance) {
                      minDistance = distance
                      targetNodeId = node.id
                      targetPortId = input.id
                    }
                  })
                  
                  // Check bottom ports (input capability)
                  if (node.bottomPorts) {
                    node.bottomPorts.forEach(bottomPort => {
                      const bottomPortPosition = calculatePortPosition(node, bottomPort.id, 'bottom', nodeVariant)
                      const distance = Math.sqrt(
                        Math.pow(canvasX - bottomPortPosition.x, 2) + 
                        Math.pow(canvasY - bottomPortPosition.y, 2)
                      )
                      
                      if (distance < minDistance) {
                        minDistance = distance
                        targetNodeId = node.id
                        targetPortId = bottomPort.id
                      }
                    })
                  }
                })
                
                console.log('🔍 Found target:', { targetNodeId, targetPortId, distance: minDistance })
                
                // End the drag with target information
                onPortDragEnd(targetNodeId, targetPortId)
              })
            )
            .on('click', (event: any) => {
              // Fallback click handler for simple plus button clicks
              event.stopPropagation()
              onPlusButtonClick?.(d.nodeId, d.id)
            })
            // Removed mouseenter/mouseleave hover effects to prevent highlights during node interactions

          // Plus button background (square with rounded corners)
          plusButton.append('rect')
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
                return '#4CAF50' // Green for ports that can accept multiple connections
              }
              return '#8A8B96' // Gray for unconnected ports
            })
            .attr('stroke', () => {
              // Add border for connected ports to make them more visible
              if (hasConnection && nodeIsSelected) {
                return '#388E3C' // Darker green border for multi-connection ports
              }
              return 'none'
            })
            .attr('stroke-width', () => {
              if (hasConnection && nodeIsSelected) {
                return 1
              }
              return 0
            })

          // Plus symbol (horizontal line)
          plusButton.append('line')
            .attr('class', 'plus-horizontal')
            .attr('x1', -4)
            .attr('y1', 0)
            .attr('x2', 4)
            .attr('y2', 0)
            .attr('stroke', 'white')
            .attr('stroke-width', 1.5)
            .attr('stroke-linecap', 'round')

          // Plus symbol (vertical line)
          plusButton.append('line')
            .attr('class', 'plus-vertical')
            .attr('x1', 0)
            .attr('y1', -4)
            .attr('x2', 0)
            .attr('y2', 4)
            .attr('stroke', 'white')
            .attr('stroke-width', 1.5)
            .attr('stroke-linecap', 'round')
        }
      }

      // Add label for this bottom port
      const portIndex = d.nodeData.bottomPorts.findIndex((p: any) => p.id === d.id)
      const position = calculateBottomPortLayout(d.nodeData, portIndex)
      const labelX = position.x
      const labelY = position.y + 15 // Below the diamond
      
      const labelContainer = group.append('g')
        .attr('class', 'bottom-port-label-container')
        .attr('transform', `translate(${labelX}, ${labelY})`)

      // Label background
      const labelText = d.label || d.id
      const textWidth = labelText.length * 5.5 // Better estimation for 10px font
      const padding = 8
      
      labelContainer.append('rect')
        .attr('class', 'bottom-port-label-bg')
        .attr('x', -textWidth/2 - padding/2)
        .attr('y', -7)
        .attr('width', textWidth + padding)
        .attr('height', 12)
        .attr('fill', '#ffffff5b')
        .attr('stroke', 'none') // Prevent stroke inheritance from parent node

      // Label text
      labelContainer.append('text')
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
        .text(labelText)
    })

    // Canvas event handlers
    svg.on('click', () => {
      onCanvasClick()
    })

    svg.on('mousemove', (event) => {
      const [x, y] = d3.pointer(event, svg.node())
      const transform = d3.zoomTransform(svg.node() as any)
      const [canvasX, canvasY] = transform.invert([x, y])
      onCanvasMouseMove(canvasX, canvasY)
    })

    // Enhanced cleanup function with dragging state management
    return () => {
      // Cancel any pending animations
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      
      // Clear any pending dragging state cleanup
      if (dragStateCleanupRef.current) {
        clearTimeout(dragStateCleanupRef.current)
        dragStateCleanupRef.current = null
      }
      
      // Force remove all dragging classes before cleanup
      svg.selectAll('.node.dragging').classed('dragging', false)
      
      // Only reset dragging state if component is actually unmounting
      // Check if we're in middle of a drag operation - if so, preserve state
      const currentlyDragging = isContextDragging()
      if (!currentlyDragging) {
        // Reset all dragging state references only when not actively dragging
        endDragging()
      }
      
      draggedElementRef.current = null
      draggedNodeElementRef.current = null
      
      // Save refs for cleanup
      const connectionPathCache = connectionPathCacheRef.current
      const allNodeElements = allNodeElementsRef.current
      
      // Clear DOM and caches
      svg.selectAll('*').remove()
      connectionPathCache.clear()
      gridCacheRef.current = null
      allNodeElements.clear()
    }

  }, [nodes, connections, showGrid, nodeVariant, selectedNodes])
  
  // Remove duplicate CSS since hover styles are already in globals.css
  
  // Visual state effect - handle selection and connection states with z-index management
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return
    
    const svg = d3.select(svgRef.current)
    const mainNodeLayer = svg.select('.node-layer')
    const connectionLayer = svg.select('.connection-layer')
    
    // Update node visual states only
    mainNodeLayer.selectAll('.node').each(function(d: any) {
      const nodeElement = d3.select(this)
      const isSelected = isNodeSelected(d.id)
      const isDragging = nodeElement.classed('dragging')
      const nodeBackground = nodeElement.select('.node-background')
      
      nodeElement.classed('selected', isSelected)
      
      if (!isDragging) {
        if (isSelected) {
          nodeElement.style('filter', 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))')
          nodeBackground.attr('stroke', '#2196F3').attr('stroke-width', 3)
        } else {
          nodeElement.style('filter', 'none')
          nodeBackground.attr('stroke', getNodeColor(d.type, d.status)).attr('stroke-width', 2)
        }
      }
    })
    
    // Ensure proper z-index after visual state changes (but only if not dragging)
    if (!isDragging) {
      organizeNodeZIndex(true) // Use immediate execution to ensure proper layering
    }
    
    // Update connection selection state only - don't touch hover state
    connectionLayer.selectAll('.connection')
      .each(function(d: any) {
        const connectionGroup = d3.select(this as SVGGElement)
        const pathElement = connectionGroup.select('.connection-path')
        const isSelected = selectedConnection?.id === d.id
        const isCurrentlyHovered = connectionGroup.classed('connection-hover')
        
        // Update selection class
        connectionGroup.classed('connection-selected', isSelected)

        // Apply production selection effects if available
        if (enhancedConnectionsEnabled && productionManagerRef.current) {
          try {
            applyProductionEffects(
              connectionGroup,
              pathElement.node() as SVGPathElement,
              isSelected ? 'selected' : 'default'
            )
          } catch (error) {
            console.warn('⚠️ Failed to apply enhanced selection effects:', error)
          }
        }
        
        // Only update visual attributes if not currently hovered
        if (!isCurrentlyHovered) {
          if (isSelected) {
            pathElement
              .attr('stroke', '#2196F3')
              .attr('stroke-width', 3)
              .attr('marker-end', getConnectionMarker(d, 'selected'))
          } else {
            pathElement
              .attr('stroke', 'white')
              .attr('stroke-width', 2)
              .attr('marker-end', getConnectionMarker(d, 'default'))
          }
        }
      })
      
  }, [selectedNodes, selectedConnection, isNodeSelected, getNodeColor, isInitialized, organizeNodeZIndex])
  
  // Connection state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return
    
    const svg = d3.select(svgRef.current)
    const g = svg.select('g')
    
    // Handle connection preview
    g.selectAll('.connection-preview').remove()
    
    if (isConnecting && connectionStart) {
      console.log('🔄 Connection effect - preview update:', { isConnecting, connectionStart, connectionPreview })
      const sourceNode = nodeMap.get(connectionStart.nodeId)
      if (sourceNode && connectionPreview) {
        console.log('🔄 Rendering preview in effect from:', sourceNode.id, 'to:', connectionPreview)
        const previewPath = calculateConnectionPreviewPath(
          sourceNode,
          connectionStart.portId,
          connectionPreview,
          nodeVariant
        )
        
        // Determine preview marker based on source port type and direction
        const isSourceBottomPort = sourceNode.bottomPorts?.some(p => p.id === connectionStart.portId)
        const isLeftToRight = connectionPreview.x > sourceNode.x
        let previewMarker = 'url(#arrowhead)'
        
        if (isSourceBottomPort && !isLeftToRight) {
          previewMarker = 'url(#arrowhead-left)'
        }
        
        g.append('path')
          .attr('class', 'connection-preview')
          .attr('d', previewPath)
          .attr('stroke', '#2196F3')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5')
          .attr('fill', 'none')
          .attr('marker-end', previewMarker)
          .attr('pointer-events', 'none')
          .style('opacity', 0.7)
      } else {
        console.log('🔄 Effect not rendering preview:', { sourceNode: !!sourceNode, connectionPreview: !!connectionPreview })
      }
    }
    
    // Update port visual states during connection
    const nodeLayer = svg.select('.node-layer')
    
    // Update input ports visual state with change detection
    nodeLayer.selectAll('.input-port-circle')
      .each(function(d: any) {
        const portElement = d3.select(this)
        const isConnectionActive = isConnecting && connectionStart && connectionStart.type === 'output'
        const canDrop = isConnectionActive ? canDropOnPort(d.nodeId, d.id, 'input') : false
        
        // Calculate target values using inline logic (performance optimized)
        const safeCanDrop = Boolean(canDrop)
        const baseDimensions = getConfigurableDimensions(d.nodeData)
        
        // Extract nested ternary operations for better readability
        let targetFill: string
        let targetStroke: string
        let targetStrokeWidth: number
        let targetRadius: number
        
        if (isConnectionActive) {
          targetFill = safeCanDrop ? '#4CAF50' : '#ccc'
          targetStroke = safeCanDrop ? '#4CAF50' : '#ff5722'
          targetStrokeWidth = safeCanDrop ? 3 : 2
          targetRadius = safeCanDrop ? baseDimensions.portRadius * 1.5 : baseDimensions.portRadius
        } else {
          targetFill = getPortColor('any')
          targetStroke = '#333'
          targetStrokeWidth = 2
          targetRadius = baseDimensions.portRadius
        }
        
        // Only update if values changed to prevent flickering
        const currentFill = portElement.attr('fill')
        const currentStroke = portElement.attr('stroke')
        const currentStrokeWidth = parseInt(portElement.attr('stroke-width') || '2')
        const currentRadius = parseFloat(portElement.attr('r') || '0')
        
        if (currentFill !== targetFill) {
          portElement.attr('fill', targetFill)
        }
        if (currentStroke !== targetStroke) {
          portElement.attr('stroke', targetStroke)
        }
        if (currentStrokeWidth !== targetStrokeWidth) {
          portElement.attr('stroke-width', targetStrokeWidth)
        }
        if (Math.abs(currentRadius - targetRadius) > 0.1) {
          portElement.attr('r', targetRadius)
        }
      })
      
    // Update output ports visual state with change detection
    nodeLayer.selectAll('.output-port-circle')
      .each(function(d: any) {
        const portElement = d3.select(this)
        const isConnectionActive = isConnecting && connectionStart && connectionStart.type === 'input'
        const canDrop = isConnectionActive ? canDropOnPort(d.nodeId, d.id, 'output') : false
        
        // Calculate target values using inline logic (performance optimized)
        const safeCanDrop = Boolean(canDrop)
        const baseDimensions = getConfigurableDimensions(d.nodeData)
        
        const targetFill = isConnectionActive ? (safeCanDrop ? '#4CAF50' : '#ccc') : getPortColor('any')
        const targetStroke = isConnectionActive ? (safeCanDrop ? '#4CAF50' : '#ff5722') : '#333'
        const targetStrokeWidth = isConnectionActive ? (safeCanDrop ? 3 : 2) : 2
        const targetRadius = isConnectionActive ? (safeCanDrop ? baseDimensions.portRadius * 1.5 : baseDimensions.portRadius) : baseDimensions.portRadius
        
        // Only update if values changed to prevent flickering
        const currentFill = portElement.attr('fill')
        const currentStroke = portElement.attr('stroke')
        const currentStrokeWidth = parseInt(portElement.attr('stroke-width') || '2')
        const currentRadius = parseFloat(portElement.attr('r') || '0')
        
        if (currentFill !== targetFill) {
          portElement.attr('fill', targetFill)
        }
        if (currentStroke !== targetStroke) {
          portElement.attr('stroke', targetStroke)
        }
        if (currentStrokeWidth !== targetStrokeWidth) {
          portElement.attr('stroke-width', targetStrokeWidth)
        }
        if (Math.abs(currentRadius - targetRadius) > 0.1) {
          portElement.attr('r', targetRadius)
        }
      })
      
    // Update output ports visual state with change detection
    nodeLayer.selectAll('.output-port-circle')
      .each(function(d: any) {
        const portElement = d3.select(this)
        const isConnectionActive = isConnecting && connectionStart && connectionStart.type === 'input'
        const canDrop = isConnectionActive ? canDropOnPort(d.nodeId, d.id, 'output') : false
        
        // Calculate target values using inline logic (performance optimized)
        const safeCanDrop = Boolean(canDrop)
        const baseDimensions = getConfigurableDimensions(d.nodeData)
        
        const targetFill = isConnectionActive ? (safeCanDrop ? '#4CAF50' : '#ccc') : getPortColor('any')
        const targetStroke = isConnectionActive ? (safeCanDrop ? '#4CAF50' : '#ff5722') : '#333'
        const targetStrokeWidth = isConnectionActive ? (safeCanDrop ? 3 : 2) : 2
        const targetRadius = isConnectionActive ? (safeCanDrop ? baseDimensions.portRadius * 1.5 : baseDimensions.portRadius) : baseDimensions.portRadius
        
        // Only update if values changed to prevent flickering
        const currentFill = portElement.attr('fill')
        const currentStroke = portElement.attr('stroke')
        const currentStrokeWidth = parseInt(portElement.attr('stroke-width') || '2')
        const currentRadius = parseFloat(portElement.attr('r') || '0')
        
        if (currentFill !== targetFill) {
          portElement.attr('fill', targetFill)
        }
        if (currentStroke !== targetStroke) {
          portElement.attr('stroke', targetStroke)
        }
        if (currentStrokeWidth !== targetStrokeWidth) {
          portElement.attr('stroke-width', targetStrokeWidth)
        }
        if (Math.abs(currentRadius - targetRadius) > 0.1) {
          portElement.attr('r', targetRadius)
        }
      })
      
  }, [isConnecting, connectionStart, connectionPreview, nodeVariant, nodeMap, isInitialized, canDropOnPort, svgRef, getConfigurableDimensions])
  
  // Canvas state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return
    
    const svg = d3.select(svgRef.current)
    const gridLayer = svg.select('.grid-layer')
    
    // Update grid and toolbar
    const rect = svgRef.current.getBoundingClientRect()
    createGrid(gridLayer as any, canvasTransform, rect.width, rect.height)
    
  }, [canvasTransform, createGrid, isInitialized, svgRef])
  
  // Cleanup effect
  useEffect(() => {
    const connectionCache = connectionPathCacheRef.current
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      connectionCache.clear()
      gridCacheRef.current = null
    }
  }, [])

  return null // This component only manages D3 rendering
})

export default WorkflowCanvas