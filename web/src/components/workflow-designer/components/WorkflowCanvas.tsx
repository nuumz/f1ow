import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import * as d3 from 'd3'
import type { WorkflowNode, Connection, NodeVariant } from '../types'
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
import { generateVariantAwareConnectionPath, calculateConnectionPreviewPath } from '../utils/connection-utils'

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
  // canDropOnNode: (targetNodeId: string) => boolean // Commented out - reserved for future use
  
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
  onPlusButtonClick,
  onTransformChange,
  onZoomLevelChange,
  onRegisterZoomBehavior,
}: WorkflowCanvasProps) {
  // Remove hover state from React - manage it directly in D3
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Performance state
  const [isInitialized, setIsInitialized] = useState(false)
  const rafIdRef = useRef<number | null>(null)
  const rafScheduledRef = useRef<boolean>(false)
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])
  
  // Track current transform with ref for immediate access
  const currentTransformRef = useRef(canvasTransform)
  
  /**
   * Helper function to determine connection direction and appropriate arrow marker
   */
  const getConnectionMarker = useCallback((connection: Connection, state: 'default' | 'selected' | 'hover' = 'default') => {
    const sourceNode = nodes.find(n => n.id === connection.sourceNodeId)
    const targetNode = nodes.find(n => n.id === connection.targetNodeId)
    
    if (!sourceNode || !targetNode) return 'url(#arrowhead)'
    
    // Check if source is a bottom port
    const isSourceBottomPort = sourceNode.bottomPorts?.some(p => p.id === connection.sourcePortId)
    
    if (isSourceBottomPort) {
      // Bottom ports typically connect horizontally to target nodes from the left
      // Check if target is to the right of source (normal left-to-right flow)
      const isLeftToRight = targetNode.x > sourceNode.x
      
      if (isLeftToRight) {
        // Standard right-pointing arrow
        switch (state) {
          case 'selected': return 'url(#arrowhead-selected)'
          case 'hover': return 'url(#arrowhead-hover)'
          default: return 'url(#arrowhead)'
        }
      } else {
        // Left-pointing arrow for right-to-left connections
        switch (state) {
          case 'selected': return 'url(#arrowhead-left-selected)'
          case 'hover': return 'url(#arrowhead-left-hover)'
          default: return 'url(#arrowhead-left)'
        }
      }
    }
    
    // Regular connections use standard right-pointing arrows
    switch (state) {
      case 'selected': return 'url(#arrowhead-selected)'
      case 'hover': return 'url(#arrowhead-hover)'
      default: return 'url(#arrowhead)'
    }
  }, [nodes])
  useEffect(() => {
    currentTransformRef.current = canvasTransform
  }, [canvasTransform])
  
  
  
  // Drag state
  const draggedElementRef = useRef<d3.Selection<any, any, any, any> | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const draggedNodeIdRef = useRef<string | null>(null)
  const draggedNodeElementRef = useRef<SVGGElement | null>(null)
  const nodeLayerRef = useRef<SVGGElement | null>(null)
  const allNodeElementsRef = useRef<Map<string, SVGGElement>>(new Map())
  
  // Cache refs for performance
  const connectionPathCacheRef = useRef<Map<string, string>>(new Map())
  const gridCacheRef = useRef<{ transform: string; lines: any[] } | null>(null)
  const nodePositionCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  // Optimized grid creation with caching
  const createGrid = useCallback((
    gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    transform: { x: number; y: number; k: number },
    viewportWidth: number,
    viewportHeight: number
  ) => {
    if (!showGrid) {
      gridLayer.selectAll('*').remove()
      gridCacheRef.current = null
      return
    }

    const gridSize = 20 * transform.k
    if (gridSize < 5) {
      gridLayer.selectAll('*').remove()
      gridCacheRef.current = null
      return
    }

    const transformString = `${transform.x},${transform.y},${transform.k}`
    const cached = gridCacheRef.current
    
    // Use cached grid if transform hasn't changed significantly
    if (cached && cached.transform === transformString) {
      return
    }

    const bounds = getVisibleCanvasBounds(transform, viewportWidth, viewportHeight)
    
    const startX = Math.floor(bounds.minX / gridSize) * gridSize
    const endX = Math.ceil(bounds.maxX / gridSize) * gridSize
    const startY = Math.floor(bounds.minY / gridSize) * gridSize
    const endY = Math.ceil(bounds.maxY / gridSize) * gridSize

    const verticalLines = []
    const horizontalLines = []

    for (let x = startX; x <= endX; x += gridSize) {
      verticalLines.push({ x1: x, y1: bounds.minY, x2: x, y2: bounds.maxY })
    }

    for (let y = startY; y <= endY; y += gridSize) {
      horizontalLines.push({ x1: bounds.minX, y1: y, x2: bounds.maxX, y2: y })
    }

    // Clear and redraw only if needed
    gridLayer.selectAll('*').remove()

    gridLayer.selectAll('.grid-line-v')
      .data(verticalLines)
      .enter()
      .append('line')
      .attr('class', 'grid-line-v')
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2)
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 0.5)

    gridLayer.selectAll('.grid-line-h')
      .data(horizontalLines)
      .enter()
      .append('line')
      .attr('class', 'grid-line-h')
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2)
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 0.5)

    // Cache the result
    gridCacheRef.current = {
      transform: transformString,
      lines: [...verticalLines, ...horizontalLines]
    }
  }, [showGrid])

  // Debounced RAF utility
  const scheduleRAF = useCallback((callback: () => void) => {
    if (rafScheduledRef.current) return
    
    rafScheduledRef.current = true
    rafIdRef.current = requestAnimationFrame(() => {
      callback()
      rafScheduledRef.current = false
      rafIdRef.current = null
    })
  }, [])

  // Optimized Z-Index Management - now with immediate execution when needed
  const organizeNodeZIndex = useCallback((immediate = false) => {
    const nodeLayer = nodeLayerRef.current
    if (!nodeLayer || allNodeElementsRef.current.size === 0) return

    const executeZIndexUpdate = () => {
      const normalNodes: SVGGElement[] = []
      const selectedNodes: SVGGElement[] = []
      const draggingNodes: SVGGElement[] = []

      allNodeElementsRef.current.forEach((element, nodeId) => {
        if (!nodeLayer.contains(element)) return
        
        const isDragging = isDraggingRef.current && nodeId === draggedNodeIdRef.current
        const isSelected = isNodeSelected(nodeId)

        if (isDragging) {
          draggingNodes.push(element)
        } else if (isSelected) {
          selectedNodes.push(element)
        } else {
          normalNodes.push(element)
        }
      })

      // Reorder DOM elements: normal → selected → dragging
      const orderedElements = [...normalNodes, ...selectedNodes, ...draggingNodes]
      
      orderedElements.forEach(element => {
        if (nodeLayer.contains(element) && nodeLayer.lastChild !== element) {
          nodeLayer.appendChild(element)
        }
      })
    }

    if (immediate) {
      executeZIndexUpdate()
    } else {
      scheduleRAF(executeZIndexUpdate)
    }
  }, [isNodeSelected, scheduleRAF])

  // Immediate node dragging z-index management
  const setNodeAsDragging = useCallback((nodeId: string) => {
    const element = allNodeElementsRef.current.get(nodeId)
    const nodeLayer = nodeLayerRef.current
    
    if (element && nodeLayer) {
      // Immediately move to top for dragging to ensure proper layering
      if (nodeLayer.lastChild !== element) {
        nodeLayer.appendChild(element)
      }
      // Also trigger full z-index organization to ensure proper order
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


  /**
   * Function to check if a bottom port can accept additional connections
   * Based on business rules for different port types:
   * - ai-model: Single connection only (no plus button when connected)
   * - memory: Single connection only (no plus button when connected)
   * - tool: Multiple connections allowed (always show plus button)
   * - Other array types: Multiple connections allowed
   * - Other single types: Single connection only
   */
  const canBottomPortAcceptConnection = useCallback((nodeId: string, portId: string, connections: Connection[]) => {
    // Get the node to check its bottom ports configuration
    const node = nodeMap.get(nodeId)
    if (!node || !node.bottomPorts) return false
    
    const port = node.bottomPorts.find(p => p.id === portId)
    if (!port) return false
    
    // Count existing connections for this port
    const existingConnections = connections.filter(conn => 
      conn.sourceNodeId === nodeId && conn.sourcePortId === portId
    )
    
    // Define connection rules based on port type/ID
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


  // Memoized connection path calculation
  const getConnectionPath = useCallback((connection: Connection) => {
    const cacheKey = `${connection.sourceNodeId}-${connection.sourcePortId}-${connection.targetNodeId}-${connection.targetPortId}-${nodeVariant}`
    
    const cached = connectionPathCacheRef.current.get(cacheKey)
    if (cached) return cached
    
    const sourceNode = nodeMap.get(connection.sourceNodeId)
    const targetNode = nodeMap.get(connection.targetNodeId)
    if (!sourceNode || !targetNode) return ''
    
    const path = generateVariantAwareConnectionPath(
      sourceNode, 
      connection.sourcePortId, 
      targetNode, 
      connection.targetPortId,
      nodeVariant
    )
    
    connectionPathCacheRef.current.set(cacheKey, path)
    return path
  }, [nodeMap, nodeVariant])

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

  // Component-level optimized handlers
  const applyDragVisualStyle = useCallback((nodeElement: any, nodeId: string) => {
    scheduleRAF(() => {
      nodeElement
        .style('opacity', 0.9)
        .style('filter', 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))')
      
      const nodeBackground = nodeElement.select('.node-background')
      const isSelected = isNodeSelected(nodeId)
      if (isSelected) {
        nodeBackground.attr('stroke', '#2196F3').attr('stroke-width', 3)
      } else {
        const node = nodeMap.get(nodeId)
        if (node) {
          nodeBackground.attr('stroke', getNodeColor(node.type, node.status)).attr('stroke-width', 3)
        }
      }
    })
  }, [scheduleRAF, isNodeSelected, nodeMap, getNodeColor])

  const updateDraggedNodePosition = useCallback((nodeId: string, newX: number, newY: number) => {
    scheduleRAF(() => {
      // Update visual position
      if (draggedElementRef.current) {
        draggedElementRef.current.attr('transform', `translate(${newX}, ${newY})`)
      }

      // Clear connection cache for affected connections
      connections.forEach(conn => {
        if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
          const cacheKey = `${conn.sourceNodeId}-${conn.sourcePortId}-${conn.targetNodeId}-${conn.targetPortId}-${nodeVariant}`
          connectionPathCacheRef.current.delete(cacheKey)
        }
      })

      // Update connections in real-time (only affected ones)
      const svg = d3.select(svgRef.current!)
      const connectionLayer = svg.select('.connection-layer')
      connectionLayer.selectAll('.connection')
        .filter((conn: any) => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId)
        .each(function(conn: any) {
          const connectionGroup = d3.select(this)
          const newPath = getConnectionPath(conn)
          connectionGroup.select('.connection-path').attr('d', newPath)
        })
    })
  }, [scheduleRAF, connections, nodeVariant, getConnectionPath])

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
  }, [isNodeSelected, nodeMap, getNodeColor])

  // Clear caches when nodes change
  useEffect(() => {
    connectionPathCacheRef.current.clear()
    nodePositionCacheRef.current.clear()
  }, [nodes])

  // Immediate z-index organization for selection changes
  useEffect(() => {
    if (!isDraggingRef.current && isInitialized) {
      // Use immediate update for selection changes to ensure proper layering
      const nodeLayer = nodeLayerRef.current
      if (!nodeLayer || allNodeElementsRef.current.size === 0) return

      const normalNodes: SVGGElement[] = []
      const selectedNodes: SVGGElement[] = []
      const draggingNodes: SVGGElement[] = []

      allNodeElementsRef.current.forEach((element, nodeId) => {
        if (!nodeLayer.contains(element)) return
        
        const isDragging = isDraggingRef.current && nodeId === draggedNodeIdRef.current
        const isSelected = isNodeSelected(nodeId)

        if (isDragging) {
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
  }, [selectedNodes, isNodeSelected, isInitialized])

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
      .attr('fill', '#fcfcfc')  
      .attr('class', 'svg-canvas-background')

    // Arrow markers with direction-aware positioning
    const createArrowMarker = (id: string, color: string, size = 14, direction: 'right' | 'left' = 'right') => {
      const marker = defs.append('marker')
        .attr('id', id)
        .attr('markerWidth', size)
        .attr('markerHeight', size)
        .attr('orient', 'auto')
        .attr('markerUnits', 'userSpaceOnUse')
      
      if (direction === 'right') {
        // Right-pointing arrow (default)
        marker
          .attr('refX', size - 1)
          .attr('refY', size / 2)
          .append('polygon')
          .attr('points', `0,0 ${size - 1},${size / 2} 0,${size}`)
          .attr('fill', color)
          .attr('stroke', 'none')
      } else {
        // Left-pointing arrow for connections entering from left
        marker
          .attr('refX', 1)
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

    // Layer hierarchy
    const g = svg.append('g')
    const gridLayer = g.append('g').attr('class', 'grid-layer').style('pointer-events', 'none')
    const connectionLayer = g.append('g').attr('class', 'connection-layer')
    const mainNodeLayer = g.append('g').attr('class', 'node-layer')
    const labelLayer = g.append('g').attr('class', 'label-layer')
    
    // Store node layer reference
    nodeLayerRef.current = mainNodeLayer.node() as SVGGElement
    

    // Create initial grid
    const rect = svgRef.current.getBoundingClientRect()
    createGrid(gridLayer, canvasTransform, rect.width, rect.height)

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
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
      
      // Set persistent drag state
      nodeElement.classed('dragging', true)
      draggedElementRef.current = nodeElement
      isDraggingRef.current = true
      draggedNodeIdRef.current = d.id
      draggedNodeElementRef.current = domNode
      
      // Apply dragging visual style and ensure proper z-index
      applyDragVisualStyle(nodeElement, d.id)
      // Set z-index immediately to ensure dragged node is on top
      setNodeAsDragging(d.id)
      
      const svgElement = svgRef.current!
      const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgElement)
      const transform = d3.zoomTransform(svgElement)
      const [canvasX, canvasY] = transform.invert([mouseX, mouseY])
      
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

      // Mark as dragged if movement is significant - increase threshold for better click detection
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        dragData.hasDragged = true
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

      // Clear persistent drag state
      nodeElement.classed('dragging', false)
      draggedElementRef.current = null
      isDraggingRef.current = false
      draggedNodeIdRef.current = null
      draggedNodeElementRef.current = null

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

    // Add visible connection path with direct interaction 
    connectionEnter.append('path')
      .attr('class', 'connection-path')
      .attr('fill', 'none')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        onConnectionClick(d)
      })
      .on('mouseenter', function(this: any, _event: any, d: Connection) {
        const connectionElement = d3.select(this)
        const connectionGroup = d3.select(this.parentNode)
        const isSelected = selectedConnection?.id === d.id
        
        // Clear any pending timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
        }
        
        // Apply hover immediately for non-selected connections
        if (!isSelected) {
          connectionGroup.classed('connection-hover', true)
          // Force immediate visual update
          connectionElement
            .interrupt() // Stop any ongoing transitions
            .attr('stroke', '#1976D2')
            .attr('stroke-width', 3)
            .attr('marker-end', getConnectionMarker(d, 'hover'))
        }
      })
      .on('mouseleave', function(this: any, _event: any, d: Connection) {
        const connectionElement = d3.select(this)
        const connectionGroup = d3.select(this.parentNode)
        const isSelected = selectedConnection?.id === d.id
        
        // Remove hover class
        connectionGroup.classed('connection-hover', false)
        
        // Delay the visual reset to prevent flickering
        hoverTimeoutRef.current = setTimeout(() => {
          if (!isSelected && !connectionGroup.classed('connection-hover')) {
            connectionElement
              .interrupt() // Stop any ongoing transitions
              .attr('stroke', 'white')
              .attr('stroke-width', 2)
              .attr('marker-end', getConnectionMarker(d, 'default'))
          }
        }, 50) // Small delay to prevent flicker on quick mouse movements
      })
    
    const connectionUpdate = connectionEnter.merge(connectionPaths as any)
    
    // Update visible path
    connectionUpdate.select('.connection-path')
      .attr('d', (d: any) => getConnectionPath(d))
      .attr('stroke', 'white') // Default stroke - CSS will override for selection/hover
      .attr('stroke-width', 2) // Default width - CSS will override for selection/hover
      .attr('marker-end', (d: any) => getConnectionMarker(d, 'default')) // Dynamic marker based on direction

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
      })
      .call(d3.drag<any, WorkflowNode>()
        .container(g.node() as any)
        .clickDistance(5) // Increase click distance for better click detection
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded) as any)

    const nodeGroups = nodeEnter.merge(nodeSelection as any)
    
    // Update positions for non-dragging nodes
    nodeGroups
      .filter(function() {
        return !d3.select(this).classed('dragging')
      })
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)


    // Node background (shape-aware)
    nodeEnter.append('path')
      .attr('class', 'node-background')
      .on('click', (event: any, d: any) => {
        // Fallback click handler for node background
        if (!isDraggingRef.current) {
          event.stopPropagation()
          const ctrlKey = event.ctrlKey || event.metaKey
          onNodeClick(d, ctrlKey)
        }
      })
      .on('dblclick', (event: any, d: any) => {
        event.stopPropagation()
        event.preventDefault()
        onNodeDoubleClick(d)
      })
      
    // Update node background attributes (shape-aware)
    nodeGroups.select('.node-background')
      .attr('d', (d: any) => {
        const shape = getNodeShape(d.type)
        const shapePath = getNodeShapePath(d, (shape === 'rectangle' || shape === 'square') ? 8 : 0)
        return shapePath.d
      })
      .attr('fill', '#ffffff')
      .attr('stroke', (d: any) => getNodeColor(d.type, d.status))
      .attr('stroke-width', 2)

    // Apply visual styling to all nodes using centralized system
    nodeGroups.each(function(d: any) {
      const nodeElement = d3.select(this)
      const isSelected = isNodeSelected(d.id)
      const isDragging = nodeElement.classed('dragging')
      const nodeBackground = nodeElement.select('.node-background')
      
      // Apply CSS classes
      nodeElement.classed('selected', isSelected)
      
      // Apply visual styling
      let opacity = 1
      let filter = 'none'
      let strokeColor = getNodeColor(d.type, d.status)
      let strokeWidth = 2
      
      if (isDragging) {
        opacity = 0.9
        filter = 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))'
        if (isSelected) {
          strokeColor = '#2196F3' // Blue for selected+dragging
          strokeWidth = 3
        } else {
          strokeColor = getNodeColor(d.type, d.status) // Original color for just dragging
          strokeWidth = 3
        }
      } else if (isSelected) {
        filter = 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))'
        strokeColor = '#2196F3'
        strokeWidth = 3
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
        if (!isDraggingRef.current) {
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

    // Render simple ports for both variants
    // Input ports
    const inputPortGroups = nodeGroups.selectAll('.input-port-group')
      .data((d: any) => d.inputs.map((input: any) => ({ ...input, nodeId: d.id, nodeData: d })))
      .join('g')
      .attr('class', 'input-port-group')
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

    // Output ports
    const outputPortGroups = nodeGroups.selectAll('.output-port-group')
      .data((d: any) => d.outputs.map((output: any) => ({ ...output, nodeId: d.id, nodeData: d })))
      .join('g')
      .attr('class', 'output-port-group')
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
      .attr('fill', () => getPortColor('any'))
      .attr('stroke', '#333')
      .attr('stroke-width', 2)

    //console.log('🔴 Created', outputPortGroups.selectAll('circle').size(), 'output port circles')

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
      .attr('transform', (d: any, i: number) => {
        const dimensions = getConfigurableDimensions(d.nodeData)
        const nodeWidth = dimensions.width || 200
        const nodeHeight = dimensions.height || 80
        const spacing = nodeWidth / (d.nodeData.bottomPorts.length + 1)
        const x = -nodeWidth/2 + spacing * (i + 1)
        const y = nodeHeight/2 // อยู่กึ่งกลางของเส้นล่าง
        return `translate(${x}, ${y})`
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
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', (d: any) => {
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
          shouldShowLine = canBottomPortAcceptConnection(d.nodeId, d.id, connections)
        }
        
        return shouldShowLine ? 28 : 0
      })
      .attr('transform', (d: any, i: number) => {
        const dimensions = getConfigurableDimensions(d.nodeData)
        const nodeWidth = dimensions.width || 200
        const nodeHeight = dimensions.height || 80
        const spacing = nodeWidth / (d.nodeData.bottomPorts.length + 1)
        const x = -nodeWidth/2 + spacing * (i + 1)
        const y = nodeHeight/2 // อยู่กึ่งกลางของเส้นล่าง
        return `translate(${x}, ${y})`
      })
      .attr('stroke', (d: any) => {
        // Different colors for selected nodes based on connection capability
        const nodeIsSelected = isNodeSelected(d.nodeId)
        const hasConnection = connections.some(conn => 
          conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id
        )
        
        if (nodeIsSelected && hasConnection) {
          const canAcceptMore = canBottomPortAcceptConnection(d.nodeId, d.id, connections)
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

    // Add plus buttons at the end of connector lines (separate from bottomPortGroups to avoid event bubbling)
    const existingPlusButtons = mainNodeLayer.selectAll('.plus-button-container')
    existingPlusButtons.remove()
    
    // Calculate plus button data inline to avoid circular dependencies
    const currentPlusButtonData: any[] = []
    nodeGroups.each(function(nodeData: any) {
      if (nodeData.bottomPorts && nodeData.bottomPorts.length > 0) {
        nodeData.bottomPorts.forEach((port: any, i: number) => {
          // Check if this bottom port already has a connection
          const hasConnection = connections.some(conn => 
            conn.sourceNodeId === nodeData.id && conn.sourcePortId === port.id
          )
          
          const nodeIsSelected = isNodeSelected(nodeData.id)
          
          // New logic: Show plus button based on selection state and connection capability
          let shouldShowButton = false
          
          if (nodeIsSelected) {
            // When node is selected, show plus button only for ports that can accept additional connections
            shouldShowButton = canBottomPortAcceptConnection(nodeData.id, port.id, connections)
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔍 Port ${port.id} on selected node ${nodeData.id}: canAccept=${shouldShowButton}, hasConnection=${hasConnection}`)
            }
          } else {
            // When node is not selected, show only for unconnected ports (original behavior)
            shouldShowButton = !hasConnection
          }
          
          if (shouldShowButton) {
            currentPlusButtonData.push({
              ...port,
              nodeId: nodeData.id,
              nodeData: nodeData,
              index: i,
              hasConnection: hasConnection,
              isNodeSelected: nodeIsSelected,
              canAcceptConnection: canBottomPortAcceptConnection(nodeData.id, port.id, connections)
            })
          }
        })
      }
    })
    
    const plusButtonGroups = mainNodeLayer.selectAll('.plus-button-container')
      .data(currentPlusButtonData, (d: any) => `${d.nodeId}-${d.id}`)
      .enter()
      .append('g')
      .attr('class', 'plus-button-container')
      .attr('transform', (d: any) => {
        const node = nodes.find(n => n.id === d.nodeId)
        if (!node) return 'translate(0,0)'
        
        const dimensions = getConfigurableDimensions(d.nodeData)
        const nodeWidth = dimensions.width || 200
        const nodeHeight = dimensions.height || 80
        const spacing = nodeWidth / (d.nodeData.bottomPorts.length + 1)
        const x = node.x + (-nodeWidth/2 + spacing * (d.index + 1))
        const y = node.y + (nodeHeight/2 + 36) // Beyond the connector line
        return `translate(${x}, ${y})`
      })
      .append('g')
      .attr('class', 'plus-button')
      .style('cursor', 'crosshair') // Change cursor to crosshair like ports
      .style('pointer-events', 'all') // Ensure this element can receive pointer events
      // Add drag behavior for plus button - works like output port drag
      .call(d3.drag<any, any>()
        .on('start', (event: any, d: any) => {
          console.log('🚀 Plus button drag START:', d.nodeId, d.id)
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
          console.log('🚀 Plus button DRAGGING to:', canvasX, canvasY)
          onPortDrag(canvasX, canvasY)
        })
        .on('end', (event: any) => {
          console.log('🚀 Plus button drag END')
          
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

          console.log('🏁 Plus button drag final target:', { targetNodeId, targetPortId, minDistance })
          onPortDragEnd(targetNodeId, targetPortId)
        })
      )
      .on('click', function(event: any, d: any) {
        console.log('🟡 Plus button CLICKED - stopping all events')
        event.stopPropagation() // Prevent node click
        event.stopImmediatePropagation() // Stop all other handlers
        event.preventDefault()
        console.log('🟡 Plus button clicked for port:', d.id, 'on node:', d.nodeId)
        // Only trigger click if not dragging
        onPlusButtonClick?.(d.nodeId, d.id)
        return false // Extra safety to prevent event bubbling
      }, true) // Use capture phase to handle event before others
      .on('mouseenter', function(_event: any, d: any) {
        // Add hover effect
        const bg = d3.select(this).select('.plus-button-bg')
        if (d.hasConnection) {
          bg.attr('fill', '#2E7D32') // Darker green on hover for multi-connection ports
        } else {
          bg.attr('fill', '#3A7BD5') // Blue on hover for unconnected ports
        }
      })
      .on('mouseleave', function(_event: any, d: any) {
        // Remove hover effect - restore original color
        const bg = d3.select(this).select('.plus-button-bg')
        if (d.hasConnection) {
          bg.attr('fill', '#4CAF50') // Green for multi-connection ports
        } else {
          bg.attr('fill', '#8A8B96') // Gray for unconnected ports
        }
      })

    // Plus button background (square with rounded corners)
    plusButtonGroups.append('rect')
      .attr('class', 'plus-button-bg')
      .attr('x', -8)
      .attr('y', -8)
      .attr('width', 16)
      .attr('height', 16)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', (d: any) => {
        // Different colors based on port type and connection capability
        if (d.hasConnection) {
          // For connected ports that still allow more connections (like 'tool')
          return '#4CAF50' // Green for ports that can accept multiple connections
        }
        return '#8A8B96' // Gray for unconnected ports
      })
      .attr('stroke', (d: any) => {
        // Add border for connected ports to make them more visible
        if (d.hasConnection && d.isNodeSelected) {
          return '#388E3C' // Darker green border for multi-connection ports
        }
        return 'none'
      })
      .attr('stroke-width', (d: any) => {
        if (d.hasConnection && d.isNodeSelected) {
          return 1
        }
        return 0
      })

    // Plus symbol (horizontal line)
    plusButtonGroups.append('line')
      .attr('class', 'plus-horizontal')
      .attr('x1', -4)
      .attr('y1', 0)
      .attr('x2', 4)
      .attr('y2', 0)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none')

    // Plus symbol (vertical line)
    plusButtonGroups.append('line')
      .attr('class', 'plus-vertical')
      .attr('x1', 0)
      .attr('y1', -4)
      .attr('x2', 0)
      .attr('y2', 4)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none')

    // Add bottom port labels with background - create as separate layer to avoid node selection highlighting
    const existingLabels = labelLayer.selectAll('.bottom-port-label-container')
    existingLabels.remove()
    
    const labelData: any[] = []
    nodeGroups.each(function(nodeData: any) {
      if (nodeData.bottomPorts && nodeData.bottomPorts.length > 0) {
        nodeData.bottomPorts.forEach((port: any, i: number) => {
          labelData.push({
            ...port,
            nodeId: nodeData.id,
            nodeData: nodeData,
            index: i
          })
        })
      }
    })
    
    const labelContainers = labelLayer.selectAll('.bottom-port-label-container')
      .data(labelData, (d: any) => `${d.nodeId}-${d.id}-label`)
      .join('g')
      .attr('class', 'bottom-port-label-container')
      .attr('transform', (d: any) => {
        const node = nodes.find(n => n.id === d.nodeId)
        if (!node) return 'translate(0,0)'
        
        const dimensions = getConfigurableDimensions(d.nodeData)
        const nodeWidth = dimensions.width || 200
        const nodeHeight = dimensions.height || 80
        const spacing = nodeWidth / (d.nodeData.bottomPorts.length + 1)
        const x = node.x + (-nodeWidth/2 + spacing * (d.index + 1))
        const y = node.y + (nodeHeight/2 + 15) // Position to overlap on connector line
        return `translate(${x}, ${y})`
      })
      .style('pointer-events', 'none')
      .style('user-select', 'none') // Prevent text selection
      .style('-webkit-user-select', 'none') // Safari
      .style('-moz-user-select', 'none') // Firefox
      .style('-ms-user-select', 'none') // IE
      .style('outline', 'none') // Remove focus outline
      .style('-webkit-tap-highlight-color', 'transparent') // Remove mobile tap highlight

    // Add transparent background for text
    labelContainers.append('rect')
      .attr('class', 'label-background')
      .attr('x', (d: any) => {
        const textWidth = d.label.length * 5 // Smaller text width for 8px font
        return -textWidth / 2
      })
      .attr('y', -7)
      .attr('width', (d: any) => {
        const textWidth = d.label.length * 5
        return textWidth
      })
      .attr('height', 10)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', 'white')
      .attr('fill-opacity', 0.4) // 60% transparent
      .style('pointer-events', 'none') // Prevent mouse events on background

    // Add text labels
    labelContainers.append('text')
      .attr('class', 'bottom-port-label')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('fill', '#666')
      .style('pointer-events', 'none') // Prevent mouse events on text
      .style('user-select', 'none') // Prevent text selection
      .text((d: any) => d.label)

    //console.log('🟡 Created', bottomPortGroups.selectAll('path').size(), 'bottom port diamonds')

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

    // Cleanup function
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      svg.selectAll('*').remove()
      connectionPathCacheRef.current.clear()
      gridCacheRef.current = null
      allNodeElementsRef.current.clear()
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
    if (!isDraggingRef.current) {
      organizeNodeZIndex(true) // Use immediate execution to ensure proper layering
    }
    
    // Update connection selection state only - don't touch hover state
    connectionLayer.selectAll('.connection')
      .each(function(d: any) {
        const connectionGroup = d3.select(this)
        const pathElement = connectionGroup.select('.connection-path')
        const isSelected = selectedConnection?.id === d.id
        const isCurrentlyHovered = connectionGroup.classed('connection-hover')
        
        // Update selection class
        connectionGroup.classed('connection-selected', isSelected)
        
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
        
        // Calculate target values
        const targetFill = isConnectionActive ? (canDrop ? '#4CAF50' : '#ccc') : getPortColor('any')
        const targetStroke = isConnectionActive ? (canDrop ? '#4CAF50' : '#ff5722') : '#333'
        const targetStrokeWidth = isConnectionActive ? (canDrop ? 3 : 2) : 2
        const baseDimensions = getConfigurableDimensions(d.nodeData)
        const targetRadius = isConnectionActive ? (canDrop ? baseDimensions.portRadius * 1.5 : baseDimensions.portRadius) : baseDimensions.portRadius
        
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
        
        // Calculate target values
        const targetFill = isConnectionActive ? (canDrop ? '#4CAF50' : '#ccc') : getPortColor('any')
        const targetStroke = isConnectionActive ? (canDrop ? '#4CAF50' : '#ff5722') : '#333'
        const targetStrokeWidth = isConnectionActive ? (canDrop ? 3 : 2) : 2
        const baseDimensions = getConfigurableDimensions(d.nodeData)
        const targetRadius = isConnectionActive ? (canDrop ? baseDimensions.portRadius * 1.5 : baseDimensions.portRadius) : baseDimensions.portRadius
        
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
      
  }, [isConnecting, connectionStart, connectionPreview, nodeVariant, nodeMap, isInitialized, canDropOnPort, getPortColor, getConfigurableDimensions])
  
  // Canvas state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return
    
    const svg = d3.select(svgRef.current)
    const gridLayer = svg.select('.grid-layer')
    
    // Update grid and toolbar
    const rect = svgRef.current.getBoundingClientRect()
    createGrid(gridLayer as any, canvasTransform, rect.width, rect.height)
    
  }, [canvasTransform, createGrid, isInitialized])
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      connectionPathCacheRef.current.clear()
      gridCacheRef.current = null
    }
  }, [])

  return null // This component only manages D3 rendering
})

export default WorkflowCanvas