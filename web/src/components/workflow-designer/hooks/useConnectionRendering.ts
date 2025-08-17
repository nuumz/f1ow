import { useEffect } from 'react'
import * as d3 from 'd3'
import type { Connection, WorkflowNode } from '../types'
import { getPathMidpointWithOrientation, getLabelOffsetForOrientation } from '../utils/svg-path-utils'
import { getConnectionGroupInfo } from '../utils/connection-utils'

export type MarkerState = 'default' | 'hover' | 'selected'

interface Params {
    svgRef: React.RefObject<SVGSVGElement>
    connections: Connection[]
    getConnectionPath: (connection: Connection) => string
    getConnectionMarker: (connection: Connection, state?: MarkerState) => string
    designerMode?: 'workflow' | 'architecture'
    nodeMap: Map<string, WorkflowNode>
    onConnectionClick: (connection: Connection) => void
    createFilledPolygonFromPath: (pathString: string, thickness?: number) => string
}

/**
 * Encapsulates the D3 connections-only rendering effect.
 * Responsible for data-join of connections, path/hitbox updates, hover/selection styling, and labels.
 */
export function useConnectionRendering(params: Params) {
    const {
        svgRef,
        connections,
        getConnectionPath,
        getConnectionMarker,
        designerMode,
        nodeMap,
        onConnectionClick,
        createFilledPolygonFromPath,
    } = params

    useEffect(() => {
        const svgEl = svgRef.current
        if (!svgEl) return

        try {
            const svg = d3.select(svgEl)
            const connectionLayer = svg.select<SVGGElement>('.connection-layer')
            if (connectionLayer.empty()) return

            // Data-join by id
            const selection = connectionLayer
                .selectAll<SVGGElement, Connection>('g.connection')
                .data(connections, (d) => d.id)

            // EXIT
            selection.exit().remove()

            // ENTER
            const enter = selection
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
                .on('mouseenter', (event: MouseEvent, d: Connection) => {
                    const current = (event?.currentTarget as SVGPathElement) || null
                    const group = current ? d3.select(current.parentNode as SVGGElement) : d3.select(null)
                    const path = group.select<SVGPathElement>('.connection-path')
                    group.classed('connection-hover', true)
                    if (!path.empty()) {
                        path
                            .attr('stroke', '#1976D2')
                            .attr('stroke-width', 3)
                            .attr('marker-end', getConnectionMarker(d, 'hover'))
                            .style('marker-end', getConnectionMarker(d, 'hover'))
                    }
                })
                .on('mouseleave', (event: MouseEvent, d: Connection) => {
                    const current = (event?.currentTarget as SVGPathElement) || null
                    const group = current ? d3.select(current.parentNode as SVGGElement) : d3.select(null)
                    const path = group.select<SVGPathElement>('.connection-path')
                    group.classed('connection-hover', false)
                    if (!path.empty()) {
                        path
                            .attr('stroke', 'white')
                            .attr('stroke-width', 2)
                            .attr('marker-end', getConnectionMarker(d, 'default'))
                            .style('marker-end', getConnectionMarker(d, 'default'))
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
            const merged = enter.merge(selection)

            // Use shared grouping helper from connection-utils

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
                        classes += ' multiple-connection'
                        if (groupInfo.index === 1) classes += ' secondary'
                        if (groupInfo.index === 2) classes += ' tertiary'
                    }
                    return classes
                })

            // Update label
            merged
                .select<SVGTextElement>('.connection-label')
                .style('display', (d: Connection) => {
                    if (designerMode !== 'architecture') return 'none'
                    const gi = getConnectionGroupInfo(d.id, connections)
                    return gi.isMultiple && gi.index === 0 ? 'block' : 'none'
                })
                .attr('x', (d: Connection) => {
                    if (designerMode === 'architecture') {
                        const pathStr = getConnectionPath(d)
                        const mid = getPathMidpointWithOrientation(pathStr)
                        if (mid) {
                            const offset = getLabelOffsetForOrientation(mid.orientation)
                            return mid.x + offset.x
                        }
                    }
                    const s = nodeMap.get(d.sourceNodeId)
                    const t = nodeMap.get(d.targetNodeId)
                    if (!s || !t) return 0
                    return (s.x + t.x) / 2
                })
                .attr('y', (d: Connection) => {
                    if (designerMode === 'architecture') {
                        const pathStr = getConnectionPath(d)
                        const mid = getPathMidpointWithOrientation(pathStr)
                        if (mid) {
                            const offset = getLabelOffsetForOrientation(mid.orientation)
                            return mid.y + offset.y
                        }
                    }
                    const s = nodeMap.get(d.sourceNodeId)
                    const t = nodeMap.get(d.targetNodeId)
                    if (!s || !t) return 0
                    return (s.y + t.y) / 2 - 8
                })
                .text((d: Connection) => {
                    const gi = getConnectionGroupInfo(d.id, connections)
                    if (!gi.isMultiple) return ''
                    if (designerMode === 'architecture') return `${gi.total} connections`
                    return `Endpoint ${gi.index + 1}`
                })
        } catch (e) {
            console.error('Connection rendering error:', e)
        }
    }, [
        svgRef,
        connections,
        getConnectionPath,
        getConnectionMarker,
        designerMode,
        nodeMap,
        onConnectionClick,
        createFilledPolygonFromPath,
    ])
}
