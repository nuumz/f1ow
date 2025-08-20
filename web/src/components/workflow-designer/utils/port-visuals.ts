import type * as d3 from 'd3'
import type { WorkflowNode, Connection } from '../types'
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

/**
 * Checks if a bottom port can accept additional connections
 * Based on business rules for different port types:
 * - ai-model: Single connection only (no plus button when connected)
 * - memory: Single connection only (no plus button when connected)
 * - tool: Multiple connections allowed (always show plus button)
 * - Other array types: Multiple connections allowed
 * - Other single types: Single connection only
 */
export function canBottomPortAcceptConnection(
    nodeId: string,
    portId: string,
    connections: Connection[],
    nodeMap: Map<string, WorkflowNode>,
    designerMode?: 'workflow' | 'architecture'
): boolean {
    // Get the node to check its bottom ports configuration
    const node = nodeMap.get(nodeId)
    if (!node?.bottomPorts) {
        return false
    }

    const port = node.bottomPorts.find((p) => p.id === portId)
    if (!port) {
        return false
    }

    // Count existing connections for this port
    const existingConnections = connections.filter(
        (conn: Connection) => conn.sourceNodeId === nodeId && conn.sourcePortId === portId
    )

    // In architecture mode, allow multiple connections across all bottom ports
    if (designerMode === 'architecture') {
        return true
    }

    // Original workflow mode logic (stricter validation)
    switch (portId) {
        case 'ai-model':
            // AI Model port: Only allows 1 connection (can replace existing)
            // Show plus button only when no connection exists
            return existingConnections.length === 0

        case 'memory':
            // Memory port: Typically allows only 1 connection
            return existingConnections.length === 0

        case 'tool':
            // Tool port: Allows multiple connections (array of tools)
            return true

        default:
            // For other ports, check if dataType suggests multiple connections
            if (port.dataType === 'array') {
                // Array types can accept multiple connections
                return true
            } else {
                // Single value types typically allow only one connection
                return existingConnections.length === 0
            }
    }
}

/**
 * Checks if a port has multiple connections
 */
export function hasMultipleConnections(
    nodeId: string,
    portId: string,
    portType: 'input' | 'output',
    connections: Connection[]
): boolean {
    if (portType === 'input') {
        return (
            connections.filter(
                (conn: Connection) => conn.targetNodeId === nodeId && conn.targetPortId === portId
            ).length > 1
        )
    } else {
        return (
            connections.filter(
                (conn: Connection) => conn.sourceNodeId === nodeId && conn.sourcePortId === portId
            ).length > 1
        )
    }
}

/**
 * Gets port highlight class for architecture mode
 */
export function getPortHighlightClass(
    nodeId: string,
    portId: string,
    portType: 'input' | 'output',
    connections: Connection[],
    designerMode?: string
): string {
    if (designerMode !== 'architecture') {
        return ''
    }

    const isMultiple = hasMultipleConnections(nodeId, portId, portType, connections)
    const classes = []

    if (isMultiple) {
        classes.push('has-multiple-connections')
    }

    return classes.join(' ')
}
