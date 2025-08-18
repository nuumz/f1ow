import * as d3 from 'd3'
import type { Connection, WorkflowNode } from '../types'

export type RenderConnectionsOptions = {
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
    connections: Connection[]
    onConnectionClick: (connection: Connection, event?: MouseEvent) => void
    getConnectionPath: (connection: Connection) => string
    createFilledPolygonFromPath: (pathString: string, thickness: number) => string
    getConnectionMarker: (
        connection: Connection,
        state: 'default' | 'selected' | 'hover'
    ) => string
    getConnectionGroupInfo: (
        id: string,
        connections: Connection[]
    ) => { index: number; total: number; isMultiple: boolean }
    workflowMode: 'workflow' | 'architecture' | undefined
    nodeMap: Map<string, WorkflowNode>
}

/**
 * Renders/updates the connections layer using a standard D3 data-join.
 * Extracted from WorkflowCanvas to keep component lean and focused.
 */
export function renderConnectionsLayer(opts: RenderConnectionsOptions) {
    const {
        svg,
        connections,
        onConnectionClick,
        getConnectionPath,
        createFilledPolygonFromPath,
        getConnectionMarker,
        getConnectionGroupInfo,
        workflowMode,
        nodeMap,
    } = opts

    const connectionLayer = svg.select<SVGGElement>('g.connection-layer')
    if (connectionLayer.empty()) return

    // Data-join by id
    const selection = connectionLayer
        .selectAll<SVGGElement, Connection>('g.connection')
        .data(connections, (d: Connection) => d.id)

    // EXIT
    selection.exit().remove()

    // ENTER
    const enter: d3.Selection<SVGGElement, Connection, SVGGElement, unknown> = selection
        .enter()
        .append('g')
        .attr('class', 'connection')
        .attr('data-connection-id', (d: Connection) => d.id)
        .style('pointer-events', 'none')

    // Invisible hitbox for interaction
    enter
        .append('path')
        .attr('class', 'connection-hitbox')
        .attr('fill', 'rgba(0, 0, 0, 0.01)')
        .attr('stroke', 'none')
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent, d: Connection) => {
            event.stopPropagation()
            onConnectionClick(d)
        })
        .on('mouseenter', function (this: SVGGElement) {
            const group = d3.select(this.parentNode as SVGGElement)
            const path = group.select<SVGPathElement>('.connection-path')
            group.classed('connection-hover', true)
            if (!path.empty()) {
                // Visual hover effects are managed elsewhere via CSS; keep hook for future needs
            }
        })
        .on('mouseleave', function (this: SVGGElement) {
            const group = d3.select(this.parentNode as SVGGElement)
            const path = group.select<SVGPathElement>('.connection-path')
            group.classed('connection-hover', false)
            if (!path.empty()) {
                // Reset handled by CSS
            }
        })

    // Visible path
    enter
        .append('path')
        .attr('class', 'connection-path')
        .attr('fill', 'none')
        .style('pointer-events', 'none')

    // Label (used in architecture multi-connection)
    enter
        .append('text')
        .attr('class', 'connection-label')
        .attr('font-size', 10)
        .attr('font-weight', 'bold')
        .attr('fill', '#555')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('pointer-events', 'none')

    // UPDATE + ENTER MERGE
    const merged: d3.Selection<SVGGElement, Connection, SVGGElement, unknown> = enter.merge(
        selection as unknown as d3.Selection<SVGGElement, Connection, SVGGElement, unknown>
    )

    // Update hitbox geometry
    merged
        .select<SVGPathElement>('.connection-hitbox')
        .attr('d', (d: Connection) => createFilledPolygonFromPath(getConnectionPath(d), 8))
        .style('display', (d: Connection) => {
            const groupInfo = getConnectionGroupInfo(d.id, connections)
            return groupInfo.isMultiple && groupInfo.index > 0 ? 'none' : 'block'
        })

    // Update visible path
    merged
        .select<SVGPathElement>('.connection-path')
        .attr('d', (d: Connection) => getConnectionPath(d))
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .attr('marker-end', (d: Connection) => getConnectionMarker(d, 'default'))
        .style('marker-end', (d: Connection) => getConnectionMarker(d, 'default'))
        .style('display', (d: Connection) => {
            const groupInfo = getConnectionGroupInfo(d.id, connections)
            return groupInfo.isMultiple && groupInfo.index > 0 ? 'none' : 'block'
        })
        .attr('class', (d: Connection) => {
            const groupInfo = getConnectionGroupInfo(d.id, connections)
            let classes = 'connection-path'
            if (groupInfo.isMultiple) {
                // Allow CSS styling for grouped connections
                classes += ' connection-multi'
                if (groupInfo.index === 0) classes += ' connection-multi-primary'
            }
            return classes
        })

    // Update label
    merged
        .select<SVGTextElement>('.connection-label')
        .style('display', (d: Connection) => {
            if (workflowMode !== 'architecture') return 'none'
            const gi = getConnectionGroupInfo(d.id, connections)
            return gi.isMultiple && gi.index === 0 ? 'block' : 'none'
        })
        .attr('x', (d: Connection) => {
            if (workflowMode === 'architecture') {
                // When needed, label positioning can be improved to follow Manhattan segments.
                const s = nodeMap.get(d.sourceNodeId)
                const t = nodeMap.get(d.targetNodeId)
                if (!s || !t) return 0
                return (s.x + t.x) / 2
            }
            const s = nodeMap.get(d.sourceNodeId)
            const t = nodeMap.get(d.targetNodeId)
            if (!s || !t) return 0
            return (s.x + t.x) / 2
        })
        .attr('y', (d: Connection) => {
            if (workflowMode === 'architecture') {
                const s = nodeMap.get(d.sourceNodeId)
                const t = nodeMap.get(d.targetNodeId)
                if (!s || !t) return 0
                return (s.y + t.y) / 2 - 8
            }
            const s = nodeMap.get(d.sourceNodeId)
            const t = nodeMap.get(d.targetNodeId)
            if (!s || !t) return 0
            return (s.y + t.y) / 2 - 8
        })
        .text(() => {
            const gi = connections.length
            // Keep minimal label content; customize upstream if needed
            return gi > 0 ? '' : ''
        })
}
