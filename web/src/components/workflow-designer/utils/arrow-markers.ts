import * as d3 from 'd3'

function createArrowMarker(
    defs: d3.Selection<SVGDefsElement, unknown, d3.BaseType, unknown>,
    id: string,
    color: string,
    size = 10,
    direction: 'left' | 'right' = 'right'
) {
    const marker = defs
        .append('marker')
        .attr('id', id)
        .attr('markerWidth', size)
        .attr('markerHeight', size)
        .attr('viewBox', `0 0 ${size} ${size}`)
        .attr('orient', 'auto')
        .attr('markerUnits', 'userSpaceOnUse')

    // Pad so the arrow tip stays BEFORE the path end to avoid overlapping into nodes
    // For architecture markers: anchor the CENTER of the triangle at the path end.
    // We'll trim the path by half the marker size in path-utils so the tip touches the node edge.
    const isArchitectureMarker = id.includes('architecture')
    const pad = isArchitectureMarker ? 0 : -4

    if (direction === 'right') {
        // Right-pointing arrow (tip at x=size).
        // Architecture: refX=size/2 (center anchored). Workflow/others: size+pad (tip anchored with small backoff).
        marker
            .attr('refX', isArchitectureMarker ? size / 2 : size + pad)
            .attr('refY', size / 2)
            .append('polygon')
            .attr('points', `0,0 ${size},${size / 2} 0,${size}`)
            .attr('fill', color)
            .attr('stroke', 'none')
    } else {
        // Left-pointing arrow (tip at x=0).
        // Architecture: refX=size/2 (center anchored). Workflow/others: -pad (tip anchored with small backoff).
        marker
            .attr('refX', isArchitectureMarker ? size / 2 : -pad)
            .attr('refY', size / 2)
            .append('polygon')
            .attr('points', `${size},0 0,${size / 2} ${size},${size}`)
            .attr('fill', color)
            .attr('stroke', 'none')
    }
}

export function ensureArrowMarkers(
    defs: d3.Selection<SVGDefsElement, unknown, d3.BaseType, unknown>
) {
    const initialized = !defs.select('#arrowhead').empty()
    if (initialized) return

    createArrowMarker(defs, 'arrowhead', '#666')
    createArrowMarker(defs, 'arrowhead-selected', '#2196F3')
    createArrowMarker(defs, 'arrowhead-hover', '#1976D2', 12)
    createArrowMarker(defs, 'arrowhead-left', '#666', 10, 'left')
    createArrowMarker(defs, 'arrowhead-left-selected', '#2196F3', 10, 'left')
    createArrowMarker(defs, 'arrowhead-left-hover', '#1976D2', 12, 'left')

    // Mode-specific arrow markers for workflow mode
    createArrowMarker(defs, 'arrowhead-workflow', '#2563eb', 14)
    createArrowMarker(defs, 'arrowhead-workflow-selected', '#059669', 16)
    createArrowMarker(defs, 'arrowhead-workflow-hover', '#1d4ed8', 16)

    // Mode-specific arrow markers for architecture mode
    createArrowMarker(defs, 'arrowhead-architecture', '#7c3aed', 10)
    createArrowMarker(defs, 'arrowhead-architecture-selected', '#dc2626', 12)
    createArrowMarker(defs, 'arrowhead-architecture-hover', '#6d28d9', 12)
}
