import * as d3 from 'd3'
import type { WorkflowNode } from '../types'

/**
 * Port hit-test utilities
 * - canvasX/canvasY are in SVG viewport coordinates
 * - We derive each port's canvas position by reading its node <g> translate(x,y)
 */

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
 * Notes:
 * - Current logic picks the nearest target within a fixed tolerance
 * - Only input circles and side rectangles are considered valid drop targets here
 * - Distance is computed in canvas coordinates using node transform + local port offsets
 */
export function findNearestPortTarget(
    svgSelection: d3.Selection<SVGSVGElement, unknown, d3.BaseType, unknown>,
    canvasX: number,
    canvasY: number,
    _getDiamondRadius: (portData: PortDatum) => number
): PortTarget {
    // Fixed tolerance for port hit test - increased for better UX
    const PORT_TOLERANCE = 15;
    let targetNodeId: string | undefined
    let targetPortId: string | undefined
    let minDistance = Infinity

    // Only consider input ports and side ports as valid drop targets
    const allInputPorts = svgSelection.selectAll<SVGCircleElement, PortDatum>('.input-port-circle')
    const allSidePorts = svgSelection.selectAll<SVGRectElement, PortDatum>('.side-port-rect')

    console.warn('[ports-hit-test] findNearestPortTarget:', {
        canvasX,
        canvasY,
        inputPortsCount: allInputPorts.size(),
        sidePortsCount: allSidePorts.size()
    })

    // Helper to get node group position from ancestor transform
    // Read the node group's translate(x,y) for absolute location in canvas space
    function getNodeSvgPos(element: Element): { x: number; y: number } {
        const portGroup = d3.select(element.parentNode as SVGElement)
        const nodeGroup = d3.select(
            portGroup.node()?.closest('g[data-node-id]') as SVGElement
        )
        if (nodeGroup.empty()) { return { x: 0, y: 0 } }
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
    // Hit-test for circular ports (primarily input ports)
    function checkCircle(this: SVGCircleElement, portData: PortDatum) {
        const circle = d3.select(this)
        const element = this as SVGElement
        const { x: nodeSvgX, y: nodeSvgY } = getNodeSvgPos(element)
        const cx = parseFloat(circle.attr('cx') || '0')
        const cy = parseFloat(circle.attr('cy') || '0')
        const portCanvasX = nodeSvgX + cx
        const portCanvasY = nodeSvgY + cy
        const distance = Math.hypot(canvasX - portCanvasX, canvasY - portCanvasY)

        if (distance <= PORT_TOLERANCE * 2) {  // Log even near misses
            console.warn('[ports-hit-test] Circle port check:', {
                portId: portData.id,
                portCanvasX,
                portCanvasY,
                distance,
                tolerance: PORT_TOLERANCE,
                isHit: distance <= PORT_TOLERANCE
            })
        }

        if (distance <= PORT_TOLERANCE && distance < minDistance) {
            const nodeId = d3
                .select(element.closest('g[data-node-id]') as SVGElement)
                .attr('data-node-id')
            minDistance = distance
            targetNodeId = nodeId
            targetPortId = portData.id
        }
    }

    allInputPorts.each(checkCircle)

    // Side rectangle ports
    // Hit-test for side rectangle ports (architecture virtual side-ports)
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
        const distance = Math.hypot(canvasX - portCanvasX, canvasY - portCanvasY)

        if (distance <= PORT_TOLERANCE * 2) {  // Log even near misses
            console.warn('[ports-hit-test] Side port check:', {
                portId: portData.id,
                portCanvasX,
                portCanvasY,
                distance,
                tolerance: PORT_TOLERANCE,
                isHit: distance <= PORT_TOLERANCE
            })
        }

        if (distance <= PORT_TOLERANCE && distance < minDistance) {
            minDistance = distance
            targetNodeId = d3
                .select(element.closest('g[data-node-id]') as SVGElement)
                .attr('data-node-id')
            targetPortId = portData.id
        }
    })

    if (targetNodeId && targetPortId) { return { nodeId: targetNodeId, portId: targetPortId } }
    return null
}
