import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import * as d3 from 'd3'
import type { WorkflowNode } from '../hooks/useNodeSelection'
import type { Connection } from '../hooks/useConnections'
import { getVisibleCanvasBounds } from '../utils/canvas-utils'
import { 
  getNodeColor, 
  getPortColor, 
  getNodeIcon,
  NodeTypes
} from '../utils/node-utils'
import { type NodeVariant, getNodeDimensions } from './nodes/NodeRenderer'
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
  canDropOnNode: (targetNodeId: string) => boolean
  
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
  onTransformChange,
  onZoomLevelChange,
  onRegisterZoomBehavior,
}: WorkflowCanvasProps) {
  // Performance state
  const [isInitialized, setIsInitialized] = useState(false)
  const rafIdRef = useRef<number | null>(null)
  const rafScheduledRef = useRef<boolean>(false)
  
  // Track current transform with ref for immediate access
  const currentTransformRef = useRef(canvasTransform)
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

  // Memoized configurable dimensions calculation
  const getConfigurableDimensions = useMemo(() => {
    const dimensionsCache = new Map<string, any>()
    
    return (node: WorkflowNode) => {
      const cacheKey = `${node.id}-${nodeVariant}`
      const cached = dimensionsCache.get(cacheKey)
      if (cached) return cached
      
      const dimensions = getNodeDimensions(node)
      
      // Adjust dimensions based on variant
      const result = nodeVariant === 'compact' 
        ? {
            ...dimensions,
            width: dimensions.width * 0.8,
            height: dimensions.height * 0.8
          }
        : dimensions
      
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
      connectionLayer.selectAll('.connection path')
        .filter((conn: any) => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId)
        .attr('d', (conn: any) => getConnectionPath(conn))
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

    // Arrow markers
    const createArrowMarker = (id: string, color: string, size = 14) => {
      defs.append('marker')
        .attr('id', id)
        .attr('markerWidth', size)
        .attr('markerHeight', size)
        .attr('refX', size - 1)
        .attr('refY', size / 2)
        .attr('orient', 'auto-start-reverse')
        .attr('markerUnits', 'userSpaceOnUse')
        .append('polygon')
        .attr('points', `0,0 ${size - 1},${size / 2} 0,${size}`)
        .attr('fill', color)
        .attr('stroke', 'none')
    }
    
    createArrowMarker('arrowhead', '#666')
    createArrowMarker('arrowhead-selected', '#2196F3')
    createArrowMarker('arrowhead-hover', '#1976D2', 18)

    // Layer hierarchy
    const g = svg.append('g')
    const gridLayer = g.append('g').attr('class', 'grid-layer').style('pointer-events', 'none')
    const connectionLayer = g.append('g').attr('class', 'connection-layer')
    const mainNodeLayer = g.append('g').attr('class', 'node-layer')
    
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

      // Mark as dragged if movement is significant
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
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

    connectionEnter.append('path')
      .attr('class', 'connection-path')
      .style('cursor', 'pointer')
      .attr('fill', 'none')
      .on('click', (event, d) => {
        event.stopPropagation()
        onConnectionClick(d)
      })
      .on('mouseenter', function(this: any) {
        d3.select(this)
          .attr('stroke', '#1976D2')
          .attr('stroke-width', 3)
          .attr('marker-end', 'url(#arrowhead-hover)')
      })
      .on('mouseleave', function(this: any, _event: any, d: Connection) {
        const isSelected = selectedConnection?.id === d.id
        d3.select(this)
          .attr('stroke', isSelected ? '#2196F3' : '#666')
          .attr('stroke-width', isSelected ? 3 : 2)
          .attr('marker-end', isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)')
      })
    
    const connectionUpdate = connectionEnter.merge(connectionPaths as any)
    
    connectionUpdate.select('path')
      .attr('d', (d: any) => getConnectionPath(d))
      .attr('stroke', (d: any) => selectedConnection?.id === d.id ? '#2196F3' : '#666')
      .attr('stroke-width', (d: any) => selectedConnection?.id === d.id ? 3 : 2)
      .attr('marker-end', (d: any) => selectedConnection?.id === d.id ? 'url(#arrowhead-selected)' : 'url(#arrowhead)')

    // Render connection preview
    if (isConnecting && connectionStart) {
      const sourceNode = nodes.find(n => n.id === connectionStart.nodeId)
      if (sourceNode && connectionPreview) {
        const previewPath = calculateConnectionPreviewPath(
          sourceNode,
          connectionStart.portId,
          connectionPreview,
          nodeVariant
        )
        
        g.append('path')
          .attr('class', 'connection-preview')
          .attr('d', previewPath)
          .attr('stroke', '#2196F3')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5')
          .attr('fill', 'none')
          .attr('marker-end', 'url(#arrowhead)')
          .attr('pointer-events', 'none')
          .style('opacity', 0.7)
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
        .clickDistance(3)
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


    // Node background
    nodeEnter.append('rect')
      .attr('class', 'node-background')
      .on('dblclick', (event: any, d: any) => {
        event.stopPropagation()
        event.preventDefault()
        onNodeDoubleClick(d)
      })
      
    // Update node background attributes and manage node ordering
    nodeGroups.select('.node-background')
      .attr('width', (d: any) => getConfigurableDimensions(d).width)
      .attr('height', (d: any) => getConfigurableDimensions(d).height)
      .attr('x', (d: any) => -getConfigurableDimensions(d).width / 2)
      .attr('y', (d: any) => -getConfigurableDimensions(d).height / 2)
      .attr('rx', 8)
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
      .attr('x', 0)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', (d: any) => getConfigurableDimensions(d).iconSize)
      .attr('fill', '#333')
      .text((d: any) => getNodeIcon(d.type))

    // Node label
    nodeEnter.append('text')
      .attr('class', 'node-label')
      .style('pointer-events', 'none')
    
    nodeGroups.select('.node-label')
      .attr('x', 0)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', (d: any) => getConfigurableDimensions(d).fontSize - 1)
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
      .attr('cx', (d: any) => {
        const dimensions = getConfigurableDimensions(d.nodeData)
        return -dimensions.width / 2
      })
      .attr('cy', (_d: any, i: number) => {
        const startY = nodeVariant === 'compact' ? -10 : 10
        return startY + i * 25
      })
      .attr('r', (d: any) => getConfigurableDimensions(d.nodeData).portRadius)
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
          onPortDrag(canvasX, canvasY)
        })
        .on('end', (event: any) => {
          console.log('Output port drag end', event.sourceEvent.clientX, event.sourceEvent.clientY)
          
          // Alternative method: use D3 pointer and hit testing
          const svgElement = event.sourceEvent.target.ownerSVGElement
          const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgElement)
          console.log('Mouse position in SVG:', mouseX, mouseY)
          
          let targetNodeId: string | undefined
          let targetPortId: string | undefined
          
          // Find all input port circles and check if mouse is over them
          const allInputPorts = d3.select(svgElement).selectAll('.input-port-circle')
          
          allInputPorts.each(function(d: any) {
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
              console.log('Found input port via hit test:', targetNodeId, targetPortId, 'distance:', distance)
            }
          })
          
          console.log('Final target:', targetNodeId, targetPortId)
          onPortDragEnd(targetNodeId, targetPortId)
        })
      )

    outputPortGroups.selectAll('circle').remove()
    outputPortGroups.append('circle')
      .attr('class', 'output-port-circle')
      .attr('cx', (d: any) => {
        const dimensions = getConfigurableDimensions(d.nodeData)
        return dimensions.width / 2
      })
      .attr('cy', (_d: any, i: number) => {
        const startY = nodeVariant === 'compact' ? -10 : 10
        return startY + i * 25
      })
      .attr('r', (d: any) => getConfigurableDimensions(d.nodeData).portRadius)
      .attr('fill', () => getPortColor('any'))
      .attr('stroke', '#333')
      .attr('stroke-width', 2)

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

  }, [nodes, connections, showGrid, nodeVariant])
  
  
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
    
    // Update connection visual states only
    connectionLayer.selectAll('.connection path')
      .attr('stroke', (d: any) => selectedConnection?.id === d.id ? '#2196F3' : '#666')
      .attr('stroke-width', (d: any) => selectedConnection?.id === d.id ? 3 : 2)
      .attr('marker-end', (d: any) => selectedConnection?.id === d.id ? 'url(#arrowhead-selected)' : 'url(#arrowhead)')
      
  }, [selectedNodes, selectedConnection, isNodeSelected, getNodeColor, isInitialized, organizeNodeZIndex])
  
  // Connection state effect
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return
    
    const svg = d3.select(svgRef.current)
    const g = svg.select('g')
    
    // Handle connection preview
    g.selectAll('.connection-preview').remove()
    
    if (isConnecting && connectionStart) {
      const sourceNode = nodeMap.get(connectionStart.nodeId)
      if (sourceNode && connectionPreview) {
        const previewPath = calculateConnectionPreviewPath(
          sourceNode,
          connectionStart.portId,
          connectionPreview,
          nodeVariant
        )
        
        g.append('path')
          .attr('class', 'connection-preview')
          .attr('d', previewPath)
          .attr('stroke', '#2196F3')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5')
          .attr('fill', 'none')
          .attr('marker-end', 'url(#arrowhead)')
          .attr('pointer-events', 'none')
          .style('opacity', 0.7)
      }
    }
    
    // Update port visual states during connection
    const nodeLayer = svg.select('.node-layer')
    
    // Update input ports visual state
    nodeLayer.selectAll('.input-port-circle')
      .attr('fill', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'output') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'input')
          return canDrop ? '#4CAF50' : '#ccc'
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
      .attr('stroke-width', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'output') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'input')
          return canDrop ? 3 : 2
        }
        return 2
      })
      .attr('r', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'output') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'input')
          const baseDimensions = getConfigurableDimensions(d.nodeData)
          return canDrop ? baseDimensions.portRadius * 1.5 : baseDimensions.portRadius
        }
        return getConfigurableDimensions(d.nodeData).portRadius
      })
      
    // Update output ports visual state
    nodeLayer.selectAll('.output-port-circle')
      .attr('fill', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'input') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'output')
          return canDrop ? '#4CAF50' : '#ccc'
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
      .attr('stroke-width', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'input') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'output')
          return canDrop ? 3 : 2
        }
        return 2
      })
      .attr('r', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'input') {
          const canDrop = canDropOnPort(d.nodeId, d.id, 'output')
          const baseDimensions = getConfigurableDimensions(d.nodeData)
          return canDrop ? baseDimensions.portRadius * 1.5 : baseDimensions.portRadius
        }
        return getConfigurableDimensions(d.nodeData).portRadius
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