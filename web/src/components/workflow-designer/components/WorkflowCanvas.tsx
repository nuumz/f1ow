import React, { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import type { WorkflowNode } from '../hooks/useNodeSelection'
import type { Connection } from '../hooks/useConnections'
import { generateWorkflowConnectionPath, getVisibleCanvasBounds } from '../utils/canvas-utils'
import { 
  getNodeColor, 
  getPortColor, 
  getNodeIcon, 
  getNodeHeight, 
  NODE_WIDTH, 
  PORT_RADIUS 
} from '../utils/node-utils'

export interface WorkflowCanvasProps {
  // SVG ref
  svgRef: React.RefObject<SVGSVGElement>
  
  // Data
  nodes: WorkflowNode[]
  connections: Connection[]
  
  // Canvas state
  showGrid: boolean
  canvasTransform: { x: number; y: number; k: number }
  
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
  
  // Canvas transform
  onTransformChange: (transform: d3.ZoomTransform) => void
}

export default function WorkflowCanvas({
  svgRef,
  nodes,
  connections,
  showGrid,
  canvasTransform,
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
  onTransformChange
}: WorkflowCanvasProps) {

  const draggedElementRef = useRef<d3.Selection<any, any, any, any> | null>(null)

  // Create grid
  const createGrid = useCallback((
    gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    transform: { x: number; y: number; k: number },
    viewportWidth: number,
    viewportHeight: number
  ) => {
    if (!showGrid) {
      gridLayer.selectAll('*').remove()
      return
    }

    const GRID_SIZE = 50
    const bounds = getVisibleCanvasBounds(transform, viewportWidth, viewportHeight, 500)
    
    // Calculate stroke width and opacity based on zoom
    const strokeWidth = Math.max(0.5, 1 / transform.k)
    const opacity = Math.min(1, Math.max(0.1, transform.k * 0.6 + 0.2))
    
    // Skip grid if too zoomed out
    if (transform.k < 0.3) {
      gridLayer.selectAll('*').remove()
      return
    }

    gridLayer.selectAll('*').remove()

    // Create vertical grid lines
    const startX = Math.floor(bounds.minX / GRID_SIZE) * GRID_SIZE
    const endX = Math.ceil(bounds.maxX / GRID_SIZE) * GRID_SIZE
    
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      gridLayer.append('line')
        .attr('x1', x)
        .attr('y1', bounds.minY)
        .attr('x2', x)
        .attr('y2', bounds.maxY)
        .attr('stroke', '#f5f5f5')
        .attr('stroke-width', strokeWidth)
        .attr('opacity', opacity)
    }
    
    // Create horizontal grid lines
    const startY = Math.floor(bounds.minY / GRID_SIZE) * GRID_SIZE
    const endY = Math.ceil(bounds.maxY / GRID_SIZE) * GRID_SIZE
    
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      gridLayer.append('line')
        .attr('x1', bounds.minX)
        .attr('y1', y)
        .attr('x2', bounds.maxX)
        .attr('y2', y)
        .attr('stroke', '#f5f5f5')
        .attr('stroke-width', strokeWidth)
        .attr('opacity', opacity)
    }
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
    // UI layer for future use
    g.append('g').attr('class', 'ui-layer')

    // Create initial grid
    const rect = svgRef.current.getBoundingClientRect()
    createGrid(gridLayer, canvasTransform, rect.width, rect.height)

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        const { transform } = event
        g.attr('transform', transform.toString())
        
        // Update grid
        const rect = svgRef.current!.getBoundingClientRect()
        createGrid(gridLayer, transform, rect.width, rect.height)
        
        onTransformChange(transform)
      })

    svg.call(zoom)

    // Set initial transform
    const initialTransform = d3.zoomIdentity
      .translate(canvasTransform.x, canvasTransform.y)
      .scale(canvasTransform.k)
    svg.call(zoom.transform, initialTransform)

    // Drag handlers
    function dragStarted(this: any, event: any, d: WorkflowNode) {
      draggedElementRef.current = d3.select(this)
      
      const svgElement = svgRef.current!
      const sourceEvent = event.sourceEvent || event
      const [mouseX, mouseY] = d3.pointer(sourceEvent, svgElement)
      const transform = d3.zoomTransform(svgElement)
      const [canvasX, canvasY] = transform.invert([mouseX, mouseY])

      // Store drag start position
      ;(d as any).dragStartX = canvasX
      ;(d as any).dragStartY = canvasY
      ;(d as any).initialX = d.x
      ;(d as any).initialY = d.y

      draggedElementRef.current
        .raise()
        .classed('dragging', true)
        .style('cursor', 'grabbing')
    }

    function dragged(this: any, event: any, d: WorkflowNode) {
      const dragData = d as any
      if (!draggedElementRef.current || dragData.dragStartX === undefined || dragData.dragStartY === undefined) return
      if (dragData.initialX === undefined || dragData.initialY === undefined) return

      const svgElement = svgRef.current!
      const sourceEvent = event.sourceEvent || event
      const [mouseX, mouseY] = d3.pointer(sourceEvent, svgElement)
      const transform = d3.zoomTransform(svgElement)
      const [currentCanvasX, currentCanvasY] = transform.invert([mouseX, mouseY])

      const deltaX = currentCanvasX - dragData.dragStartX
      const deltaY = currentCanvasY - dragData.dragStartY

      const newX = dragData.initialX + deltaX
      const newY = dragData.initialY + deltaY

      // Update visual position immediately
      draggedElementRef.current.attr('transform', `translate(${newX}, ${newY})`)

      // Update connections in real-time
      connectionLayer.selectAll('.connection path')
        .attr('d', (conn: any) => generateWorkflowConnectionPath(conn, nodes, NODE_WIDTH))

      // Notify parent component
      onNodeDrag(d.id, newX, newY)
    }

    function dragEnded(this: any, _event: any, d: WorkflowNode) {
      if (!draggedElementRef.current) return

      // Clean up drag state
      const dragData = d as any
      delete dragData.dragStartX
      delete dragData.dragStartY
      delete dragData.initialX
      delete dragData.initialY

      draggedElementRef.current
        .classed('dragging', false)
        .style('cursor', 'move')

      draggedElementRef.current = null
    }

    // Render connections
    const connectionPaths = connectionLayer.selectAll('.connection')
      .data(connections)
      .enter()
      .append('g')
      .attr('class', 'connection')

    connectionPaths.append('path')
      .attr('d', d => generateWorkflowConnectionPath(d, nodes, NODE_WIDTH))
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
    if (isConnecting && connectionStart && connectionPreview) {
      const sourceNode = nodes.find(n => n.id === connectionStart.nodeId)
      if (sourceNode) {
        const sourcePort = sourceNode.outputs.find(p => p.id === connectionStart.portId)
        if (sourcePort) {
          const sourceIndex = sourceNode.outputs.indexOf(sourcePort)
          const startX = sourceNode.x + NODE_WIDTH / 2
          const startY = sourceNode.y + 40 + sourceIndex * 30
          
          const dx = connectionPreview.x - startX
          const dy = connectionPreview.y - startY
          const controlOffset = Math.max(Math.abs(dx) / 2.5, 60)
          
          const cp1x = startX + controlOffset
          const cp1y = startY + dy * 0.1
          const cp2x = connectionPreview.x - controlOffset  
          const cp2y = connectionPreview.y - dy * 0.1
          
          const previewPath = `M ${startX} ${startY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${connectionPreview.x} ${connectionPreview.y}`
          
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
    }

    // Render nodes
    const nodeSelection = nodeLayer.selectAll('.node')
      .data(nodes, (d: any) => d.id)
    
    nodeSelection.exit().remove()
    
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'move')
      .call(d3.drag<any, WorkflowNode>()
        .container(g.node() as any)
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded) as any)

    const nodeGroups = nodeEnter.merge(nodeSelection as any)
    
    // Update positions for non-dragging nodes
    nodeGroups
      .filter(function() {
        return !d3.select(this).classed('dragging')
      })
      .attr('transform', d => `translate(${d.x}, ${d.y})`)

    // Node background
    nodeEnter.append('rect')
      .attr('class', 'node-background')
      .attr('width', NODE_WIDTH)
      .attr('x', -NODE_WIDTH / 2)
      .attr('y', -20)
      .attr('rx', 12)
      .attr('fill', '#ffffff')
      .on('click', (event, d) => {
        const ctrlKey = event.ctrlKey || event.metaKey
        onNodeClick(d, ctrlKey)
      })
      .on('dblclick', (_event, d) => {
        onNodeDoubleClick(d)
      })
    
    nodeGroups.select('.node-background')
      .attr('height', d => getNodeHeight(d))
      .attr('stroke', d => getNodeColor(d.type, d.status))
      .attr('stroke-width', d => isNodeSelected(d.id) ? 3 : 2)
      .style('filter', d => {
        if (d.status === 'running') return 'drop-shadow(0 0 8px rgba(255, 167, 38, 0.6))'
        if (isNodeSelected(d.id)) return 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))'
        return 'none'
      })

    // Node status indicator
    nodeEnter.append('circle')
      .attr('class', 'node-status')
      .attr('cx', NODE_WIDTH / 2 - 15)
      .attr('cy', -15)
      .attr('r', 4)
    
    nodeGroups.select('.node-status')
      .attr('fill', d => {
        switch (d.status) {
          case 'running': return '#FFA726'
          case 'completed': return '#66BB6A'
          case 'error': return '#EF5350'
          case 'warning': return '#FFCA28'
          default: return '#9E9E9E'
        }
      })
      .style('display', d => d.status && d.status !== 'idle' ? 'block' : 'none')

    // Node icon
    nodeEnter.append('text')
      .attr('class', 'node-icon')
      .attr('x', -NODE_WIDTH / 2 + 15)
      .attr('y', 5)
      .attr('font-size', '20px')
    
    nodeGroups.select('.node-icon')
      .text(d => getNodeIcon(d.type))

    // Node title
    nodeEnter.append('text')
      .attr('class', 'node-title')
      .attr('x', -NODE_WIDTH / 2 + 45)
      .attr('y', -5)
      .attr('font-weight', '600')
      .attr('font-size', '14px')
      .attr('fill', '#333')
    
    nodeGroups.select('.node-title')
      .text(d => d.label)

    // Node type
    nodeEnter.append('text')
      .attr('class', 'node-type')
      .attr('x', -NODE_WIDTH / 2 + 45)
      .attr('y', 15)
      .attr('font-size', '12px')
      .attr('fill', '#666')
    
    nodeGroups.select('.node-type')
      .text(d => d.type)

    // Input ports
    const inputPortGroups = nodeEnter.selectAll('.input-port')
      .data(d => d.inputs.map(input => ({ ...input, nodeId: d.id })))
      .enter()
      .append('g')
      .attr('class', 'input-port')
      .style('cursor', 'crosshair')
      .style('pointer-events', 'all')
      .on('click', (event, d: any) => {
        event.stopPropagation()
        onPortClick(d.nodeId, d.id, 'input')
      })

    nodeGroups.selectAll('.input-port')
      .data((d: any) => d.inputs.map((input: any) => ({ ...input, nodeId: d.id })))
      .attr('transform', (_d, i) => `translate(${-NODE_WIDTH / 2}, ${40 + i * 30})`)

    inputPortGroups.append('circle')
      .attr('r', PORT_RADIUS)
    
    nodeGroups.each(function(nodeData: any) {
      const nodeGroup = d3.select(this)
      const inputPorts = nodeGroup.selectAll('.input-port circle')
      
      inputPorts
        .attr('fill', () => getPortColor('any'))
        .attr('stroke', () => {
          if (isConnecting && connectionStart) {
            if (connectionStart.type === 'output' && nodeData.id !== connectionStart.nodeId) {
              return '#4CAF50'
            }
          }
          return '#333'
        })
        .attr('stroke-width', () => {
          if (isConnecting && connectionStart && connectionStart.type === 'output' && nodeData.id !== connectionStart.nodeId) {
            return 3
          }
          return 2
        })
        .style('filter', () => {
          if (isConnecting && connectionStart && connectionStart.type === 'output' && nodeData.id !== connectionStart.nodeId) {
            return 'drop-shadow(0 0 4px rgba(76, 175, 80, 0.6))'
          }
          return 'none'
        })
    })

    inputPortGroups.append('text')
      .attr('x', -15)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('fill', '#666')
    
    nodeGroups.each(function(nodeData: any) {
      const nodeGroup = d3.select(this)
      const inputTexts = nodeGroup.selectAll('.input-port text')
      
      inputTexts.each(function(_d, i) {
        if (nodeData.inputs && nodeData.inputs[i]) {
          d3.select(this).text(nodeData.inputs[i].label)
        }
      })
    })

    // Output ports
    const outputPortGroups = nodeEnter.selectAll('.output-port')
      .data(d => d.outputs.map(output => ({ ...output, nodeId: d.id })))
      .enter()
      .append('g')
      .attr('class', 'output-port')
      .style('cursor', 'crosshair')
      .style('pointer-events', 'all')
      .on('click', (event, d: any) => {
        event.stopPropagation()
        onPortClick(d.nodeId, d.id, 'output')
      })

    nodeGroups.selectAll('.output-port')
      .data((d: any) => d.outputs.map((output: any) => ({ ...output, nodeId: d.id })))
      .attr('transform', (_d, i) => `translate(${NODE_WIDTH / 2}, ${40 + i * 30})`)

    outputPortGroups.append('circle')
      .attr('r', PORT_RADIUS)
    
    nodeGroups.each(function(nodeData: any) {
      const nodeGroup = d3.select(this)
      const outputPorts = nodeGroup.selectAll('.output-port circle')
      
      outputPorts
        .attr('fill', () => getPortColor('any'))
        .attr('stroke', () => {
          if (isConnecting && connectionStart && connectionStart.nodeId === nodeData.id) {
            return '#2196F3'
          }
          return '#333'
        })
        .attr('stroke-width', () => {
          if (isConnecting && connectionStart && connectionStart.nodeId === nodeData.id) {
            return 3
          }
          return 2
        })
        .style('filter', () => {
          if (isConnecting && connectionStart && connectionStart.nodeId === nodeData.id) {
            return 'drop-shadow(0 0 4px rgba(33, 150, 243, 0.6))'
          }
          return 'none'
        })
    })

    outputPortGroups.append('text')
      .attr('x', 15)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('font-size', '10px')
      .attr('fill', '#666')
    
    nodeGroups.each(function(nodeData: any) {
      const nodeGroup = d3.select(this)
      const outputTexts = nodeGroup.selectAll('.output-port text')
      
      outputTexts.each(function(_d, i) {
        if (nodeData.outputs && nodeData.outputs[i]) {
          d3.select(this).text(nodeData.outputs[i].label)
        }
      })
    })

    // Canvas click handler
    svg.on('click', () => {
      onCanvasClick()
    })

    // Mouse move handler for connection preview
    svg.on('mousemove', (event) => {
      if (isConnecting && connectionStart) {
        const svgElement = svgRef.current!
        const [mouseX, mouseY] = d3.pointer(event, svgElement)
        const transform = d3.zoomTransform(svgElement)
        const [x, y] = transform.invert([mouseX, mouseY])
        onCanvasMouseMove(x, y)
      }
    })

    // Cleanup function
    return () => {
      svg.selectAll('*').remove()
    }

  }, [
    nodes, 
    connections, 
    showGrid, 
    canvasTransform, 
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
    onTransformChange,
    isNodeSelected,
    createGrid
  ])

  return null // This component only manages D3 rendering
}