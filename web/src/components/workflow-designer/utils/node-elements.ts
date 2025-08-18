import * as d3 from 'd3'

/**
 * Core function to generate the base DOM structure for a node.
 * Appends the standard children and baseline styles, leaving data-driven
 * updates and event bindings to the caller.
 */
export function createNodeElements<Datum = unknown, PElement extends d3.BaseType = SVGGElement, PDatum = unknown, PNode extends d3.BaseType = HTMLElement>(
    nodeEnter: d3.Selection<PElement, Datum, PNode, PDatum>
) {
    // Node background (shape-aware path)
    nodeEnter
        .append('path')
        .attr('class', 'node-background')

    // Architecture-mode dashed outline (hover/focus ring style)
    nodeEnter
        .append('rect')
        .attr('class', 'node-arch-outline')
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'geometricPrecision')
        .style('pointer-events', 'none')
        .style('fill', 'none')
        .style('stroke', '#3b82f6')
        .style('stroke-width', 2 as unknown as string)
        .style('stroke-dasharray', '6,6')
        .style('opacity', 0.8)

    // Text icon (workflow mode)
    nodeEnter
        .append('text')
        .attr('class', 'node-icon')
        .style('pointer-events', 'none')

    // SVG icon container (architecture mode)
    nodeEnter
        .append('g')
        .attr('class', 'node-icon-svg')
        .style('pointer-events', 'none')
        // Keep stroke-width in balance with our icon rendering
        .style('stroke-width', 1.8 as unknown as string)

    // Primary label
    nodeEnter
        .append('text')
        .attr('class', 'node-label')
        .style('pointer-events', 'none')

    // Architecture-mode sublabel (smaller text under main label)
    nodeEnter
        .append('text')
        .attr('class', 'node-sublabel')
        .style('pointer-events', 'none')
        .style('opacity', 0.8)
}

export type CreateNodeGroupsOptions<Datum> = {
    key?: (d: Datum) => string
    getId?: (d: Datum) => string
    getTransform?: (d: Datum) => string
    cursor?: string
    onExit?: (d: Datum, element: SVGGElement) => void
    onEnterEach?: (d: Datum, element: SVGGElement) => void
    dragBehavior?: d3.DragBehavior<SVGGElement, Datum, unknown>
}

/**
 * Core function to create/merge node groups with standard attributes and optional behaviors.
 * Returns the selection triple for further updates.
 */
export function createNodeGroups<Datum>(
    layer: d3.Selection<SVGGElement, unknown, SVGGElement, unknown>,
    data: ReadonlyArray<Datum>,
    options: CreateNodeGroupsOptions<Datum> = {}
) {
    const {
        key,
        getId,
        getTransform,
        cursor = 'move',
        onExit,
        onEnterEach,
        dragBehavior,
    } = options

    const safeGetId = (d: Datum, i: number): string => {
        if (getId) return getId(d)
        const rec = d as unknown as Record<string, unknown>
        const idVal = rec && (rec['id'] as unknown)
        if (typeof idVal === 'string') return idVal
        return String(i)
    }

    const safeGetTransform = (d: Datum): string => {
        if (getTransform) return getTransform(d)
        const rec = d as unknown as Record<string, unknown>
        const x = typeof rec['x'] === 'number' ? (rec['x'] as number) : 0
        const y = typeof rec['y'] === 'number' ? (rec['y'] as number) : 0
        return `translate(${x}, ${y})`
    }

    const keyAccessor = (d: Datum, i: number): string => (key ? key(d) : safeGetId(d, i))

    const nodeSelection: d3.Selection<SVGGElement, Datum, SVGGElement, unknown> = layer
        .selectAll<SVGGElement, Datum>('.node')
        .data(data, keyAccessor as (d: Datum, i: number) => string)

    nodeSelection
        .exit()
        .each(function (this: SVGGElement, d: unknown) {
            if (onExit) onExit(d as Datum, this)
        })
        .remove()

    const nodeEnter = nodeSelection
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('data-node-id', (d: Datum, i: number) => safeGetId(d, i))
        .attr('transform', (d: Datum) => safeGetTransform(d))
        .style('cursor', cursor)
        .each(function (this: SVGGElement, d: Datum) {
            if (onEnterEach) onEnterEach(d, this)
        })

    if (dragBehavior) {
        nodeEnter.call(dragBehavior)
    }

    const nodeGroups = nodeEnter.merge(nodeSelection as d3.Selection<SVGGElement, Datum, SVGGElement, unknown>)

    return { nodeSelection, nodeEnter, nodeGroups }
}
