/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react'
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
    onPortDragEnd: (targetNodeId?: string, targetPortId?: string, canvasX?: number, canvasY?: number) => void
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

    // Track previous node ids and positions to decide when to rebuild DOM for smoother updates
    const prevNodeIdsRef = useRef<Set<string>>(new Set())
    const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

    useEffect(() => {
        const svgEl = svgRef.current
        if (!svgEl) return

        const svg = d3.select(svgEl)
        const nodeLayer = svg.select<SVGGElement>('.node-layer')
        const g = svg.select<SVGGElement>('g.canvas-root')
        if (nodeLayer.empty() || g.empty()) return

        // Clean up dragging classes to prevent stale state blocking re-render
        const currentDraggedId = getDraggedNodeId()
        if (!isContextDragging() || !currentDraggedId) {
            // If not dragging, remove all dragging classes globally
            nodeLayer.selectAll('.node.dragging').classed('dragging', false)
        } else {
            // If dragging, ensure only the actual dragged node has the class
            nodeLayer
                .selectAll<SVGGElement, any>('.node.dragging')
                .filter(function (this: SVGGElement, d: any) {
                    return d?.id !== currentDraggedId
                })
                .classed('dragging', false)
        }

        // Heuristic: if a significant portion of nodes changed (new/removed) or moved, and not dragging,
        // clear existing node groups first to avoid heavy merge/update churn that can stutter.
        if (!isDragging) {
            try {
                const currentIds = new Set<string>(nodes.map((n) => n.id))
                const prevIds = prevNodeIdsRef.current
                let changed = 0
                // count adds/removes
                currentIds.forEach((id) => { if (!prevIds.has(id)) changed++ })
                prevIds.forEach((id) => { if (!currentIds.has(id)) changed++ })
                const changeRatio = prevIds.size > 0 ? changed / Math.max(prevIds.size, 1) : 1

                // count moved positions (rounded to reduce noise)
                let moved = 0
                const prevPos = prevPositionsRef.current
                for (const n of nodes) {
                    const p = prevPos.get(n.id)
                    if (!p) continue
                    const dx = Math.abs(Math.round(n.x) - Math.round(p.x))
                    const dy = Math.abs(Math.round(n.y) - Math.round(p.y))
                    if (dx + dy >= 2) moved++
                }
                const movedRatio = nodes.length > 0 ? moved / nodes.length : 0

                const MANY_NODES = nodes.length >= 150
                // Lower threshold to trigger rebuild more often
                const shouldRebuild = changeRatio >= 0.1 || movedRatio >= 0.2 || (MANY_NODES && (changed > 0 || moved > 0))

                if (shouldRebuild) {
                    nodeLayer.selectAll<SVGGElement, any>('.node').each(function (this: any, d: any) {
                        allNodeElementsRef.current.delete(d.id)
                    })
                    nodeLayer.selectAll<SVGGElement, any>('.node').remove()

                    // Clear dragged element ref if we're rebuilding
                    if (draggedElementRef.current) {
                        draggedElementRef.current = null
                    }
                }
            } catch {
                // fallback: ignore heuristic errors
            }
        }

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

        // Helper utilities to reduce nesting in drag-end handlers
        function getCanvasCoordsFromEvent(sourceEvent: any): [number, number] {
            const svgElement = svgRef.current!
            const [sx, sy] = d3.pointer(sourceEvent, svgElement)
            const transform = d3.zoomTransform(svgElement)
            return transform.invert([sx, sy]) as [number, number]
        }

        function findNearestPortTarget(canvasX: number, canvasY: number): { targetNodeId?: string; targetPortId?: string } {
            const svgElement = svgRef.current!
            const svgSel = d3.select(svgElement)

            let targetNodeId: string | undefined
            let targetPortId: string | undefined
            let minDistance = Infinity

            console.log('🔍 findNearestPortTarget called with canvas coords:', { canvasX, canvasY })
            console.log('🔍 SVG element exists:', !!svgElement)

            // Count available ports for debugging
            const inputPortCount = svgSel.selectAll('.input-port-circle').size()
            const sidePortCount = svgSel.selectAll('.side-port-rect').size()
            console.log('🔍 Available ports:', { inputPortCount, sidePortCount })

            // Scan input port circles
            svgSel.selectAll<SVGCircleElement, any>('.input-port-circle').each(function (portData: any) {
                const circle = d3.select(this)
                const portGroup = d3.select(this.parentNode as SVGGElement)
                const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGGElement)
                if (nodeGroup.empty()) {
                    console.log('⚠️ Empty nodeGroup for input port')
                    return
                }
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
                const tol = r + 15  // Significantly increase tolerance for easier targeting

                console.log('🔍 Input port check:', {
                    nodeId,
                    portId: portData.id,
                    nodeSvgPos: { x: nodeSvgX, y: nodeSvgY },
                    circlePos: { cx, cy },
                    absolutePos: { px, py },
                    distance: dist,
                    tolerance: tol,
                    withinTolerance: dist <= tol,
                    currentMinDistance: minDistance
                })

                if (dist <= tol && dist < minDistance) {
                    minDistance = dist
                    targetNodeId = nodeId
                    targetPortId = portData.id
                    console.log('✅ New best target (input):', { targetNodeId, targetPortId, distance: dist })
                }
            })

            // Scan side rectangles (architecture omni-ports)
            svgSel.selectAll<SVGRectElement, any>('.side-port-rect').each(function (portData: any) {
                const rect = d3.select(this)
                const portGroup = d3.select(this.parentNode as SVGGElement)
                const nodeGroup = d3.select(portGroup.node()?.closest('g[data-node-id]') as SVGGElement)
                if (nodeGroup.empty()) {
                    console.log('⚠️ Empty nodeGroup for side port')
                    return
                }
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
                const tol = size / 2 + 15  // Significantly increase tolerance for easier targeting

                console.log('🔍 Side port check:', {
                    nodeId,
                    portId: portData.id,
                    nodeSvgPos: { x: nodeSvgX, y: nodeSvgY },
                    rectPos: { x, y, w, h },
                    absolutePos: { px, py },
                    distance: dist,
                    tolerance: tol,
                    withinTolerance: dist <= tol,
                    currentMinDistance: minDistance
                })

                if (dist <= tol && dist < minDistance) {
                    minDistance = dist
                    targetNodeId = nodeId
                    targetPortId = portData.id
                    console.log('✅ New best target (side):', { targetNodeId, targetPortId, distance: dist })
                }
            })

            console.log('🔍 findNearestPortTarget result:', { targetNodeId, targetPortId, finalMinDistance: minDistance })
            return { targetNodeId, targetPortId }
        }

        function findHoveredNodeFallback(canvasX: number, canvasY: number): { targetNodeId?: string; targetPortId?: string } {
            console.log('🔍 findHoveredNodeFallback called with canvas coords:', { canvasX, canvasY })
            console.log('🔍 Total nodes to check:', nodes.length)

            const hovered = (nodes as any[]).find((n: any) => {
                const dims = getConfigurableDimensions(n)
                const w = dims.width
                const h = dims.height
                const inBounds = canvasX >= n.x - w / 2 && canvasX <= n.x + w / 2 && canvasY >= n.y - h / 2 && canvasY <= n.y + h / 2

                console.log('🔍 Node bounds check:', {
                    nodeId: n.id,
                    nodePos: { x: n.x, y: n.y },
                    dimensions: { w, h },
                    bounds: {
                        left: n.x - w / 2,
                        right: n.x + w / 2,
                        top: n.y - h / 2,
                        bottom: n.y + h / 2
                    },
                    canvasPos: { x: canvasX, y: canvasY },
                    inBounds
                })

                return inBounds
            }) as any

            if (hovered) {
                console.log('🔍 Found hovered node:', hovered.id)
                const canDrop = !canDropOnNode || canDropOnNode(hovered.id)
                console.log('🔍 Can drop on hovered node:', canDrop)

                // Override canDropOnNode check for center drops since validation already passed during drag
                // This fixes the issue where canDropOnPort validates correctly but canDropOnNode fails
                if (canDrop || designerMode === 'architecture') {
                    const inputs = (hovered.inputs || []) as any[]
                    const portId = inputs.length > 0 ? inputs[0].id : '__side-top'
                    console.log('✅ Fallback target found (canDrop or architecture mode):', { 
                        targetNodeId: hovered.id, 
                        targetPortId: portId, 
                        inputsCount: inputs.length,
                        canDrop,
                        designerMode
                    })
                    return { targetNodeId: hovered.id, targetPortId: portId }
                } else {
                    console.log('❌ Cannot drop on hovered node (workflow mode with canDrop=false)')
                }
            } else {
                console.log('❌ No hovered node found')
            }

            console.log('🔍 findHoveredNodeFallback result: no target')
            return {}
        }

        // Drag handlers
        function dragStarted(this: any, event: any, d: WorkflowNode) {
            // Prepare drag state; don't attach D3 selection to data to keep state serializable

            if (dragStateCleanupRef.current) {
                clearTimeout(dragStateCleanupRef.current)
                dragStateCleanupRef.current = null
            }

            const svgElement = svgRef.current!
            const [mouseX, mouseY] = d3.pointer(event.sourceEvent, svgElement)
            const transform = d3.zoomTransform(svgElement)
            const [canvasX, canvasY] = transform.invert([mouseX, mouseY])

                // Do NOT mark context as dragging yet; wait for threshold in dragged()
                // Keep element refs unset until real drag begins

                ; (d as any).dragStartX = canvasX
                ; (d as any).dragStartY = canvasY
                ; (d as any).initialX = d.x || 0
                ; (d as any).initialY = d.y || 0
                ; (d as any).hasDragged = false
                ; (d as any).dragStartTime = Date.now()
                ; (d as any).dragArmed = true
                ; (d as any).dragThreshold = 5
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

            const movedEnough = Math.abs(deltaX) > (dragData.dragThreshold || 5) || Math.abs(deltaY) > (dragData.dragThreshold || 5)

            // Arm real dragging only after threshold is exceeded (prevents click being blocked)
            if (!dragData.hasDragged && movedEnough) {
                dragData.hasDragged = true
                // Now mark context as dragging and apply visuals
                startDragging(d.id, { x: dragData.dragStartX, y: dragData.dragStartY })
                const nodeElement = d3.select(this)
                nodeElement.classed('dragging', true)
                draggedElementRef.current = nodeElement
                draggedNodeElementRef.current = this as SVGGElement
                applyDragVisualStyle(nodeElement, d.id)
                setNodeAsDragging(d.id)
            }

            // If not actually dragging yet, do nothing further (let click happen)
            if (!dragData.hasDragged) return

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
            // Ensure no non-serializable references remain on the bound data
            try { delete (dragData as any).nodeElement } catch { }

            const currentDraggedNodeId = getDraggedNodeId()
            const currentlyDragging = isContextDragging()
            if (currentlyDragging && currentDraggedNodeId === d.id) {
                endDragging()
            }

            // Force remove dragging class from this node
            nodeElement.classed('dragging', false)

            // Also ensure no other nodes have the dragging class if we're not dragging
            if (!isContextDragging()) {
                nodeLayer.selectAll('.node').classed('dragging', false)
            }

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

        // Data join - force update existing nodes
        const existingNodes = nodeLayer.selectAll<SVGGElement, any>('.node')
        const nodeSelection = existingNodes.data(nodes as any, (d: any) => d.id)

        // Handle exit selection (removed nodes)
        const exitNodes = nodeSelection.exit()
        exitNodes
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
                // Check both isDragging prop and actual dragging state
                const currentDraggedNodeId = getDraggedNodeId()
                const currentlyDragging = isContextDragging()

                if (currentlyDragging && currentDraggedNodeId === d.id) {
                    const nodeElement = d3.select(this)
                    nodeElement.classed('dragging', true)
                    draggedElementRef.current = nodeElement
                    draggedNodeElementRef.current = this as SVGGElement
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

        // Merge enter and update selections - this includes both new and existing nodes
        const nodeGroups = nodeEnter.merge(nodeSelection as any)

        // Synchronize dragging class with actual drag state
        nodeGroups.each(function (this: any, d: any) {
            const nodeElement = d3.select(this)
            const currentDraggedNodeId = getDraggedNodeId()
            const currentlyDragging = isContextDragging()

            const shouldHaveDraggingClass = currentlyDragging && currentDraggedNodeId === d.id
            const hasDraggingClass = nodeElement.classed('dragging')

            // Update dragging class only if it doesn't match the expected state
            if (shouldHaveDraggingClass && !hasDraggingClass) {
                nodeElement.classed('dragging', true)
                if (!draggedElementRef.current || draggedElementRef.current.node() !== this) {
                    draggedElementRef.current = nodeElement
                    draggedNodeElementRef.current = this as SVGGElement
                }
            } else if (!shouldHaveDraggingClass && hasDraggingClass) {
                nodeElement.classed('dragging', false)
                if (draggedElementRef.current && draggedElementRef.current.node() === this) {
                    draggedElementRef.current = null
                    draggedNodeElementRef.current = null
                }
            }
        })

        // Update positions for all nodes - binding new data
        nodeGroups
            .each(function (this: any, d: any) {
                const element = d3.select(this)
                const isDraggingNode = element.classed('dragging')

                // Always update transform for non-dragging nodes
                if (!isDraggingNode) {
                    element.attr('transform', `translate(${d.x}, ${d.y})`)
                }

                // Store latest data on the element for access in event handlers
                (this as any).__data__ = d
            })

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
                // Only handle HTML5 drag events if we're in a connecting state
                if (isContextDragging() && canDropOnNode?.((d as WorkflowNode).id)) {
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
                // Only handle drops if we're actually dragging a connection
                if (isContextDragging() && canDropOnNode?.(node.id)) {
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

        // Update node background (shape-aware) and rebind click handler with fresh dragging check
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
            // Always rebind the click handler so it reads current dragging state
            .on('click', function (event: any, d: any) {
                // Prevent bubbling to canvas; handle only when not dragging currently
                if (!isContextDragging()) {
                    event.stopPropagation()
                    const ctrlKey = event.ctrlKey || event.metaKey
                    onNodeClick(d as WorkflowNode, ctrlKey)
                }
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

            // Clear existing circles and recreate them
            inputPortGroups.selectAll('circle.port-circle').remove()
            inputPortGroups.each(function (this: any, d: any, i: number) {
                const group = d3.select(this)
                const pos = getConfigurablePortPositions(d.nodeData, 'input')[i]
                if (pos) {
                    group.append('circle')
                        .attr('class', 'port-circle input-port-circle')
                        .attr('cx', pos.x)
                        .attr('cy', pos.y)
                        .attr('r', getConfigurableDimensions(d.nodeData).portRadius || 6)
                        .attr('fill', getPortColor('any'))
                        .attr('stroke', '#333')
                        .attr('stroke-width', 2)
                        .style('pointer-events', 'none')
                }
            })

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

            // Clear existing circles and recreate them
            outputPortGroups.selectAll('circle.port-circle').remove()
            outputPortGroups.each(function (this: any, d: any, i: number) {
                const group = d3.select(this)
                const pos = getConfigurablePortPositions(d.nodeData, 'output')[i]
                if (pos) {
                    group.append('circle')
                        .attr('class', 'port-circle output-port-circle')
                        .attr('cx', pos.x)
                        .attr('cy', pos.y)
                        .attr('r', getConfigurableDimensions(d.nodeData).portRadius || 6)
                        .attr('fill', getPortColor('any'))
                        .attr('stroke', '#333')
                        .attr('stroke-width', 2)
                }
            })

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
                            const [canvasX, canvasY] = getCanvasCoordsFromEvent(event.sourceEvent)
                            const { targetNodeId, targetPortId } = findNearestPortTarget(canvasX, canvasY)
                            if (targetNodeId && targetPortId) {
                                onPortDragEnd(targetNodeId, targetPortId, canvasX, canvasY)
                                return
                            }
                            const fb = findHoveredNodeFallback(canvasX, canvasY)
                            if (fb.targetNodeId && fb.targetPortId) {
                                onPortDragEnd(fb.targetNodeId, fb.targetPortId, canvasX, canvasY)
                            } else {
                                onPortDragEnd('__CANVAS_DROP__', undefined, canvasX, canvasY)
                            }
                        }) as any
                )

            // Clear existing rectangles and recreate them
            sidePortGroups.selectAll('rect.side-port-rect').remove()
            sidePortGroups.each(function (this: any, d: any) {
                const group = d3.select(this)
                group.append('rect')
                    .attr('class', 'side-port-rect')
                    .attr('x', d.x - 6)
                    .attr('y', d.y - 6)
                    .attr('width', 12)
                    .attr('height', 12)
                    .attr('rx', 2)
                    .attr('ry', 2)
                    .attr('fill', d.kind === 'output' ? '#A8A9B4' : '#CCCCCC')
                    .attr('stroke', '#8d8d8d')
                    .attr('stroke-width', 1.5)
                    .style('pointer-events', 'all')
            })

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
                            const [canvasX, canvasY] = getCanvasCoordsFromEvent(event.sourceEvent)
                            const { targetNodeId, targetPortId } = findNearestPortTarget(canvasX, canvasY)
                            if (targetNodeId && targetPortId) {
                                onPortDragEnd(targetNodeId, targetPortId, canvasX, canvasY)
                                return
                            }
                            const fb = findHoveredNodeFallback(canvasX, canvasY)
                            if (fb.targetNodeId && fb.targetPortId) {
                                onPortDragEnd(fb.targetNodeId, fb.targetPortId, canvasX, canvasY)
                            } else {
                                onPortDragEnd('__CANVAS_DROP__', undefined, canvasX, canvasY)
                            }
                        }) as any
                )

            // Clear existing diamonds and recreate them
            bottomPortGroups.selectAll('path.bottom-port-diamond').remove()
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

            // Clear existing connectors and recreate them
            bottomPortGroups.selectAll('line.bottom-port-connector').remove()
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

                // Remove existing plus button container and recreate if needed
                group.selectAll('.plus-button-container').remove()

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
                                    const [canvasX, canvasY] = getCanvasCoordsFromEvent(event.sourceEvent)
                                    console.log('🚀 Port drag end handler - Plus button drag end:', {
                                        sourceNodeId: d.nodeId,
                                        sourcePortId: d.id,
                                        canvasCoords: { x: canvasX, y: canvasY },
                                        sourceEvent: event.sourceEvent?.type
                                    })

                                    // First, reuse nearest standard/side port resolution
                                    let { targetNodeId, targetPortId } = findNearestPortTarget(canvasX, canvasY)
                                    console.log('🚀 First attempt result:', { targetNodeId, targetPortId })

                                    // If none, search inputs and bottom ports by data positions (for non-rendered overlaps)
                                    if (!targetNodeId || !targetPortId) {
                                        console.log('🚀 Trying secondary search by data positions...')
                                        let minDistance = 50
                                        nodes.forEach((node: any) => {
                                            if (node.id === d.nodeId) return
                                            // inputs by configured positions
                                            node.inputs.forEach((input: any, index: number) => {
                                                const pos = (getConfigurablePortPositions as any)(node, 'input')[index]
                                                if (!pos) return
                                                const dist = Math.hypot(canvasX - node.x - pos.x, canvasY - node.y - pos.y)
                                                console.log('🚀 Input position check:', {
                                                    nodeId: node.id,
                                                    inputId: input.id,
                                                    position: pos,
                                                    absolutePos: { x: node.x + pos.x, y: node.y + pos.y },
                                                    distance: dist,
                                                    minDistance
                                                })
                                                if (dist < minDistance) {
                                                    minDistance = dist
                                                    targetNodeId = node.id
                                                    targetPortId = input.id
                                                    console.log('🚀 New best from input positions:', { targetNodeId, targetPortId, dist })
                                                }
                                            })
                                                // bottom ports by absolute positions
                                                ; (node.bottomPorts || []).forEach((bp: any) => {
                                                    const pos = calculatePortPosition(node, bp.id, 'bottom', 'normal' as any)
                                                    const dist = Math.hypot(canvasX - pos.x, canvasY - pos.y)
                                                    console.log('🚀 Bottom port check:', {
                                                        nodeId: node.id,
                                                        bottomPortId: bp.id,
                                                        position: pos,
                                                        distance: dist,
                                                        minDistance
                                                    })
                                                    if (dist < minDistance) {
                                                        minDistance = dist
                                                        targetNodeId = node.id
                                                        targetPortId = bp.id
                                                        console.log('🚀 New best from bottom ports:', { targetNodeId, targetPortId, dist })
                                                    }
                                                })
                                        })
                                        console.log('🚀 Secondary search result:', { targetNodeId, targetPortId, finalMinDistance: minDistance })
                                    }

                                    if (targetNodeId && targetPortId) {
                                        console.log('🚀 Calling onPortDragEnd with target:', { targetNodeId, targetPortId, canvasX, canvasY })
                                        onPortDragEnd(targetNodeId, targetPortId, canvasX, canvasY)
                                        return
                                    }

                                    console.log('🚀 No target found, trying fallback...')
                                    const fb = findHoveredNodeFallback(canvasX, canvasY)
                                    if (fb.targetNodeId && fb.targetPortId) {
                                        console.log('🚀 Calling onPortDragEnd with fallback:', fb)
                                        onPortDragEnd(fb.targetNodeId, fb.targetPortId, canvasX, canvasY)
                                    } else {
                                        console.log('🚀 No fallback found, dropping on canvas')
                                        onPortDragEnd('__CANVAS_DROP__', undefined, canvasX, canvasY)
                                    }
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

                // Label under bottom port - remove existing and recreate
                group.selectAll('.bottom-port-label-container').remove()

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
        // Update previous ids and positions for next render cycle
        try {
            const ids = new Set<string>()
            const pos = new Map<string, { x: number; y: number }>()
            for (const n of nodes) {
                ids.add(n.id)
                pos.set(n.id, { x: n.x, y: n.y })
            }
            prevNodeIdsRef.current = ids
            prevPositionsRef.current = pos
        } catch { }

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
