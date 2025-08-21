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
    if (connectionLayer.empty()) { return }

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

    // Apply group-level classes to allow CSS to target grouped connections easily
    merged
        .classed('connection-multi', (d: Connection) => {
            const gi = getConnectionGroupInfo(d.id, connections)
            return gi.isMultiple
        })
        .classed('connection-multi-primary', (d: Connection) => {
            const gi = getConnectionGroupInfo(d.id, connections)
            return gi.isMultiple && gi.index === 0
        })

    // Update hitbox geometry
    merged
        .select<SVGPathElement>('.connection-hitbox')
        .attr('d', (d: Connection) => {
            const gi = getConnectionGroupInfo(d.id, connections)
            // In architecture mode, increase hitbox thickness for the primary path of grouped connections
            let thickness = 8
            if (workflowMode === 'architecture' && gi.isMultiple && gi.index === 0) {
                // Scale with group size but clamp to avoid excessive thickness
                const strokeWidth = 2 + Math.min(Math.max(gi.total - 1, 0), 4) // 2..6
                thickness = 6 + (strokeWidth - 2) * 2 // 6..14
            }
            return createFilledPolygonFromPath(getConnectionPath(d), thickness)
        })
        .style('display', (d: Connection) => {
            const gi = getConnectionGroupInfo(d.id, connections)
            // In architecture mode, render only a single representative per group (index === 0)
            if (workflowMode === 'architecture') {
                return gi.index === 0 ? 'block' : 'none'
            }
            return 'block'
        })

    // Update visible path
    merged
        .select<SVGPathElement>('.connection-path')
        .attr('d', (d: Connection) => getConnectionPath(d))
        .attr('stroke', 'white')
        .attr('stroke-width', (d: Connection) => {
            const gi = getConnectionGroupInfo(d.id, connections)
            if (workflowMode === 'architecture' && gi.isMultiple && gi.index === 0) {
                // Thicken primary path to visually represent the number of connections in the group
                return 2 + Math.min(Math.max(gi.total - 1, 0), 4) // 2..6
            }
            return 2
        })
        .attr('marker-end', (d: Connection) => getConnectionMarker(d, 'default'))
        .style('marker-end', (d: Connection) => getConnectionMarker(d, 'default'))
        .style('display', (d: Connection) => {
            const gi = getConnectionGroupInfo(d.id, connections)
            if (workflowMode === 'architecture') {
                return gi.index === 0 ? 'block' : 'none'
            }
            return 'block'
        })
        .attr('class', (d: Connection) => {
            const groupInfo = getConnectionGroupInfo(d.id, connections)
            let classes = 'connection-path'
            if (groupInfo.isMultiple) {
                // Allow CSS styling for grouped connections
                classes += ' connection-multi'
                if (groupInfo.index === 0) { classes += ' connection-multi-primary' }
            }
            return classes
        })

    // Update label
    merged
        .select<SVGTextElement>('.connection-label')
        .style('display', (d: Connection) => {
            if (workflowMode !== 'architecture') { return 'none' }
            const gi = getConnectionGroupInfo(d.id, connections)
            // Show label for the representative connection only (index === 0)
            return gi.index === 0 ? 'block' : 'none'
        })
        .attr('x', function (this: SVGTextElement, d: Connection) {
            // In architecture mode, place label at the midpoint of the actual path geometry
            if (workflowMode === 'architecture') {
                const group = d3.select(this.parentNode as SVGGElement)
                const pathEl = group.select<SVGPathElement>('.connection-path').node()
                if (pathEl) {
                    try {
                        const len = pathEl.getTotalLength()
                        const pt = pathEl.getPointAtLength(len / 2)
                        return pt.x
                    } catch {
                        // fall through to node-midpoint fallback
                    }
                }
            }
            // Fallback: midpoint between node centers
            const s = nodeMap.get(d.sourceNodeId)
            const t = nodeMap.get(d.targetNodeId)
            if (!s || !t) { return 0 }
            return (s.x + t.x) / 2
        })
        .attr('y', function (this: SVGTextElement, d: Connection) {
            // In architecture mode, place label at the midpoint of the actual path geometry
            if (workflowMode === 'architecture') {
                const group = d3.select(this.parentNode as SVGGElement)
                const pathEl = group.select<SVGPathElement>('.connection-path').node()
                if (pathEl) {
                    try {
                        const len = pathEl.getTotalLength()
                        const pt = pathEl.getPointAtLength(len / 2)
                        return pt.y - 8 // slight upward offset for readability
                    } catch {
                        // fall through to node-midpoint fallback
                    }
                }
            }
            // Fallback: midpoint between node centers
            const s = nodeMap.get(d.sourceNodeId)
            const t = nodeMap.get(d.targetNodeId)
            if (!s || !t) { return 0 }
            return (s.y + t.y) / 2 - 8
        })
        .text((d: Connection) => {
            if (workflowMode !== 'architecture') { return '' }
            const gi = getConnectionGroupInfo(d.id, connections)
            // Show count on the representative only
            return gi.index === 0 ? `${gi.total} connections` : ''
        })
}
