import * as d3 from 'd3'
import type { WorkflowNode } from '../types'

export type PortTarget = { nodeId?: string; portId?: string } | null

// Datum typically bound to port groups and inherited by child elements
export interface PortDatum {
    id: string
    nodeId: string
    nodeData: WorkflowNode
    // Some ports carry additional hints
    type?: 'input' | 'output'
    kind?: 'input' | 'output'
    x?: number
    y?: number
}

/**
 * Find the nearest valid port target around the given canvas coordinates.
 * Considers input circles, output circles, bottom diamonds, and side rectangles.
 */
export function findNearestPortTarget(
    svgSelection: d3.Selection<SVGSVGElement, unknown, d3.BaseType, unknown>,
    canvasX: number,
    canvasY: number,
    getDiamondRadius: (portData: PortDatum) => number
): PortTarget {
    let targetNodeId: string | undefined
    let targetPortId: string | undefined
    let minDistance = Infinity

    const allInputPorts = svgSelection.selectAll<SVGCircleElement, PortDatum>('.input-port-circle')
    const allOutputPorts = svgSelection.selectAll<SVGCircleElement, PortDatum>('.output-port-circle')
    const allBottomPorts = svgSelection.selectAll<SVGPathElement, PortDatum>('.bottom-port-diamond')
    const allSidePorts = svgSelection.selectAll<SVGRectElement, PortDatum>('.side-port-rect')

    // Helper to get node group position from ancestor transform
    function getNodeSvgPos(element: Element): { x: number; y: number } {
        const portGroup = d3.select(element.parentNode as SVGElement)
        const nodeGroup = d3.select(
            portGroup.node()?.closest('g[data-node-id]') as SVGElement
        )
        if (nodeGroup.empty()) {return { x: 0, y: 0 }}
        const transform = nodeGroup.attr('transform')
        let nodeSvgX = 0,
            nodeSvgY = 0
        if (transform) {
            const match = /translate\(([^,]+),([^)]+)\)/.exec(transform)
            if (match) {
                nodeSvgX = parseFloat(match[1])
                nodeSvgY = parseFloat(match[2])
            }
        }
        return { x: nodeSvgX, y: nodeSvgY }
    }

    // Input/output circle ports
    function checkCircle(this: SVGCircleElement, portData: PortDatum) {
        const circle = d3.select(this)
        const element = this as SVGElement
        const { x: nodeSvgX, y: nodeSvgY } = getNodeSvgPos(element)
        const cx = parseFloat(circle.attr('cx') || '0')
        const cy = parseFloat(circle.attr('cy') || '0')
        const r = parseFloat(circle.attr('r') || '8')
        const portCanvasX = nodeSvgX + cx
        const portCanvasY = nodeSvgY + cy
        const distance = Math.hypot(canvasX - portCanvasX, canvasY - portCanvasY)
        const tolerance = r + 5
        if (distance <= tolerance && distance < minDistance) {
            const nodeId = d3
                .select(element.closest('g[data-node-id]') as SVGElement)
                .attr('data-node-id')
            minDistance = distance
            targetNodeId = nodeId
            targetPortId = portData.id
        }
    }

    allInputPorts.each(checkCircle)
    allOutputPorts.each(checkCircle)

    // Bottom diamond ports
    allBottomPorts.each(function (portData: PortDatum) {
        const diamond = d3.select(this)
        const element = this as SVGElement
        const portGroup = d3.select(element.parentNode as SVGElement)
        const nodeGroup = d3.select(
            portGroup.node()?.closest('g[data-node-id]') as SVGElement
        )
        if (nodeGroup.empty()) {return}
        const nodeId = nodeGroup.attr('data-node-id')
        const nodeTransform = nodeGroup.attr('transform')
        let nodeSvgX = 0,
            nodeSvgY = 0
        if (nodeTransform) {
            const match = /translate\(([^,]+),([^)]+)\)/.exec(nodeTransform)
            if (match) {
                nodeSvgX = parseFloat(match[1])
                nodeSvgY = parseFloat(match[2])
            }
        }
        const diamondTransform = diamond.attr('transform')
        let diamondX = 0,
            diamondY = 0
        if (diamondTransform) {
            const match = /translate\(([^,]+),([^)]+)\)/.exec(diamondTransform)
            if (match) {
                diamondX = parseFloat(match[1])
                diamondY = parseFloat(match[2])
            }
        }
        const portCanvasX = nodeSvgX + diamondX
        const portCanvasY = nodeSvgY + diamondY
        const distance = Math.hypot(canvasX - portCanvasX, canvasY - portCanvasY)
        const diamondSize = getDiamondRadius(portData) || 6
        const tolerance = diamondSize + 5
        if (distance <= tolerance && distance < minDistance) {
            minDistance = distance
            targetNodeId = nodeId
            targetPortId = portData.id
        }
    })

    // Side rectangle ports
    allSidePorts.each(function (portData: PortDatum) {
        const rect = d3.select(this)
        const element = this as SVGElement
        const { x: nodeSvgX, y: nodeSvgY } = getNodeSvgPos(element)
        const x = parseFloat(rect.attr('x') || '0')
        const y = parseFloat(rect.attr('y') || '0')
        const w = parseFloat(rect.attr('width') || '10')
        const h = parseFloat(rect.attr('height') || '10')
        const portCanvasX = nodeSvgX + x + w / 2
        const portCanvasY = nodeSvgY + y + h / 2
        const size = Math.max(w, h)
        const distance = Math.hypot(canvasX - portCanvasX, canvasY - portCanvasY)
        const tolerance = size / 2 + 5
        if (distance <= tolerance && distance < minDistance) {
            minDistance = distance
            targetNodeId = d3
                .select(element.closest('g[data-node-id]') as SVGElement)
                .attr('data-node-id')
            targetPortId = portData.id
        }
    })

    if (targetNodeId && targetPortId) {return { nodeId: targetNodeId, portId: targetPortId }}
    return null
}
