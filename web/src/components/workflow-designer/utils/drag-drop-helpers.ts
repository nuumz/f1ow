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
    const allNodes = svgSelection.selectAll<SVGGElement, unknown>('g[data-node-id]')
    let minDist = Infinity
    let targetNodeId: string | undefined
    // Note: canvasX/canvasY are in the SVG viewport coordinate space
    // We'll use element.getCTM() to convert this point into the element's local space.

    allNodes.each(function () {
        const nodeGroup = d3.select(this)
        const nodeId = nodeGroup.attr('data-node-id')
        if (!nodeId) {
            return
        }
        if (capturedStart && nodeId === capturedStart.nodeId) {
            return
        }
        const nodeData = nodes.find((n) => n.id === nodeId)
        if (!nodeData) {
            return
        }
        const bgEl = nodeGroup.select<SVGGeometryElement>('.node-background').node()
        // Use path .node-background as the real droppable area (strict)
        const isInside = pointInsideNodeBackground(bgEl, nodeGroup.attr('transform'), nodeData, canvasX, canvasY)

        if (isInside) {
            // Use distance from node center (approximate) to pick closest valid node
            const within = isPointInsideNodeBounds(nodeData, nodeGroup.attr('transform'), canvasX, canvasY)
            const dist = within.distance
            if (dist < minDist) {
                minDist = dist
                targetNodeId = nodeId
            }
        }
    })
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
    if (bgEl && typeof bgEl.isPointInFill === 'function') {
        try {
            const elemCtm = bgEl.getCTM()
            if (elemCtm) {
                const local = new DOMPoint(canvasX, canvasY).matrixTransform(elemCtm.inverse())
                const pt: DOMPointInit = { x: local.x, y: local.y }
                return (
                    bgEl.isPointInFill(pt) || (typeof bgEl.isPointInStroke === 'function' && bgEl.isPointInStroke(pt))
                )
            }
        } catch {
            // ignore and fallback below
        }
    }
    // Fallback: use shape-aware bounds math if precise geometry APIs aren't available
    const approx = isPointInsideNodeBounds(nodeData, nodeTransform, canvasX, canvasY)
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
    const svgSelection = d3.select<SVGSVGElement, unknown>(svgElement)
    const portHit = findNearestPortTarget(svgSelection as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>, canvasX, canvasY, radiusAccessor)
    if (portHit) {
        return { nodeId: portHit.nodeId, portId: portHit.portId }
    }
    const bgNodeId = findBackgroundDropTarget(svgSelection as unknown as d3.Selection<SVGSVGElement, unknown, d3.BaseType, unknown>, canvasX, canvasY, nodes, capturedStart)
    if (bgNodeId) {
        const targetNode = nodes.find((n) => n.id === bgNodeId)
        return { nodeId: bgNodeId, portId: targetNode ? chooseBestInputPort(targetNode) : undefined }
    }
    return {}
}
