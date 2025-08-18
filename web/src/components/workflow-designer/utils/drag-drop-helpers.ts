import * as d3 from 'd3'
import type { WorkflowNode } from '../types'
import { getNodeShape, getShapeAwareDimensions } from './node-utils'
import { findNearestPortTarget, type PortDatum } from './ports-hit-test'

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
        const within = isPointInsideNodeBounds(nodeData, nodeGroup.attr('transform'), canvasX, canvasY)
        if (within.within && within.distance < minDist) {
            minDist = within.distance
            targetNodeId = nodeId
        }
    })
    return targetNodeId
}

export function chooseBestInputPort(targetNode: WorkflowNode): string | undefined {
    return targetNode.inputs?.[0]?.id
}

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
