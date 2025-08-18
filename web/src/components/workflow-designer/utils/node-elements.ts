import * as d3 from 'd3'

/**
 * Core function to generate the base DOM structure for a node.
 * Appends the standard children and baseline styles, leaving data-driven
 * updates and event bindings to the caller.
 */
export function createNodeElements<Datum = unknown, PElement extends d3.BaseType = SVGGElement, PDatum = unknown, PNode extends d3.BaseType = HTMLElement>(
    nodeEnter: d3.Selection<PElement, Datum, PNode, PDatum>,
    nodeGroups?: d3.Selection<SVGGElement, Datum, SVGGElement, unknown>
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

    // Persistent port containers (generated once per node)
    // Port groups will be created inside these containers during updates
    const ports = nodeEnter.append('g').attr('class', 'ports')
    ports.append('g').attr('class', 'input-ports')
    ports.append('g').attr('class', 'output-ports')
    ports.append('g').attr('class', 'side-ports')
    ports.append('g').attr('class', 'bottom-ports')

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

    // Ensure existing/merged nodes also have required containers (idempotent)
    if (nodeGroups) {
        ensureNodeElementContainers(nodeGroups as unknown as d3.Selection<SVGGElement, unknown, SVGGElement, unknown>)
    }
}

/**
 * Core function to ensure a node has all required child containers/elements.
 * Safe to call repeatedly; will only append missing elements.
 */
export function ensureNodeElementContainers(
    nodeGroups: d3.Selection<SVGGElement, unknown, SVGGElement, unknown>
) {
    type D3Sel = d3.Selection<d3.BaseType, unknown, d3.BaseType, unknown>

    const ensure = (
        sel: D3Sel,
        selector: string,
        create: (parent: D3Sel) => void
    ) => {
        const sub = sel.select(selector)
        if (sub.empty()) {
            create(sel)
        }
    }

    nodeGroups.each(function () {
        const g = d3.select(this as SVGGElement) as unknown as D3Sel

        // Background
        ensure(g, '.node-background', (p) => {
            p.append('path').attr('class', 'node-background')
        })

        // Architecture outline
        ensure(g, '.node-arch-outline', (p) => {
            p.append('rect')
                .attr('class', 'node-arch-outline')
                .attr('vector-effect', 'non-scaling-stroke')
                .attr('shape-rendering', 'geometricPrecision')
                .style('pointer-events', 'none')
                .style('fill', 'none')
                .style('stroke', '#3b82f6')
                .style('stroke-width', 2 as unknown as string)
                .style('stroke-dasharray', '6,6')
                .style('opacity', 0.8)
        })

        // Icons and labels
        ensure(g, '.node-icon', (p) => {
            p.append('text').attr('class', 'node-icon').style('pointer-events', 'none')
        })
        ensure(g, '.node-icon-svg', (p) => {
            p.append('g')
                .attr('class', 'node-icon-svg')
                .style('pointer-events', 'none')
                .style('stroke-width', 1.8 as unknown as string)
        })
        ensure(g, '.node-label', (p) => {
            p.append('text').attr('class', 'node-label').style('pointer-events', 'none')
        })
        ensure(g, '.node-sublabel', (p) => {
            p.append('text').attr('class', 'node-sublabel').style('pointer-events', 'none').style('opacity', 0.8)
        })

        // Ports containers
        ensure(g, 'g.ports', (p) => {
            const ports = p.append('g').attr('class', 'ports') as unknown as D3Sel
            ports.append('g').attr('class', 'input-ports')
            ports.append('g').attr('class', 'output-ports')
            ports.append('g').attr('class', 'side-ports')
            ports.append('g').attr('class', 'bottom-ports')
        })
        // If g.ports already exists, ensure sub-groups exist too
        const ports = (g.select('g.ports') as unknown) as D3Sel
        if (!ports.empty()) {
            ensure(ports, 'g.input-ports', (p) => { p.append('g').attr('class', 'input-ports') })
            ensure(ports, 'g.output-ports', (p) => { p.append('g').attr('class', 'output-ports') })
            ensure(ports, 'g.side-ports', (p) => { p.append('g').attr('class', 'side-ports') })
            ensure(ports, 'g.bottom-ports', (p) => { p.append('g').attr('class', 'bottom-ports') })
        }
    })
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
        if (getId) { return getId(d) }
        const rec = d as unknown as Record<string, unknown>
        const idVal = rec && (rec['id'] as unknown)
        if (typeof idVal === 'string') { return idVal }
        return String(i)
    }

    const safeGetTransform = (d: Datum): string => {
        if (getTransform) { return getTransform(d) }
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
            if (onExit) { onExit(d as Datum, this) }
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
            if (onEnterEach) { onEnterEach(d, this) }
        })

    if (dragBehavior) {
        nodeEnter.call(dragBehavior)
    }

    const nodeGroups = nodeEnter.merge(nodeSelection as d3.Selection<SVGGElement, Datum, SVGGElement, unknown>)

    return { nodeSelection, nodeEnter, nodeGroups }
}
