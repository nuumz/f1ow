import * as d3 from 'd3'
import type { WorkflowNode, NodePort } from '../types'

/**
 * Core function to generate the base DOM structure for a node.
 * Appends the standard children and baseline styles, leaving data-driven
 * updates and event bindings to the caller.
 */
export function createNodeElements<Datum extends Partial<WorkflowNode> = WorkflowNode, PElement extends d3.BaseType = SVGGElement, PDatum = unknown, PNode extends d3.BaseType = HTMLElement>(
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

    // Generate initial per-port groups based on node data (idempotent for enter selection)
    // These groups will be updated/positioned later by higher-level logic
    nodeEnter.each(function (d) {
        const nodeData = d as unknown as { id?: string; inputs?: Array<{ id: string }>; outputs?: Array<{ id: string }>; bottomPorts?: Array<{ id: string }> }
        const g = d3.select(this)

        // Input port groups
        const inputContainer = g.select<SVGGElement>('g.input-ports')
        if (!inputContainer.empty()) {
            const inputSel = inputContainer
                .selectAll<SVGGElement, NodePort>('g.input-port-group')
                .data((nodeData.inputs || []) as NodePort[], (p: NodePort) => p.id)

            inputSel.enter()
                .append('g')
                .attr('class', 'port-group input-port-group')
                .attr('data-port-id', (p: NodePort) => p.id)
                .attr('data-node-id', nodeData.id || '')
        }

        // Output port groups
        const outputContainer = g.select<SVGGElement>('g.output-ports')
        if (!outputContainer.empty()) {
            const outputSel = outputContainer
                .selectAll<SVGGElement, NodePort>('g.output-port-group')
                .data((nodeData.outputs || []) as NodePort[], (p: NodePort) => p.id)

            outputSel.enter()
                .append('g')
                .attr('class', 'port-group output-port-group')
                .attr('data-port-id', (p: NodePort) => p.id)
                .attr('data-node-id', nodeData.id || '')
        }

        // Bottom port groups (if any)
        const bottomContainer = g.select<SVGGElement>('g.bottom-ports')
        if (!bottomContainer.empty()) {
            const bottomSel = bottomContainer
                .selectAll<SVGGElement, NodePort>('g.bottom-port-group')
                .data((nodeData.bottomPorts || []) as NodePort[], (p: NodePort) => p.id)

            bottomSel.enter()
                .append('g')
                .attr('class', 'port-group bottom-port-group')
                .attr('data-port-id', (p: NodePort) => p.id)
                .attr('data-node-id', nodeData.id || '')
        }
    })

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
export function ensureNodeElementContainers<D>(
    nodeGroups: d3.Selection<SVGGElement, D, SVGGElement, unknown>
) {
    const ensure = <E extends d3.BaseType, P extends d3.BaseType | null, PD>(
        sel: d3.Selection<E, unknown, P, PD>,
        selector: string,
        create: (parent: d3.Selection<E, unknown, P, PD>) => void
    ) => {
        const sub = sel.select(selector)
        if (sub.empty()) {
            create(sel)
        }
    }

    nodeGroups.each(function (this: SVGGElement) {
        const g = d3.select<SVGGElement, unknown>(this)

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
            const ports = p.append('g').attr('class', 'ports')
            ports.append('g').attr('class', 'input-ports')
            ports.append('g').attr('class', 'output-ports')
            ports.append('g').attr('class', 'side-ports')
            ports.append('g').attr('class', 'bottom-ports')
        })
        // If g.ports already exists, ensure sub-groups exist too
        const ports = g.select('g.ports')
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
        const idVal = rec?.['id']
        if (typeof idVal === 'string') { return idVal }
        return String(i)
    }

    const safeGetTransform = (d: Datum): string => {
        if (getTransform) { return getTransform(d) }
        const rec = d as unknown as Record<string, unknown>
        const x = typeof rec['x'] === 'number' ? rec['x'] : 0
        const y = typeof rec['y'] === 'number' ? rec['y'] : 0
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

    const nodeGroups = nodeEnter.merge(nodeSelection)

    return { nodeSelection, nodeEnter, nodeGroups }
}
