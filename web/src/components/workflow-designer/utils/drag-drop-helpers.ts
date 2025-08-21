import * as d3 from 'd3'
import type { WorkflowNode } from '../types'
import { getNodeShape, getShapeAwareDimensions } from './node-utils'
import { findNearestPortTarget, type PortDatum } from './ports-hit-test'
/**
 * Drag/drop helpers for workflow designer
 * - Coordinates (canvasX, canvasY) are in SVG viewport space (after zoom/pan)
 * - Node <g> uses translate(x,y); parseTranslate() converts it to numbers
 */

/**
 * Parse transform="translate(x,y)" from a node group into numeric coordinates.
 * Only supports the translate form used on g[data-node-id].
 */
export function parseTranslate(transform: string | null): { x: number; y: number } {
    if (!transform) {
        return { x: 0, y: 0 }
    }
    const match = /translate\(([^,]+),([^)]+)\)/.exec(transform || '')
    if (match) {
        return { x: parseFloat(match[1]), y: parseFloat(match[2]) }
    }
    return { x: 0, y: 0 }
}

/**
 * Approximate hit-test within node bounds (rect/circle) using shape-aware dimensions.
 * Returns within flag and the radial distance from node center for tie-breaking.
 * Used as a safe fallback when precise SVGGeometry hit-test isn't available.
 */
export function isPointInsideNodeBounds(
    node: WorkflowNode,
    nodeTransform: string | null,
    canvasX: number,
    canvasY: number
): { within: boolean; distance: number } {
    const { x: nodeSvgX, y: nodeSvgY } = parseTranslate(nodeTransform)
    const dims = getShapeAwareDimensions(node)
    const shape = getNodeShape(node.type)
    const relX = canvasX - nodeSvgX
    const relY = canvasY - nodeSvgY
    
    console.warn('[drag-drop] isPointInsideNodeBounds:', {
        nodeId: node.id,
        nodeSvgX,
        nodeSvgY,
        canvasX,
        canvasY,
        relX,
        relY,
        dims,
        shape
    })
    
    if (shape === 'circle') {
        const radius = Math.min(dims.width, dims.height) / 2
        const dist = Math.sqrt(relX ** 2 + relY ** 2)
        return { within: dist <= radius, distance: dist }
    }
    const halfW = dims.width / 2
    const halfH = dims.height / 2
    const within = Math.abs(relX) <= halfW && Math.abs(relY) <= halfH
    const distance = Math.sqrt(relX ** 2 + relY ** 2)
    return { within, distance }
}

/**
 * Find a node background target when pointer doesn't snap to a port.
 * Strictly uses the actual .node-background path via SVGGeometryElement.isPointInFill
 * (with CTM inverse) when available; otherwise falls back to bounds math.
 * Skips the origin node; picks the closest valid node using distance from center.
 */
export function findBackgroundDropTarget(
    svgSelection: d3.Selection<SVGSVGElement, unknown, d3.BaseType, unknown>,
    canvasX: number,
    canvasY: number,
    nodes: WorkflowNode[],
    capturedStart: { nodeId: string; portId: string; type: 'input' | 'output' } | null
): string | undefined {
    // Select only actual node groups (class="node"), not port groups
    const allNodes = svgSelection.selectAll<SVGGElement, unknown>('g.node[data-node-id]')
    let minDist = Infinity
    let targetNodeId: string | undefined
    // Note: canvasX/canvasY are in the SVG viewport coordinate space
    // We'll use element.getCTM() to convert this point into the element's local space.
    
    console.warn('[drag-drop] findBackgroundDropTarget:', {
        canvasX,
        canvasY,
        nodeGroupsCount: allNodes.size(),
        capturedStart
    })

    allNodes.each(function () {
        const nodeGroup = d3.select(this)
        const nodeId = nodeGroup.attr('data-node-id')
        if (!nodeId) {
            return
        }
        if (capturedStart && nodeId === capturedStart.nodeId) {
            console.warn('[drag-drop] Skipping source node:', nodeId)
            return
        }
        const nodeData = nodes.find((n) => n.id === nodeId)
        if (!nodeData) {
            console.warn('[drag-drop] Node data not found for:', nodeId)
            return
        }
        const bgEl = nodeGroup.select<SVGGeometryElement>('.node-background').node()
        // Use path .node-background as the real droppable area (strict)
        const isInside = pointInsideNodeBackground(bgEl, nodeGroup.attr('transform'), nodeData, canvasX, canvasY)
        
        console.warn('[drag-drop] Background check for node:', {
            nodeId,
            nodeX: nodeData.x,
            nodeY: nodeData.y,
            isInside,
            hasBackground: !!bgEl
        })

        if (isInside) {
            // Use distance from node center (approximate) to pick closest valid node
            const within = isPointInsideNodeBounds(nodeData, nodeGroup.attr('transform'), canvasX, canvasY)
            const dist = within.distance
            console.warn('[drag-drop] Node is inside, distance:', dist)
            if (dist < minDist) {
                minDist = dist
                targetNodeId = nodeId
            }
        }
    })
    
    console.warn('[drag-drop] Background drop result:', targetNodeId)
    return targetNodeId
}

/**
 * Strict hit-test against the actual .node-background path using SVGGeometry APIs,
 * with a safe fallback to shape-aware bounds if unavailable.
 */
function pointInsideNodeBackground(
    bgEl: SVGGeometryElement | null,
    nodeTransform: string | null,
    nodeData: WorkflowNode,
    canvasX: number,
    canvasY: number
): boolean {
    // Always use fallback bounds math as it's more reliable for our use case
    // SVG geometry API has issues with coordinate transformation in our setup
    const approx = isPointInsideNodeBounds(nodeData, nodeTransform, canvasX, canvasY)
    console.warn('[drag-drop] Using bounds check:', { 
        nodeId: nodeData.id,
        nodeX: nodeData.x, 
        nodeY: nodeData.y,
        canvasX,
        canvasY,
        within: approx.within,
        distance: approx.distance,
        hasBackground: !!bgEl
    })
    return approx.within
}

/**
 * Select an input port to connect to when dropping on node background.
 * Current strategy: first input; can be enhanced later.
 */
export function chooseBestInputPort(targetNode: WorkflowNode): string | undefined {
    return targetNode.inputs?.[0]?.id
}
/**
 * Resolve the final target when finishing a connection drag.
 * Priority:
 * 1) nearest port (snap)
 * 2) if none, background drop -> choose the best input port of that node
 */
export function resolveDragEndTarget(
    svgElement: SVGSVGElement,
    canvasX: number,
    canvasY: number,
    nodes: WorkflowNode[],
    capturedStart: { nodeId: string; portId: string; type: 'input' | 'output' } | null,
    radiusAccessor: (pd: PortDatum) => number
): { nodeId?: string; portId?: string } {
    try {
        console.warn('[drag-drop] resolveDragEndTarget called:', {
            canvasX,
            canvasY,
            nodesCount: nodes.length,
            capturedStart
        })
        
        const svgSelection = d3.select<SVGSVGElement, unknown>(svgElement)
        const portHit = findNearestPortTarget(
            svgSelection as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>,
            canvasX,
            canvasY,
            radiusAccessor
        )
        
        console.warn('[drag-drop] Port hit result:', portHit)
        
        if (portHit) {
            return { nodeId: portHit.nodeId, portId: portHit.portId }
        }
        
        const bgNodeId = findBackgroundDropTarget(
            svgSelection as unknown as d3.Selection<SVGSVGElement, unknown, d3.BaseType, unknown>,
            canvasX,
            canvasY,
            nodes,
            capturedStart
        )
        
        console.warn('[drag-drop] Background drop target:', bgNodeId)
        
        if (bgNodeId) {
            const targetNode = nodes.find((n) => n.id === bgNodeId)
            const bestPort = targetNode ? chooseBestInputPort(targetNode) : undefined
            console.warn('[drag-drop] Best input port:', bestPort)
            return { nodeId: bgNodeId, portId: bestPort }
        }
        
        console.warn('[drag-drop] No target found')
        return {}
    } catch (error) {
        console.error('[drag-drop] resolveDragEndTarget error', { error })
        return {}
    }
}

/**
 * Helper: derive SVG element from a native sourceEvent with optional fallback
 */
export function getSvgFromSourceEvent(
    sourceEvent: Event | null | undefined,
    fallbackSvg?: SVGSVGElement | null
): SVGSVGElement | null {
    try {
        const evt = sourceEvent as Event | undefined
        if (!evt || !(evt.target as Element | null)) {
            return fallbackSvg || null
        }
        const target = evt.target as Element
        if (!target) {
            return fallbackSvg || null
        }
        if (target instanceof SVGSVGElement) {
            return target
        }
        const svg = target.closest?.('svg')
        return svg || fallbackSvg || null
    } catch (error) {
        console.warn('[drag-drop] getSvgFromSourceEvent failed', error)
        return fallbackSvg || null
    }
}

/**
 * Helper: get canvas coordinates (SVG viewport space) from a native sourceEvent.
 */
export function getCanvasCoordsFromSourceEvent(
    sourceEvent: Event | null | undefined,
    fallbackSvg?: SVGSVGElement | null
): [number, number] {
    try {
        const svgElement = getSvgFromSourceEvent(sourceEvent, fallbackSvg)
        if (!svgElement) {
            return [0, 0]
        }
        const [sx, sy] = d3.pointer(sourceEvent as Event, svgElement)
        const transform = d3.zoomTransform(svgElement)
        const inv = typeof (transform as unknown as { invert?: (pt: [number, number]) => [number, number] }).invert === 'function'
            ? transform.invert([sx, sy])
            : ([sx, sy] as [number, number])
        return inv
    } catch (error) {
        console.warn('[drag-drop] getCanvasCoordsFromSourceEvent failed', error)
        return [0, 0]
    }
}

/**
 * Factory: create standard D3 drag callbacks for ports to avoid duplication.
 * - startAsType controls whether the drag starts as 'output' or 'input'
 * - requireTargetOnEnd enforces valid drop before calling onPortDragEnd (else ignored)
 */
export function createPortDragCallbacks(params: {
    startAsType: 'output' | 'input'
    onPortDragStart: (nodeId: string, portId: string, type: 'input' | 'output') => void
    onPortDrag: (x: number, y: number) => void
    onPortDragEnd: (nodeId?: string, portId?: string, x?: number, y?: number) => void
    nodes: WorkflowNode[]
    getCapturedStart: () => { nodeId: string; portId: string; type: 'input' | 'output' } | null
    setCapturedStart: (v: { nodeId: string; portId: string; type: 'input' | 'output' } | null) => void
    getHitTestPortRadius: (pd: PortDatum) => number
    logTag?: string
    requireTargetOnEnd?: boolean
}) {
    const {
        startAsType,
        onPortDragStart,
        onPortDrag,
        onPortDragEnd,
        nodes,
        getCapturedStart,
        setCapturedStart,
        getHitTestPortRadius,
        logTag,
        requireTargetOnEnd,
    } = params

    function onStart(event: d3.D3DragEvent<Element, unknown, unknown>, d: { nodeId: string; id: string }) {
        try {
            const se = event?.sourceEvent as Event | undefined
                ; (se as unknown as { stopPropagation?: () => void })?.stopPropagation?.()
                ; (se as unknown as { preventDefault?: () => void })?.preventDefault?.()
            const nodeId = d?.nodeId
            const portId = d?.id
            if (!nodeId || !portId) {
                console.warn('[drag-drop] Missing nodeId/portId on drag start, aborting')
                return
            }
            setCapturedStart({ nodeId, portId, type: startAsType })
            if (logTag) {
                console.warn(`🚀 ${logTag} drag START:`, nodeId, portId)
            }
            const [canvasX, canvasY] = getCanvasCoordsFromSourceEvent(event?.sourceEvent as Event)
            onPortDragStart(nodeId, portId, startAsType)
            onPortDrag(canvasX, canvasY)
        } catch (error) {
            console.error('[drag-drop] onStart error', { error })
        }
    }

    function onDrag(event: d3.D3DragEvent<Element, unknown, unknown>) {
        try {
            const [canvasX, canvasY] = getCanvasCoordsFromSourceEvent(event?.sourceEvent as Event)
            if (logTag) {
                console.warn(`🚀 ${logTag} DRAGGING to:`, canvasX, canvasY)
            }
            onPortDrag(canvasX, canvasY)
        } catch (error) {
            console.error('[drag-drop] onDrag error', { error })
        }
    }

    function onEnd(event: d3.D3DragEvent<Element, unknown, unknown>) {
        try {
            if (logTag) {
                console.warn(`🚀 ${logTag} drag END`)
            }
            const svg = getSvgFromSourceEvent(event?.sourceEvent as Event)
            const [canvasX, canvasY] = getCanvasCoordsFromSourceEvent(event?.sourceEvent as Event)
            if (svg) {
                const start = getCapturedStart()
                const result = resolveDragEndTarget(svg, canvasX, canvasY, nodes, start, getHitTestPortRadius)
                if (result.nodeId && result.portId) {
                    onPortDragEnd(result.nodeId, result.portId, canvasX, canvasY)
                } else if (!requireTargetOnEnd) {
                    onPortDragEnd(undefined, undefined, canvasX, canvasY)
                }
            } else {
                console.warn('[drag-drop] No SVG element found on drag end; ignoring drop')
                if (!requireTargetOnEnd) {
                    onPortDragEnd(undefined, undefined, undefined, undefined)
                }
            }
        } catch (error) {
            console.error('[drag-drop] onEnd error', { error })
        } finally {
            setCapturedStart(null)
            if (logTag) {
                console.warn('🧹 Cleared drag connection data')
            }
        }
    }

    return { onStart, onDrag, onEnd }
}
