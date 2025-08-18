import type * as d3 from 'd3'
import { getPortColor } from './node-utils'

export type PortVisualAttrs = { fill: string; stroke: string; strokeWidth: number; radius: number }

export function computePortVisualAttributes(
    isConnectionActive: boolean,
    archNoValidation: boolean,
    canDrop: boolean,
    baseRadius: number
): PortVisualAttrs {
    if (isConnectionActive && !archNoValidation) {
        if (canDrop) {
            return { fill: '#4CAF50', stroke: '#4CAF50', strokeWidth: 3, radius: baseRadius * 1.5 }
        }
        return { fill: '#ccc', stroke: '#ff5722', strokeWidth: 2, radius: baseRadius }
    }
    return { fill: getPortColor('any'), stroke: '#8d8d8d', strokeWidth: 2, radius: baseRadius }
}

export function applyPortVisualAttributes(
    portElement: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    attrs: PortVisualAttrs
): void {
    const currentFill = portElement.attr('fill')
    const currentStroke = portElement.attr('stroke')
    const currentStrokeWidth = parseInt(portElement.attr('stroke-width') || '2', 10)
    const currentRadius = parseFloat(portElement.attr('r') || '0')

    if (currentFill !== attrs.fill) {
        portElement.attr('fill', attrs.fill)
    }
    if (currentStroke !== attrs.stroke) {
        portElement.attr('stroke', attrs.stroke)
    }
    if (currentStrokeWidth !== attrs.strokeWidth) {
        portElement.attr('stroke-width', attrs.strokeWidth)
    }
    if (Math.abs(currentRadius - attrs.radius) > 0.1) {
        portElement.attr('r', attrs.radius)
    }
}
