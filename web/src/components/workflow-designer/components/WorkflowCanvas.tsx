import React, { useEffect, useRef, useCallback } from 'react'
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
  canDropOnPort: (targetNodeId: string, targetPortId: string) => boolean
  canDropOnNode: (targetNodeId: string) => boolean
  
  // Canvas transform
  onTransformChange: (transform: d3.ZoomTransform) => void
  onZoomLevel?: (zoomLevel: number) => void
  
  // Toolbar controls
  onToggleGrid: () => void
  onVariantChange?: (variant: NodeVariant) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToScreen: () => void
  onResetPosition: () => void
  executionStatus?: 'idle' | 'running' | 'completed' | 'error'
}

export default function WorkflowCanvas({
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
  onTransformChange,
  onZoomLevel,
  onToggleGrid,
  onVariantChange,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetPosition,
  executionStatus = 'idle'
}: WorkflowCanvasProps) {

  const draggedElementRef = useRef<d3.Selection<any, any, any, any> | null>(null)

  // Create grid
  const createGrid = useCallback((
    gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    transform: { x: number; y: number; k: number },
    viewportWidth: number,
    viewportHeight: number
  ) => {
    if (!showGrid) return

    gridLayer.selectAll('*').remove()

    const gridSize = 20 * transform.k
    if (gridSize < 5) return

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
  }, [showGrid])

  // D3 rendering effect
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
    const nodeLayer = g.append('g').attr('class', 'node-layer')
    
    // Add toolbar layer (fixed positioning, not affected by zoom/pan)
    const toolbarLayer = svg.append('g').attr('class', 'toolbar-layer').style('pointer-events', 'all')

    // Create initial grid
    const rect = svgRef.current.getBoundingClientRect()
    createGrid(gridLayer, canvasTransform, rect.width, rect.height)

    // Render canvas toolbar function (defined before zoom behavior)
    const renderCanvasToolbar = () => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      
      // Get current transform
      const currentTransform = svgRef.current ? d3.zoomTransform(svgRef.current) : null
      const currentZoom = currentTransform ? currentTransform.k : canvasTransform.k
      
      toolbarLayer.selectAll('*').remove()
      
      // Toolbar background
      toolbarLayer.append('rect')
        .attr('x', 10)
        .attr('y', 10)
        .attr('width', 320)
        .attr('height', 50)
        .attr('rx', 8)
        .attr('fill', 'rgba(255, 255, 255, 0.95)')
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 1)
        .style('filter', 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))')
        .style('backdrop-filter', 'blur(8px)')
      
      let xOffset = 20
      
      // Zoom controls
      const createToolbarButton = (x: number, y: number, width: number, height: number, text: string, onClick: () => void, disabled = false) => {
        const btn = toolbarLayer.append('g')
          .style('cursor', disabled ? 'not-allowed' : 'pointer')
          .style('opacity', disabled ? 0.5 : 1)
        
        if (!disabled) {
          btn.on('click', onClick)
        }
        
        btn.append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', width)
          .attr('height', height)
          .attr('rx', 4)
          .attr('fill', disabled ? '#f5f5f5' : '#ffffff')
          .attr('stroke', '#ddd')
          .attr('stroke-width', 1)
        
        btn.append('text')
          .attr('x', x + width / 2)
          .attr('y', y + height / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '12px')
          .attr('fill', disabled ? '#999' : '#333')
          .text(text)
        
        return btn
      }
      
      // Zoom In button
      createToolbarButton(xOffset, 25, 30, 20, '+', onZoomIn, currentZoom >= 3)
      xOffset += 35
      
      // Zoom Out button
      createToolbarButton(xOffset, 25, 30, 20, '−', onZoomOut, currentZoom <= 0.2)
      xOffset += 35
      
      // Zoom level display
      toolbarLayer.append('text')
        .attr('x', xOffset + 15)
        .attr('y', 35)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#666')
        .text(`${Math.round(currentZoom * 100)}%`)
      xOffset += 40
      
      // Fit to Screen button
      createToolbarButton(xOffset, 25, 30, 20, '⌂', onFitToScreen)
      xOffset += 35
      
      // Reset Position button
      createToolbarButton(xOffset, 25, 30, 20, '↻', onResetPosition)
      xOffset += 35
      
      // Grid Toggle button
      const gridBtn = createToolbarButton(xOffset, 25, 30, 20, showGrid ? '⊞' : '⊡', onToggleGrid)
      if (showGrid) {
        gridBtn.select('rect').attr('fill', '#e3f2fd').attr('stroke', '#2196F3')
      }
      xOffset += 35
      
      // Node variant selector (if available)
      if (onVariantChange) {
        const variantGroup = toolbarLayer.append('g')
        
        variantGroup.append('rect')
          .attr('x', xOffset)
          .attr('y', 25)
          .attr('width', 60)
          .attr('height', 20)
          .attr('rx', 4)
          .attr('fill', '#ffffff')
          .attr('stroke', '#ddd')
          .attr('stroke-width', 1)
        
        variantGroup.append('text')
          .attr('x', xOffset + 30)
          .attr('y', 35)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '10px')
          .attr('fill', '#333')
          .text(nodeVariant === 'compact' ? 'Compact' : 'Standard')
        
        variantGroup
          .style('cursor', 'pointer')
          .on('click', () => {
            const newVariant = nodeVariant === 'compact' ? 'standard' : 'compact'
            onVariantChange(newVariant as NodeVariant)
          })
      }
    }

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        const transform = event.transform
        g.attr('transform', transform.toString())
        !!onZoomLevel && onZoomLevel(transform.k)
        createGrid(gridLayer, transform, rect.width, rect.height)
        onTransformChange(transform)
        // Update toolbar when zoom changes
        renderCanvasToolbar()
      })

    svg.call(zoom)

    // Set initial transform (not in dependencies to avoid infinite loop)
    svg.call(zoom.transform, d3.zoomIdentity
      .translate(canvasTransform.x, canvasTransform.y)
      .scale(canvasTransform.k))

    // Drag functions
    function dragStarted(this: any, event: any, d: WorkflowNode) {
      // Small delay to allow double-click to be processed first
      setTimeout(() => {
        if (!d3.select(this).classed('dragging')) {
          d3.select(this).classed('dragging', true)
          draggedElementRef.current = d3.select(this)
        }
      }, 10)
      
      const dragData = d as any
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

      // Mark as dragged if movement is significant (threshold to distinguish from click)
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragData.hasDragged = true
      }

      const newX = dragData.initialX + deltaX
      const newY = dragData.initialY + deltaY

      // Update visual position immediately
      if (draggedElementRef.current) {
        draggedElementRef.current.attr('transform', `translate(${newX}, ${newY})`)
      }

      // Update connections in real-time
      connectionLayer.selectAll('.connection path')
        .attr('d', (conn: any) => {
          const sourceNode = nodes.find(n => n.id === conn.sourceNodeId)
          const targetNode = nodes.find(n => n.id === conn.targetNodeId)
          if (!sourceNode || !targetNode) return ''
          return generateVariantAwareConnectionPath(
            sourceNode, 
            conn.sourcePortId, 
            targetNode, 
            conn.targetPortId,
            nodeVariant
          )
        })

      // Notify parent component
      onNodeDrag(d.id, newX, newY)
    }

    function dragEnded(this: any, event: any, d: WorkflowNode) {
      const dragData = d as any
      const hasDragged = dragData.hasDragged
      const dragDuration = Date.now() - (dragData.dragStartTime || 0)

      // Clean up drag state
      delete dragData.dragStartX
      delete dragData.dragStartY
      delete dragData.initialX
      delete dragData.initialY
      delete dragData.hasDragged
      delete dragData.dragStartTime

      d3.select(this).classed('dragging', false)
      if (draggedElementRef.current) {
        draggedElementRef.current = null
      }

      // If no significant drag occurred and duration was short (not a double-click), treat as click
      if (!hasDragged && event.sourceEvent && dragDuration > 200) { // Avoid conflicting with double-click
        const ctrlKey = event.sourceEvent.ctrlKey || event.sourceEvent.metaKey
        onNodeClick(d, ctrlKey)
      }
    }

    // Render connections
    const connectionPaths = connectionLayer.selectAll('.connection')
      .data(connections)
      .enter()
      .append('g')
      .attr('class', 'connection')

    connectionPaths.append('path')
      .attr('d', d => {
        const sourceNode = nodes.find(n => n.id === d.sourceNodeId)
        const targetNode = nodes.find(n => n.id === d.targetNodeId)
        if (!sourceNode || !targetNode) return ''
        return generateVariantAwareConnectionPath(
          sourceNode, 
          d.sourcePortId, 
          targetNode, 
          d.targetPortId,
          nodeVariant
        )
      })
      .attr('stroke', d => selectedConnection?.id === d.id ? '#2196F3' : '#666')
      .attr('stroke-width', d => selectedConnection?.id === d.id ? 3 : 2)
      .attr('fill', 'none')
      .attr('marker-end', d => selectedConnection?.id === d.id ? 'url(#arrowhead-selected)' : 'url(#arrowhead)')
      .attr('class', 'connection-path')
      .style('cursor', 'pointer')
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
    const nodeSelection = nodeLayer.selectAll('.node')
      .data(nodes, (d: any) => d.id)
    
    nodeSelection.exit().remove()
    
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .attr('data-node-id', (d: any) => d.id)
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'move')
      .call(d3.drag<any, WorkflowNode>()
        .container(g.node() as any)
        .clickDistance(5) // Allow clicks within 5px movement
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

    // Get configurable dimensions based on variant
    const getConfigurableDimensions = (node: WorkflowNode) => {
      const dimensions = getNodeDimensions(node)
      
      // Adjust dimensions based on variant
      switch (nodeVariant) {
        case 'compact':
          return {
            ...dimensions,
            width: dimensions.width * 0.8,
            height: dimensions.height * 0.8
          }
        default: // standard
          return dimensions
      }
    }

    // Node background
    nodeEnter.append('rect')
      .attr('class', 'node-background')
      .on('click', (event: any, d: any) => {
        // Only handle click if not dragging
        if (!d3.select(event.currentTarget.parentNode).classed('dragging')) {
          event.stopPropagation()
          const ctrlKey = event.ctrlKey || event.metaKey
          onNodeClick(d, ctrlKey)
        }
      })
      .on('dblclick', (event: any, d: any) => {
        // Always handle double-click immediately to prevent drag interference
        event.stopPropagation()
        event.preventDefault()
        onNodeDoubleClick(d)
      })
      
    // Update node background attributes
    nodeGroups.select('.node-background')
      .attr('width', (d: any) => getConfigurableDimensions(d).width)
      .attr('height', (d: any) => getConfigurableDimensions(d).height)
      .attr('x', (d: any) => -getConfigurableDimensions(d).width / 2)
      .attr('y', (d: any) => -getConfigurableDimensions(d).height / 2)
      .attr('rx', 8)
      .attr('fill', '#ffffff')
      .attr('stroke', (d: any) => getNodeColor(d.type, d.status))
      .attr('stroke-width', (d: any) => isNodeSelected(d.id) ? 3 : 2)
      .style('filter', (d: any) => {
        if (d.status === 'running') return 'drop-shadow(0 0 8px rgba(255, 167, 38, 0.6))'
        if (isNodeSelected(d.id)) return 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))'
        return 'none'
      })

    // Node icon
    nodeEnter.append('text')
      .attr('class', 'node-icon')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('click', (event: any, d: any) => {
        // Only handle click if not dragging
        if (!d3.select(event.currentTarget.parentNode).classed('dragging')) {
          event.stopPropagation()
          const ctrlKey = event.ctrlKey || event.metaKey
          onNodeClick(d, ctrlKey)
        }
      })
      .on('dblclick', (event: any, d: any) => {
        // Always handle double-click immediately to prevent drag interference
        event.stopPropagation()
        event.preventDefault()
        onNodeDoubleClick(d)
      })
    
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
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('click', (event: any, d: any) => {
        // Only handle click if not dragging
        if (!d3.select(event.currentTarget.parentNode).classed('dragging')) {
          event.stopPropagation()
          const ctrlKey = event.ctrlKey || event.metaKey
          onNodeClick(d, ctrlKey)
        }
      })
      .on('dblclick', (event: any, d: any) => {
        // Always handle double-click immediately to prevent drag interference
        event.stopPropagation()
        event.preventDefault()
        onNodeDoubleClick(d)
      })
    
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
          const canDrop = canDropOnPort(d.nodeId, d.id)
          return canDrop ? '#4CAF50' : getPortColor('any')
        }
        return getPortColor('any')
      })
      .attr('stroke', (d: any) => {
        if (isConnecting && connectionStart && connectionStart.type === 'output') {
          const canDrop = canDropOnPort(d.nodeId, d.id)
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
          const elementsUnderMouse = document.elementsFromPoint(
            event.sourceEvent.clientX,
            event.sourceEvent.clientY
          )
          
          let targetNodeId: string | undefined
          let targetPortId: string | undefined
          
          for (const element of elementsUnderMouse) {
            if (element.closest('.input-port-group')) {
              const inputPortGroup = element.closest('.input-port-group')
              const nodeGroup = inputPortGroup?.closest('g[data-node-id]')
              if (nodeGroup && inputPortGroup) {
                targetNodeId = nodeGroup.getAttribute('data-node-id') || undefined
                const portData = d3.select(inputPortGroup).datum() as any
                targetPortId = portData?.id
                break
              }
            }
          }
          
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

    // Initial toolbar render
    renderCanvasToolbar()

    // Cleanup function
    return () => {
      svg.selectAll('*').remove()
    }

  }, [
    nodes, 
    connections,
    showGrid, 
    nodeVariant,
    selectedNodes, 
    selectedConnection, 
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
    onTransformChange,
    onZoomLevel,
    isNodeSelected,
    createGrid,
    canvasTransform.k,
    onToggleGrid,
    onVariantChange,
    onZoomIn,
    onZoomOut,
    onFitToScreen,
    onResetPosition,
    executionStatus
  ])

  return null // This component only manages D3 rendering
}
