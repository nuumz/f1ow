/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react'
import * as d3 from 'd3'
import type { WorkflowNode, Connection } from '../types'
import {
    getNodeColor,
    getNodeShape,
    getShapeAwareDimensions,
    getNodeShapePath,
    getNodeIcon,
    getPortColor,
    NodeTypes,
} from '../utils/node-utils'
import { getShapePath } from '../utils/shape-utils'
import { calculatePortPosition } from '../utils/port-positioning'

export interface NodeRenderingParams {
    svgRef: React.RefObject<SVGSVGElement>
    nodes: WorkflowNode[]
    connections: Connection[]
    isDragging: boolean
    // Designer mode: 'workflow' | 'architecture'
    designerMode: 'workflow' | 'architecture' | undefined

    // Selection and handlers
    isNodeSelected: (nodeId: string) => boolean
    onNodeClick: (node: WorkflowNode, ctrlKey?: boolean) => void
    onNodeDoubleClick: (node: WorkflowNode, event?: any) => void
    onNodeDrag: (nodeId: string, x: number, y: number) => void

    // Ports & node drop
    onPortClick: (nodeId: string, portId: string, type: 'input' | 'output') => void
    onPlusButtonClick?: (nodeId: string, portId: string) => void
    onPortDragStart: (nodeId: string, portId: string, type: 'input' | 'output') => void
    onPortDrag: (x: number, y: number) => void
    onPortDragEnd: (targetNodeId?: string, targetPortId?: string) => void
    canDropOnNode?: (targetNodeId: string) => boolean

    // Context-based dragging helpers
    isContextDragging: () => boolean
    getDraggedNodeId: () => string | null
    startDragging: (id: string, at: { x: number; y: number }) => void
    updateDragPosition: (x: number, y: number) => void
    endDragging: () => void

    // Visual helpers
    setDropFeedback: (nodeElement: d3.Selection<SVGGElement, unknown, null, undefined>, show: boolean) => void
    applyDragVisualStyle: (nodeElement: d3.Selection<any, any, any, any>, nodeId: string) => void
    updateDraggedNodePosition: (nodeId: string, x: number, y: number) => void
    resetNodeVisualStyle: (nodeElement: d3.Selection<any, any, any, any>, nodeId: string) => void
    setNodeAsDragging: (nodeId: string) => void
    organizeNodeZIndex: (immediate?: boolean) => void

    // Dimensions
    getConfigurableDimensions: (node: WorkflowNode) => any

    // Shared refs/state holders from canvas
    draggedElementRef: React.MutableRefObject<d3.Selection<any, any, any, any> | null>
    draggedNodeElementRef: React.MutableRefObject<SVGGElement | null>
    allNodeElementsRef: React.MutableRefObject<Map<string, SVGGElement>>
    dragStateCleanupRef: React.MutableRefObject<NodeJS.Timeout | null>
    currentDragPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>
    connectionUpdateQueueRef: React.MutableRefObject<Set<string>>
    visualUpdateQueueRef: React.MutableRefObject<Set<string>>

    // Utilities and helpers used by icon/label/ports
    getArchitectureIconSvg?: (type: string, size: number, color: string) => string
    isServicesArchitectureNode?: (node: any) => boolean
    getPortHighlightClass?: (nodeId: string, portId: string, kind: 'input' | 'output') => string
    getConfigurablePortPositions?: (node: WorkflowNode, portType: 'input' | 'output') => Array<{ x: number; y: number }>
}

export function useNodeRendering(params: NodeRenderingParams) {
    const {
        svgRef,
        nodes,
        connections,
        isDragging,
        designerMode,
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
        isContextDragging,
        getDraggedNodeId,
        startDragging,
        updateDragPosition,
        endDragging,
        setDropFeedback,
        applyDragVisualStyle,
        updateDraggedNodePosition,
        resetNodeVisualStyle,
        setNodeAsDragging,
        organizeNodeZIndex,
        getConfigurableDimensions,
        draggedElementRef,
        draggedNodeElementRef,
        allNodeElementsRef,
        dragStateCleanupRef,
        currentDragPositionsRef,
        connectionUpdateQueueRef,
        visualUpdateQueueRef,
        getArchitectureIconSvg,
        isServicesArchitectureNode,
        getPortHighlightClass,
        getConfigurablePortPositions,
    } = params

    useEffect(() => {
        const svgEl = svgRef.current
        if (!svgEl) return

        const svg = d3.select(svgEl)
        const nodeLayer = svg.select<SVGGElement>('.node-layer')
        const g = svg.select<SVGGElement>('g.canvas-root')
        if (nodeLayer.empty() || g.empty()) return

        // Ensure defs and background
        let defs = svg.select<SVGDefsElement>('defs')
        if (defs.empty()) {
            defs = svg.append('defs')
        }

        // Ensure background is behind the root/layers, not covering them
        let bg = svg.select<SVGRectElement>('rect.svg-canvas-background')
        if (bg.empty()) {
            // Insert before the canvas root group so it renders underneath
            const inserted = svg.insert('rect', 'g.canvas-root')
            bg = inserted.attr('class', 'svg-canvas-background')
        }
        bg
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', '#f7f7f7')
            .style('pointer-events', 'none')
            .lower() // keep it at the back just in case

        // Create directional markers once
        const createArrowMarker = (
            id: string,
            color: string,
            size = 10,
            direction: 'right' | 'left' = 'right'
        ) => {
            const marker = defs
                .append('marker')
                .attr('id', id)
                .attr('markerWidth', size)
                .attr('markerHeight', size)
                .attr('viewBox', `0 0 ${size} ${size}`)
                .attr('orient', 'auto')
                .attr('markerUnits', 'userSpaceOnUse')

            const isArchitectureMarker = id.includes('architecture')
            const pad = isArchitectureMarker ? 0 : -4
            if (direction === 'right') {
                marker
                    .attr('refX', isArchitectureMarker ? size / 2 : size + pad)
                    .attr('refY', size / 2)
                    .append('polygon')
                    .attr('points', `0,0 ${size},${size / 2} 0,${size}`)
                    .attr('fill', color)
                    .attr('stroke', 'none')
            } else {
                marker
                    .attr('refX', isArchitectureMarker ? size / 2 : -pad)
                    .attr('refY', size / 2)
                    .append('polygon')
                    .attr('points', `${size},0 0,${size / 2} ${size},${size}`)
                    .attr('fill', color)
                    .attr('stroke', 'none')
            }
        }
        const markersInitialized = !defs.select('#arrowhead').empty()
        if (!markersInitialized) {
            createArrowMarker('arrowhead', '#666')
            createArrowMarker('arrowhead-selected', '#2196F3')
            createArrowMarker('arrowhead-hover', '#1976D2', 12)
            createArrowMarker('arrowhead-left', '#666', 10, 'left')
            createArrowMarker('arrowhead-left-selected', '#2196F3', 10, 'left')
            createArrowMarker('arrowhead-left-hover', '#1976D2', 12, 'left')
            createArrowMarker('arrowhead-workflow', '#2563eb', 14)
            createArrowMarker('arrowhead-workflow-selected', '#059669', 16)
            createArrowMarker('arrowhead-workflow-hover', '#1d4ed8', 16)
            createArrowMarker('arrowhead-architecture', '#7c3aed', 10)
            createArrowMarker('arrowhead-architecture-selected', '#dc2626', 12)
            createArrowMarker('arrowhead-architecture-hover', '#6d28d9', 12)
        }

        // Drag handlers
        function dragStarted(this: any, event: any, d: WorkflowNode) {
            const nodeElement = d3.select(this)

            if (dragStateCleanupRef.current) {
                clearTimeout(dragStateCleanupRef.current)
                dragStateCleanupRef.current = null
            }

            const svgElement = svgRef.current!
            const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgElement)
            const transform = d3.zoomTransform(svgElement)
            const [canvasX, canvasY] = transform.invert([mouseX, mouseY])

            startDragging(d.id, { x: canvasX, y: canvasY })

            nodeElement.classed('dragging', true)
            draggedElementRef.current = nodeElement
            draggedNodeElementRef.current = this as SVGGElement

            applyDragVisualStyle(nodeElement, d.id)
            setNodeAsDragging(d.id)

            setTimeout(() => {
                if (draggedElementRef.current && getDraggedNodeId() === d.id) {
                    draggedElementRef.current.classed('dragging', true)
                }
            }, 0)

                ; (d as any).dragStartX = canvasX
                ; (d as any).dragStartY = canvasY
                ; (d as any).initialX = d.x
                ; (d as any).initialY = d.y
                ; (d as any).hasDragged = false
                ; (d as any).dragStartTime = Date.now()
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

            updateDragPosition(currentCanvasX, currentCanvasY)

            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                dragData.hasDragged = true
            }

            const nodeElement = d3.select(this)
            if (!nodeElement.classed('dragging')) nodeElement.classed('dragging', true)

            const newX = dragData.initialX + deltaX
            const newY = dragData.initialY + deltaY

            updateDraggedNodePosition(d.id, newX, newY)
            onNodeDrag(d.id, newX, newY)
        }

        function dragEnded(this: any, event: any, d: WorkflowNode) {
            const dragData = d as any
            const hasDragged = dragData.hasDragged
            const dragDuration = Date.now() - (dragData.dragStartTime || 0)
            const nodeElement = d3.select(this)

            delete dragData.dragStartX
            delete dragData.dragStartY
            delete dragData.initialX
            delete dragData.initialY
            delete dragData.hasDragged
            delete dragData.dragStartTime

            const currentDraggedNodeId = getDraggedNodeId()
            const currentlyDragging = isContextDragging()
            if (currentlyDragging && currentDraggedNodeId === d.id) {
                endDragging()
            }

            nodeElement.classed('dragging', false)

            if (draggedElementRef.current && draggedElementRef.current.node() === this) {
                draggedElementRef.current = null
            }

            currentDragPositionsRef.current.delete(d.id)
            connectionUpdateQueueRef.current.delete(d.id)
            visualUpdateQueueRef.current.delete(d.id)

            resetNodeVisualStyle(nodeElement, d.id)
            organizeNodeZIndex(true)

            if (!hasDragged && event.sourceEvent && dragDuration < 500) {
                const ctrlKey = event.sourceEvent.ctrlKey || event.sourceEvent.metaKey
                onNodeClick(d, ctrlKey)
            }
        }

        // Data join
        const nodeSelection = nodeLayer.selectAll<SVGGElement, any>('.node').data(nodes as any, (d: any) => d.id)

        nodeSelection
            .exit()
            .each(function (this: any, d: any) {
                allNodeElementsRef.current.delete(d.id)
            })
            .remove()

        const nodeEnter = nodeSelection
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('data-node-id', (d: any) => d.id)
            .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)
            .style('cursor', 'move')
            .each(function (this: any, d: any) {
                allNodeElementsRef.current.set(d.id, this)
                if (isDragging && getDraggedNodeId() === d.id) {
                    const nodeElement = d3.select(this)
                    nodeElement.classed('dragging', true)
                    draggedElementRef.current = nodeElement
                }
            })
            .call(
                d3
                    .drag<any, WorkflowNode>()
                    .container(g.node() as any)
                    .clickDistance(5)
                    .on('start', dragStarted)
                    .on('drag', dragged)
                    .on('end', dragEnded) as any
            )

        const nodeGroups = nodeEnter.merge(nodeSelection as any)

        // Preserve dragging class right after merge
        nodeGroups.each(function (this: any, d: any) {
            const nodeElement = d3.select(this)
            const currentDraggedNodeId = getDraggedNodeId()
            const currentlyDragging = isContextDragging()

            const hasDragging = nodeElement.classed('dragging')
            if (currentlyDragging && currentDraggedNodeId === d.id) {
                if (!hasDragging) nodeElement.classed('dragging', true)
                if (!draggedElementRef.current || draggedElementRef.current.node() !== this) {
                    draggedElementRef.current = nodeElement
                }
            } else if (currentlyDragging && currentDraggedNodeId && currentDraggedNodeId !== d.id) {
                if (hasDragging) nodeElement.classed('dragging', false)
            } else if (!currentlyDragging) {
                if (hasDragging) nodeElement.classed('dragging', false)
            }
        })

        // Update positions for non-dragging nodes
        nodeGroups
            .filter(function (this: any) {
                return !d3.select(this).classed('dragging')
            })
            .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)

        // Node background
        nodeEnter
            .append('path')
            .attr('class', 'node-background')
            .on('click', (event: any, d: any) => {
                if (!isDragging) {
                    event.stopPropagation()
                    const ctrlKey = event.ctrlKey || event.metaKey
                    onNodeClick(d as WorkflowNode, ctrlKey)
                }
            })
            .on('dblclick', (event: any, d: any) => {
                event.stopPropagation()
                event.preventDefault()
                onNodeDoubleClick(d as WorkflowNode)
            })
            .on('dragover', (event: any, d: any) => {
                if (canDropOnNode?.((d as WorkflowNode).id)) {
                    event.preventDefault()
                    event.stopPropagation()
                    const nodeElement = d3.select(event.currentTarget.parentNode as SVGGElement)
                    setDropFeedback(nodeElement, true)
                }
            })
            .on('dragleave', (event: any) => {
                const nodeElement = d3.select(event.currentTarget.parentNode as SVGGElement)
                setDropFeedback(nodeElement, false)
            })
            .on('drop', (event: any, d: any) => {
                event.preventDefault()
                event.stopPropagation()
                const nodeElement = d3.select(event.currentTarget.parentNode as SVGGElement)
                setDropFeedback(nodeElement, false)

                const node = d as WorkflowNode
                if (canDropOnNode?.(node.id)) {
                    const available = node.inputs || []
                    if (available.length > 0) {
                        onPortDragEnd(node.id, available[0].id)
                    } else {
                        onPortDragEnd()
                    }
                }
            })

        // Architecture-mode outline
        nodeEnter
            .append('rect')
            .attr('class', 'node-arch-outline')
            .style('pointer-events', 'none')
            .style('fill', 'none')
            .style('stroke', '#3b82f6')
            .style('stroke-width', 2)
            .style('stroke-dasharray', '6,6')
            .style('opacity', 0.8)
            .style('display', 'none')

        // Update node background (shape-aware)
        nodeGroups
            .select('.node-background')
            .attr('d', (d: any) => {
                const shape = getNodeShape(d.type)
                let borderRadius: number | { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number } = 0
                if (designerMode === 'architecture') {
                    const dims = getConfigurableDimensions(d)
                    const radius = 14
                    const pathData = getShapePath('rectangle', dims.width, dims.height, radius)
                    return pathData.d
                }
                if (d.type === 'start') {
                    const dimensions = getShapeAwareDimensions(d)
                    const leftRadius = Math.min(dimensions.width, dimensions.height) * 0.3
                    const rightRadius = 8
                    borderRadius = { topLeft: leftRadius, bottomLeft: leftRadius, topRight: rightRadius, bottomRight: rightRadius }
                } else if (shape === 'rectangle' || shape === 'square') {
                    borderRadius = 8
                }
                const shapePath = getNodeShapePath(d, borderRadius)
                return shapePath.d
            })
            .attr('fill', '#ffffff')
            .attr('stroke', (d: any) => {
                const currentDraggedNodeId = getDraggedNodeId()
                const currentlyDragging = isContextDragging()
                if (currentlyDragging && currentDraggedNodeId === d.id) return '#2196F3'
                return getNodeColor(d.type, d.status)
            })
            .attr('stroke-width', (d: any) => {
                const currentDraggedNodeId = getDraggedNodeId()
                const currentlyDragging = isContextDragging()
                if (currentlyDragging && currentDraggedNodeId === d.id) return 3
                return 2
            })

        // Outline sizing and visibility
        nodeGroups.select('.node-arch-outline').each(function (this: any, d: any) {
            const outline = d3.select(this)
            const dims = getConfigurableDimensions(d)
            const pad = 8
            outline
                .attr('x', -dims.width / 2 - pad)
                .attr('y', -dims.height / 2 - pad)
                .attr('width', dims.width + pad * 2)
                .attr('height', dims.height + pad * 2)
                .attr('rx', 16)
                .style('display', () => (designerMode === 'architecture' ? null : 'none'))
        })

        // Apply selection/dragging visual style
        nodeGroups.each(function (d: any) {
            const nodeElement = d3.select(this)
            const selected = isNodeSelected(d.id)

            let opacity = 1
            let filter = 'none'
            let strokeColor = getNodeColor(d.type, d.status)
            let strokeWidth = 2
            const currentDraggedNodeId = getDraggedNodeId()
            const currentlyDragging = isContextDragging()

            if (selected || (currentlyDragging && currentDraggedNodeId === d.id)) {
                strokeColor = '#2196F3'
                strokeWidth = 3
                if (currentlyDragging && currentDraggedNodeId === d.id) {
                    opacity = 0.9
                    filter = 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))'
                } else if (selected) {
                    filter = 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))'
                }
            }

            nodeElement.style('opacity', opacity).style('filter', filter)
            nodeElement.select('.node-background').attr('stroke', strokeColor).attr('stroke-width', strokeWidth)
        })

        // Mark initialized ordering
        organizeNodeZIndex(true)

        // After background/outline updates
        // Node icon (text) and SVG icon for architecture
        nodeEnter
            .append('text')
            .attr('class', 'node-icon')
            .style('pointer-events', 'none')

        nodeEnter
            .append('g')
            .attr('class', 'node-icon-svg')
            .style('pointer-events', 'none')

        nodeGroups
            .select('.node-icon')
            .style('display', () => (designerMode === 'architecture' ? 'none' : null))
            .attr('x', (d: any) => getConfigurableDimensions(d).iconOffset?.x ?? 0)
            .attr('y', (d: any) => getConfigurableDimensions(d).iconOffset?.y ?? -8)
            .attr('dy', designerMode === 'architecture' ? '0.1em' : '0')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', (d: any) => getConfigurableDimensions(d).iconSize || 18)
            .attr('fill', '#8d8d8d')
            .text((d: any) => getNodeIcon(d.type))

        nodeGroups
            .select('.node-icon-svg')
            .style('display', () => (designerMode === 'architecture' ? null : 'none'))
            .each(function (this: any, d: any) {
                if (designerMode !== 'architecture' || !getArchitectureIconSvg) {
                    d3.select(this).html('')
                    return
                }
                const g = d3.select(this as SVGGElement)
                const dims = getConfigurableDimensions(d)
                const size = dims.iconSize || 24
                const color = '#8d8d8d'
                const svgStr = getArchitectureIconSvg(d.type, size, color)
                const key = `${d.type}:${size}`
                const nodeEl = g.node() as any
                if (nodeEl && nodeEl.__iconKey !== key) {
                    const tx = (dims.iconOffset?.x ?? 0) - size / 2
                    const ty = (dims.iconOffset?.y ?? 0) - size / 2
                    g.attr('transform', `translate(${tx}, ${ty})`)
                    g.html(svgStr || '')
                    nodeEl.__iconKey = key
                }
            })

        // Labels
        nodeEnter
            .append('text')
            .attr('class', 'node-label')
            .style('pointer-events', 'none')

        nodeEnter
            .append('text')
            .attr('class', 'node-sublabel')
            .style('pointer-events', 'none')
            .style('opacity', 0.8)

        nodeGroups
            .select('.node-label')
            .attr('x', (d: any) => {
                const dims = getConfigurableDimensions(d)
                return designerMode === 'architecture' ? dims.width / 2 + 18 : (dims.labelOffset?.x || 0)
            })
            .attr('y', (d: any) => {
                const dims = getConfigurableDimensions(d)
                return designerMode === 'architecture' ? -6 : (dims.labelOffset?.y || 15)
            })
            .attr('text-anchor', () => (designerMode === 'architecture' ? 'start' : 'middle'))
            .attr('dominant-baseline', 'middle')
            .attr('font-size', (d: any) => (getConfigurableDimensions(d).fontSize || 12) - 1)
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text((d: any) => {
                const nodeTypeInfo = (NodeTypes as any)[d.type]
                return nodeTypeInfo?.label || d.label || d.type
            })

        nodeGroups
            .select('.node-sublabel')
            .attr('x', (d: any) => {
                const dims = getConfigurableDimensions(d)
                return designerMode === 'architecture' ? dims.width / 2 + 18 : 0
            })
            .attr('y', () => (designerMode === 'architecture' ? 10 : 99999))
            .attr('text-anchor', () => (designerMode === 'architecture' ? 'start' : 'middle'))
            .attr('dominant-baseline', 'middle')
            .attr('font-size', (d: any) => (getConfigurableDimensions(d).fontSize || 12) - 3)
            .attr('fill', '#6b7280')
            .style('display', () => (designerMode === 'architecture' ? null : 'none'))
            .text((d: any) => d.metadata?.version || d.id)

        // Ports (input/output minimal)
        if (getConfigurablePortPositions) {
            const inputPortGroups = nodeGroups
                .selectAll('.input-port-group')
                .data((d: any) => d.inputs.map((input: any) => ({ ...input, nodeId: d.id, nodeData: d })))
                .join('g')
                .attr('class', (d: any) => {
                    const hasConn = (connections || []).some((conn) => conn.targetNodeId === d.nodeId && conn.targetPortId === d.id)
                    const base = hasConn ? 'port-group input-port-group connected' : 'port-group input-port-group'
                    const hl = getPortHighlightClass ? getPortHighlightClass(d.nodeId, d.id, 'input') : ''
                    return `${base} ${hl}`.trim()
                })
                .style('cursor', designerMode === 'architecture' ? 'crosshair' : 'default')
                .style('pointer-events', designerMode === 'architecture' ? 'all' : 'none')

            inputPortGroups.selectAll('circle').remove()
            inputPortGroups
                .append('circle')
                .attr('class', 'port-circle input-port-circle')
                .attr('cx', (d: any, i: number) => getConfigurablePortPositions(d.nodeData, 'input')[i]?.x || 0)
                .attr('cy', (d: any, i: number) => getConfigurablePortPositions(d.nodeData, 'input')[i]?.y || 0)
                .attr('r', (d: any) => getConfigurableDimensions(d.nodeData).portRadius || 6)
                .attr('fill', getPortColor('any'))
                .attr('stroke', '#333')
                .attr('stroke-width', 2)
                .style('pointer-events', 'none')

            const outputPortGroups = nodeGroups
                .selectAll('.output-port-group')
                .data((d: any) => d.outputs.map((o: any) => ({ ...o, nodeId: d.id, nodeData: d })))
                .join('g')
                .attr('class', (d: any) => {
                    const hasConn = (connections || []).some((conn) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id)
                    return hasConn ? 'port-group output-port-group connected' : 'port-group output-port-group'
                })
                .style('cursor', 'crosshair')
                .style('pointer-events', 'all')

            outputPortGroups.selectAll('circle').remove()
            outputPortGroups
                .append('circle')
                .attr('class', 'port-circle output-port-circle')
                .attr('cx', (d: any, i: number) => getConfigurablePortPositions(d.nodeData, 'output')[i]?.x || 0)
                .attr('cy', (d: any, i: number) => getConfigurablePortPositions(d.nodeData, 'output')[i]?.y || 0)
                .attr('r', (d: any) => getConfigurableDimensions(d.nodeData).portRadius || 6)
                .attr('fill', getPortColor('any'))
                .attr('stroke', '#333')
                .attr('stroke-width', 2)

            // Architecture mode: render four side ports (top/right/bottom/left) as virtual omni-ports
            const isArchitectureMode = designerMode === 'architecture'
            const sidePortGroups = nodeGroups
                .selectAll('.side-port-group')
                .data((d: any) => {
                    if (!isArchitectureMode) return []
                    const dim = getConfigurableDimensions(d)
                    const halfW = (dim.width) / 2
                    const halfH = (dim.height) / 2
                    const sides = [
                        { id: '__side-top', x: 0, y: -halfH, kind: 'input' },
                        { id: '__side-right', x: halfW, y: 0, kind: 'output' },
                        { id: '__side-bottom', x: 0, y: halfH, kind: 'output' },
                        { id: '__side-left', x: -halfW, y: 0, kind: 'input' },
                    ]
                    return sides.map((s) => ({ nodeId: d.id, nodeData: d, id: s.id, kind: s.kind, x: s.x, y: s.y }))
                })
                .join('g')
                .attr('class', (d: any) => {
                    const isConnected = (connections || []).some(
                        (conn) => (conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id) || (conn.targetNodeId === d.nodeId && conn.targetPortId === d.id)
                    )
                    const inputHL = getPortHighlightClass ? getPortHighlightClass(d.nodeId, d.id, 'input') : ''
                    const outputHL = getPortHighlightClass ? getPortHighlightClass(d.nodeId, d.id, 'output') : ''
                    const classes = ['side-port-group', 'port-group']
                    if (isConnected) classes.push('connected')
                    if (inputHL) classes.push(inputHL)
                    if (outputHL) classes.push(outputHL)
                    return classes.join(' ')
                })
                .style('cursor', 'crosshair')
                .style('pointer-events', isArchitectureMode ? 'all' : 'none')
                .on('click', (event: any, d: any) => {
                    event.stopPropagation()
                    onPortClick(d.nodeId, d.id, 'output')
                })
                .call(
                    d3
                        .drag<any, any>()
                        .on('start', (event: any, d: any) => {
                            event.sourceEvent?.stopPropagation()
                            event.sourceEvent?.preventDefault()
                            onPortDragStart(d.nodeId, d.id, 'output')
                            const svgElement = svgRef.current!
                            const [sx, sy] = d3.pointer(event.sourceEvent, svgElement)
                            const transform = d3.zoomTransform(svgElement)
                            const [cx, cy] = transform.invert([sx, sy])
                            onPortDrag(cx, cy)
                        })
                        .on('drag', (event: any) => {
                            const svgElement = svgRef.current!
                            const [sx, sy] = d3.pointer(event.sourceEvent, svgElement)
                            const transform = d3.zoomTransform(svgElement)
                            const [cx, cy] = transform.invert([sx, sy])
                            onPortDrag(cx, cy)
                        })
                        .on('end', (event: any) => {
                            const svgElement = svgRef.current!
                            const svgSel = d3.select(svgElement)
                            const transform = d3.zoomTransform(svgElement)
                            const [sx, sy] = d3.pointer(event.sourceEvent, svgElement)
                            const [canvasX, canvasY] = transform.invert([sx, sy])

                            let targetNodeId: string | undefined
                            let targetPortId: string | undefined
                            let minDistance = Infinity

                            // Check input circles (rendered above)
                            svgSel.selectAll<SVGCircleElement, any>('.input-port-circle').each(function (portData: any) {
                                const circle = d3.select(this)
                                const portGroup = d3.select(this.parentNode as SVGGElement)
                                const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGGElement)
                                if (nodeGroup.empty()) return
                                const nodeId = nodeGroup.attr('data-node-id')
                                const m = /translate\(([^,]+),([^)]+)\)/.exec(nodeGroup.attr('transform') || '')
                                const nodeSvgX = m ? parseFloat(m[1]) : 0
                                const nodeSvgY = m ? parseFloat(m[2]) : 0
                                const cx = parseFloat(circle.attr('cx') || '0')
                                const cy = parseFloat(circle.attr('cy') || '0')
                                const r = parseFloat(circle.attr('r') || '8')
                                const px = nodeSvgX + cx
                                const py = nodeSvgY + cy
                                const dist = Math.hypot(canvasX - px, canvasY - py)
                                const tol = r + 5
                                if (dist <= tol && dist < minDistance) {
                                    minDistance = dist
                                    targetNodeId = nodeId
                                    targetPortId = portData.id
                                }
                            })

                            // Also check side rectangles (top/left act as inputs)
                            svgSel.selectAll<SVGRectElement, any>('.side-port-rect').each(function (portData: any) {
                                const rect = d3.select(this)
                                const portGroup = d3.select(this.parentNode as SVGGElement)
                                const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGGElement)
                                if (nodeGroup.empty()) return
                                const nodeId = nodeGroup.attr('data-node-id')
                                const m = /translate\(([^,]+),([^)]+)\)/.exec(nodeGroup.attr('transform') || '')
                                const nodeSvgX = m ? parseFloat(m[1]) : 0
                                const nodeSvgY = m ? parseFloat(m[2]) : 0
                                const x = parseFloat(rect.attr('x') || '0')
                                const y = parseFloat(rect.attr('y') || '0')
                                const w = parseFloat(rect.attr('width') || '10')
                                const h = parseFloat(rect.attr('height') || '10')
                                const px = nodeSvgX + x + w / 2
                                const py = nodeSvgY + y + h / 2
                                const size = Math.max(w, h)
                                const dist = Math.hypot(canvasX - px, canvasY - py)
                                const tol = size / 2 + 5
                                if (dist <= tol && dist < minDistance) {
                                    minDistance = dist
                                    targetNodeId = nodeId
                                    targetPortId = portData.id
                                }
                            })

                            onPortDragEnd(targetNodeId, targetPortId)
                        }) as any
                )

            sidePortGroups.selectAll('rect').remove()
            sidePortGroups
                .append('rect')
                .attr('class', 'side-port-rect')
                .attr('x', (d: any) => d.x - 6)
                .attr('y', (d: any) => d.y - 6)
                .attr('width', 12)
                .attr('height', 12)
                .attr('rx', 2)
                .attr('ry', 2)
                .attr('fill', (d: any) => (d.kind === 'output' ? '#A8A9B4' : '#CCCCCC'))
                .attr('stroke', '#8d8d8d')
                .attr('stroke-width', 1.5)
                .style('pointer-events', 'all')

            // Bottom ports (diamonds) + connectors + plus button + label
            const bottomPortGroups = nodeGroups
                .filter((d: any) => d.bottomPorts && d.bottomPorts.length > 0)
                .selectAll('.bottom-port-group')
                .data((d: any) => (d.bottomPorts || []).map((p: any) => ({ ...p, nodeId: d.id, nodeData: d })))
                .join('g')
                .attr('class', 'bottom-port-group')
                .style('cursor', 'crosshair')
                .style('pointer-events', 'all')
                .call(
                    d3
                        .drag<any, any>()
                        .on('start', (event: any, d: any) => {
                            event.sourceEvent?.stopPropagation()
                            event.sourceEvent?.preventDefault()
                            onPortDragStart(d.nodeId, d.id, 'output')
                            const svgElement = svgRef.current!
                            const [sx, sy] = d3.pointer(event.sourceEvent, svgElement)
                            const transform = d3.zoomTransform(svgElement)
                            const [cx, cy] = transform.invert([sx, sy])
                            onPortDrag(cx, cy)
                        })
                        .on('drag', (event: any) => {
                            const svgElement = svgRef.current!
                            const [sx, sy] = d3.pointer(event.sourceEvent, svgElement)
                            const transform = d3.zoomTransform(svgElement)
                            const [cx, cy] = transform.invert([sx, sy])
                            onPortDrag(cx, cy)
                        })
                        .on('end', (event: any) => {
                            const svgElement = svgRef.current!
                            const svgSel = d3.select(svgElement)
                            const transform = d3.zoomTransform(svgElement)
                            const [sx, sy] = d3.pointer(event.sourceEvent, svgElement)
                            const [canvasX, canvasY] = transform.invert([sx, sy])

                            let targetNodeId: string | undefined
                            let targetPortId: string | undefined
                            let minDistance = Infinity

                            // Check input circles first
                            svgSel.selectAll<SVGCircleElement, any>('.input-port-circle').each(function (portData: any) {
                                const circle = d3.select(this)
                                const portGroup = d3.select(this.parentNode as SVGGElement)
                                const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGGElement)
                                if (nodeGroup.empty()) return
                                const nodeId = nodeGroup.attr('data-node-id')
                                const m = /translate\(([^,]+),([^)]+)\)/.exec(nodeGroup.attr('transform') || '')
                                const nodeSvgX = m ? parseFloat(m[1]) : 0
                                const nodeSvgY = m ? parseFloat(m[2]) : 0
                                const cx = parseFloat(circle.attr('cx') || '0')
                                const cy = parseFloat(circle.attr('cy') || '0')
                                const r = parseFloat(circle.attr('r') || '8')
                                const px = nodeSvgX + cx
                                const py = nodeSvgY + cy
                                const dist = Math.hypot(canvasX - px, canvasY - py)
                                const tol = r + 5
                                if (dist <= tol && dist < minDistance) {
                                    minDistance = dist
                                    targetNodeId = nodeId
                                    targetPortId = portData.id
                                }
                            })

                            // Check side rectangles as additional targets (architecture omni-ports)
                            svgSel.selectAll<SVGRectElement, any>('.side-port-rect').each(function (portData: any) {
                                const rect = d3.select(this)
                                const portGroup = d3.select(this.parentNode as SVGGElement)
                                const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGGElement)
                                if (nodeGroup.empty()) return
                                const nodeId = nodeGroup.attr('data-node-id')
                                const m = /translate\(([^,]+),([^)]+)\)/.exec(nodeGroup.attr('transform') || '')
                                const nodeSvgX = m ? parseFloat(m[1]) : 0
                                const nodeSvgY = m ? parseFloat(m[2]) : 0
                                const x = parseFloat(rect.attr('x') || '0')
                                const y = parseFloat(rect.attr('y') || '0')
                                const w = parseFloat(rect.attr('width') || '10')
                                const h = parseFloat(rect.attr('height') || '10')
                                const px = nodeSvgX + x + w / 2
                                const py = nodeSvgY + y + h / 2
                                const size = Math.max(w, h)
                                const dist = Math.hypot(canvasX - px, canvasY - py)
                                const tol = size / 2 + 5
                                if (dist <= tol && dist < minDistance) {
                                    minDistance = dist
                                    targetNodeId = nodeId
                                    targetPortId = portData.id
                                }
                            })

                            onPortDragEnd(targetNodeId, targetPortId)
                        }) as any
                )

            // Draw bottom port diamond
            bottomPortGroups.selectAll('path').remove()
            bottomPortGroups
                .append('path')
                .attr('class', 'bottom-port-diamond')
                .attr('d', (d: any) => {
                    const size = getConfigurableDimensions(d.nodeData).portRadius || 6
                    return `M 0,${-size} L ${size},0 L 0,${size} L ${-size},0 Z`
                })
                .attr('transform', (d: any) => {
                    const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', 'normal' as any)
                    const relX = abs.x - d.nodeData.x
                    const relY = abs.y - d.nodeData.y
                    return `translate(${relX}, ${relY})`
                })
                .attr('fill', '#A8A9B4')
                .attr('stroke', 'none')

            // Connector line (simple length for now)
            bottomPortGroups.selectAll('line').remove()
            bottomPortGroups
                .append('line')
                .attr('class', 'bottom-port-connector')
                .attr('x1', (d: any) => {
                    const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', 'normal' as any)
                    return abs.x - d.nodeData.x
                })
                .attr('y1', (d: any) => {
                    const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', 'normal' as any)
                    return abs.y - d.nodeData.y
                })
                .attr('x2', (d: any) => {
                    const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', 'normal' as any)
                    return abs.x - d.nodeData.x
                })
                .attr('y2', (d: any) => {
                    const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', 'normal' as any)
                    const pos = { x: abs.x - d.nodeData.x, y: abs.y - d.nodeData.y }
                    return pos.y + 28
                })
                .attr('stroke', '#A8A9B4')
                .attr('stroke-width', 2)
                .style('pointer-events', 'none')

            // Plus button and label
            bottomPortGroups.each(function (this: any, d: any) {
                const group = d3.select(this)
                const hasConnection = (connections || []).some((conn) => conn.sourceNodeId === d.nodeId && conn.sourcePortId === d.id)
                const nodeIsSelected = isNodeSelected(d.nodeId)
                const shouldShowButton = nodeIsSelected ? true : !hasConnection

                group.selectAll('.plus-button-container').remove()
                group.selectAll('.bottom-port-label-container').remove()

                if (shouldShowButton) {
                    const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', 'normal' as any)
                    const x = abs.x - d.nodeData.x
                    const y = abs.y - d.nodeData.y + 36

                    const plusButtonContainer = group
                        .append('g')
                        .attr('class', 'plus-button-container')
                        .attr('transform', `translate(${x}, ${y})`)
                        .style('cursor', 'crosshair')
                        .style('pointer-events', 'all')

                    const plusButton = plusButtonContainer
                        .append('g')
                        .attr('class', 'plus-button')
                        .style('cursor', 'crosshair')
                        .style('pointer-events', 'all')
                        .call(
                            d3
                                .drag<any, any>()
                                .on('start', (event: any) => {
                                    event.sourceEvent?.stopPropagation()
                                    event.sourceEvent?.preventDefault()
                                    onPortDragStart(d.nodeId, d.id, 'output')
                                })
                                .on('drag', (event: any) => {
                                    const svgElement = svgRef.current!
                                    const [sx, sy] = d3.pointer(event.sourceEvent, svgElement)
                                    const transform = d3.zoomTransform(svgElement)
                                    const [cx, cy] = transform.invert([sx, sy])
                                    onPortDrag(cx, cy)
                                })
                                .on('end', (event: any) => {
                                    const svgElement = svgRef.current!
                                    const transform = d3.zoomTransform(svgElement)
                                    const [sx, sy] = d3.pointer(event.sourceEvent, svgElement)
                                    const [canvasX, canvasY] = transform.invert([sx, sy])

                                    // Find nearest input or bottom port target
                                    let targetNodeId: string | undefined
                                    let targetPortId: string | undefined
                                    let minDistance = 50

                                    nodes.forEach((node: any) => {
                                        if (node.id === d.nodeId) return
                                        // inputs
                                        node.inputs.forEach((input: any, index: number) => {
                                            const pos = (getConfigurablePortPositions as any)(node, 'input')[index]
                                            if (!pos) return
                                            const dist = Math.hypot(canvasX - node.x - pos.x, canvasY - node.y - pos.y)
                                            if (dist < minDistance) {
                                                minDistance = dist
                                                targetNodeId = node.id
                                                targetPortId = input.id
                                            }
                                        })
                                            // bottoms
                                            ; (node.bottomPorts || []).forEach((bp: any) => {
                                                const pos = calculatePortPosition(node, bp.id, 'bottom', 'normal' as any)
                                                const dist = Math.hypot(canvasX - pos.x, canvasY - pos.y)
                                                if (dist < minDistance) {
                                                    minDistance = dist
                                                    targetNodeId = node.id
                                                    targetPortId = bp.id
                                                }
                                            })
                                    })

                                    onPortDragEnd(targetNodeId, targetPortId)
                                }) as any
                        )
                        .on('click', (event: any) => {
                            event.stopPropagation()
                            if (onPlusButtonClick) {
                                onPlusButtonClick(d.nodeId, d.id)
                            } else {
                                onPortClick(d.nodeId, d.id, 'output')
                            }
                        })

                    plusButton
                        .append('rect')
                        .attr('class', 'plus-button-bg')
                        .attr('x', -8)
                        .attr('y', -8)
                        .attr('width', 16)
                        .attr('height', 16)
                        .attr('rx', 2)
                        .attr('ry', 2)
                        .attr('fill', hasConnection ? '#4CAF50' : '#8A8B96')
                        .attr('stroke', nodeIsSelected && hasConnection ? '#388E3C' : 'none')
                        .attr('stroke-width', nodeIsSelected && hasConnection ? 1 : 0)

                    plusButton
                        .append('line')
                        .attr('class', 'plus-horizontal')
                        .attr('x1', -4)
                        .attr('y1', 0)
                        .attr('x2', 4)
                        .attr('y2', 0)
                        .attr('stroke', 'white')
                        .attr('stroke-width', 1.5)
                        .attr('stroke-linecap', 'round')

                    plusButton
                        .append('line')
                        .attr('class', 'plus-vertical')
                        .attr('x1', 0)
                        .attr('y1', -4)
                        .attr('x2', 0)
                        .attr('y2', 4)
                        .attr('stroke', 'white')
                        .attr('stroke-width', 1.5)
                        .attr('stroke-linecap', 'round')
                }

                // Label under bottom port
                const abs = calculatePortPosition(d.nodeData, d.id, 'bottom', 'normal' as any)
                const labelX = abs.x - d.nodeData.x
                const labelY = abs.y - d.nodeData.y + 15

                const labelContainer = group
                    .append('g')
                    .attr('class', 'bottom-port-label-container')
                    .attr('transform', `translate(${labelX}, ${labelY})`)

                const labelText = d.label || d.id
                const textWidth = labelText.length * 5.5
                const padding = 8

                labelContainer
                    .append('rect')
                    .attr('class', 'bottom-port-label-bg')
                    .attr('x', -textWidth / 2 - padding / 2)
                    .attr('y', -7)
                    .attr('width', textWidth + padding)
                    .attr('height', 12)
                    .attr('fill', '#ffffff5b')
                    .attr('stroke', 'none')

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
                    .attr('stroke', 'none')
                    .attr('pointer-events', 'none')
                    .style('user-select', 'none')
                    .text(labelText)
            })
        }
    }, [
        svgRef,
        nodes,
        connections,
        isDragging,
        designerMode,
        isNodeSelected,
        onNodeClick,
        onNodeDoubleClick,
        onNodeDrag,
        onPlusButtonClick,
        onPortClick,
        onPortDragStart,
        onPortDrag,
        onPortDragEnd,
        canDropOnNode,
        isContextDragging,
        getDraggedNodeId,
        startDragging,
        updateDragPosition,
        endDragging,
        setDropFeedback,
        applyDragVisualStyle,
        updateDraggedNodePosition,
        resetNodeVisualStyle,
        setNodeAsDragging,
        organizeNodeZIndex,
        getConfigurableDimensions,
        draggedElementRef,
        draggedNodeElementRef,
        allNodeElementsRef,
        dragStateCleanupRef,
        currentDragPositionsRef,
        connectionUpdateQueueRef,
        visualUpdateQueueRef,
        getArchitectureIconSvg,
        isServicesArchitectureNode,
        getPortHighlightClass,
        getConfigurablePortPositions,
    ])
}
