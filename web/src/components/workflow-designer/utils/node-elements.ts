import * as d3 from 'd3'
import type { WorkflowNode, NodePort } from '../types'

// Dev-only: track last known state per node layer to detect external clears between renders
const __nodeLayerStateDev = new WeakMap<SVGGElement, { lastKeys?: string[]; lastCount: number }>()

/**
 * Lightweight helpers to avoid redundant DOM churn by only applying changes
 * when values actually differ.
 */
export function setAttrIfChanged<E extends d3.BaseType, D = unknown>(
    selection: d3.Selection<E, D, d3.BaseType, unknown>,
    name: string,
    value: string | number | null | undefined | ((d: D, i: number, el: E) => string | number | null | undefined)
) {
    selection.each(function (this: E, d: D, i: number) {
        const el = this as unknown as Element
        const valueFn = typeof value === 'function' ? (value as (d: D, i: number, el: E) => string | number | null | undefined) : null
        const nextVal = valueFn ? valueFn(d, i, this) : value
        const nextStr = nextVal === null || nextVal === undefined ? null : String(nextVal)
        const curr = el.getAttribute(name)
        if (curr !== nextStr) {
            if (nextStr === null) { el.removeAttribute(name) } else { el.setAttribute(name, nextStr) }
        }
    })
}

export function setStyleIfChanged<E extends d3.BaseType, D = unknown>(
    selection: d3.Selection<E, D, d3.BaseType, unknown>,
    name: string,
    value: string | number | null | undefined | ((d: D, i: number, el: E) => string | number | null | undefined)
) {
    selection.each(function (this: E, d: D, i: number) {
        const el = this as unknown as HTMLElement
        const valueFn = typeof value === 'function' ? (value as (d: D, i: number, el: E) => string | number | null | undefined) : null
        const nextVal = valueFn ? valueFn(d, i, this) : value
        const nextStr = nextVal === null || nextVal === undefined ? '' : String(nextVal)
        const curr = el.style.getPropertyValue(name)
        if (curr !== nextStr) {
            el.style.setProperty(name, nextStr)
        }
    })
}

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
    /** Optional per-node update hook called for merged selections. */
    onUpdateEach?: (d: Datum, element: SVGGElement) => void
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
        onUpdateEach,
    } = options

    let usedIndexFallback = false
    const safeGetId = (d: Datum, i: number): string => {
        if (getId) { return getId(d) }
        const rec = d as unknown as Record<string, unknown>
        const idVal = rec?.['id']
        if (typeof idVal === 'string' && idVal.length > 0) { return idVal }
        usedIndexFallback = true
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

    // Dev-only detection for duplicate/unstable keys, which cause full re-creates
    const keys = data.map((d, i) => (key ? key(d) : safeGetId(d, i)))
    if (process.env.NODE_ENV !== 'production') {
        const set = new Set<string>()
        let hasDup = false
        for (const k of keys) {
            if (set.has(k)) { hasDup = true; break }
            set.add(k)
        }
        if (hasDup) {
            console.warn('[createNodeGroups] Duplicate keys detected. Nodes may be removed/recreated unexpectedly. Provide a unique key/getId.')
        }
        if (usedIndexFallback) {
            console.warn('[createNodeGroups] Missing d.id (string). Falling back to index key — nodes will be recreated when order changes. Pass getId or ensure d.id.')
        }

        // Detect if the layer has been cleared externally between renders (common root cause)
        const layerEl = layer.node() as SVGGElement | null
        if (layerEl) {
            const existingCount = layer.selectAll<SVGGElement, unknown>('.node').size()
            const prevState = __nodeLayerStateDev.get(layerEl)
            if (prevState && prevState.lastCount > 0 && existingCount === 0 && data.length > 0) {
                console.warn('[createNodeGroups] Detected node-layer cleared between renders. Ensure the layer is stable and not re-created/emptied by other code.')
            }
            // Track state
            __nodeLayerStateDev.set(layerEl, { lastKeys: keys, lastCount: existingCount })
        }
    }

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

    // Update attributes/styles only when changed to avoid redundant layout work
    setAttrIfChanged<SVGGElement, Datum>(nodeGroups, 'transform', (d: Datum) => safeGetTransform(d))
    setAttrIfChanged<SVGGElement, Datum>(nodeGroups, 'data-node-id', (d: Datum, i: number) => safeGetId(d, i))
    setStyleIfChanged<SVGGElement, Datum>(nodeGroups, 'cursor', cursor)

    if (onUpdateEach) {
        nodeGroups.each(function (this: SVGGElement, d: Datum) {
            onUpdateEach(d, this)
        })
    }

    return { nodeSelection, nodeEnter, nodeGroups }
}

/**
 * Update only the attributes of the existing architecture-outline rect within nodes.
 * This never creates new rects; it mutates the current one in-place and only
 * applies diffs where values actually changed.
 */
export type ArchOutlineAttrs = Partial<{
    x: number
    y: number
    width: number
    height: number
    rx: number
    ry: number
    stroke: string
    strokeWidth: number
    strokeDasharray: string
    opacity: number
}>

export function updateArchOutlineAttributes<D = unknown>(
    nodeGroups: d3.Selection<SVGGElement, D, SVGGElement, unknown>,
    attrs: ArchOutlineAttrs | ((d: D, i: number, el: SVGGElement) => ArchOutlineAttrs)
) {
    nodeGroups.each(function (this: SVGGElement, d: D, i: number) {
        const g = d3.select<SVGGElement, D>(this)
        const rect = g.select<SVGRectElement>('rect.node-arch-outline')
        if (rect.empty()) { return }
        const a = typeof attrs === 'function' ? (attrs as (d: D, i: number, el: SVGGElement) => ArchOutlineAttrs)(d, i, this) : attrs
        if (a.x !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'x', String(a.x)) }
        if (a.y !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'y', String(a.y)) }
        if (a.width !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'width', String(a.width)) }
        if (a.height !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'height', String(a.height)) }
        if (a.rx !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'rx', String(a.rx)) }
        if (a.ry !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'ry', String(a.ry)) }
        if (a.stroke !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'stroke', a.stroke) }
        if (a.strokeWidth !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'stroke-width', String(a.strokeWidth)) }
        if (a.strokeDasharray !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'stroke-dasharray', a.strokeDasharray) }
        if (a.opacity !== undefined) { setAttrIfChanged<SVGRectElement, D>(rect, 'opacity', String(a.opacity)) }
    })
}
