import * as d3 from 'd3'
import type { Selection } from 'd3'
import type { CallbackPriority, NodeZIndexState } from './canvas-constants'

export type CachedSelectionType = 'svg' | 'nodeLayer' | 'connectionLayer' | 'gridLayer'

type SvgSel = Selection<SVGSVGElement, unknown, null, undefined>
type LayerSel = Selection<SVGGElement, unknown, null, undefined>

export interface D3SelectionCache {
    getCachedSelection: (type: CachedSelectionType) => SvgSel | LayerSel | null
    clear: () => void
}

export function createD3SelectionCache(getSvg: () => SVGSVGElement | null): D3SelectionCache {
    let cache: {
        svg?: Selection<SVGSVGElement, unknown, null, undefined> | null
        nodeLayer?: Selection<SVGGElement, unknown, null, undefined> | null
        connectionLayer?: Selection<SVGGElement, unknown, null, undefined> | null
        gridLayer?: Selection<SVGGElement, unknown, null, undefined> | null
        lastUpdate?: number
    } = {}

    const getCachedSelection = (type: CachedSelectionType): SvgSel | LayerSel | null => {
        const svgEl = getSvg()
        if (!svgEl) {
            return null
        }

        const now = performance.now()
        const cacheAge = now - (cache.lastUpdate || 0)
        const sel = cache[type]
        if (cacheAge > 1000 || !sel || sel.empty()) {
            const svg = d3.select(svgEl)
            cache.svg = svg
            cache.nodeLayer = svg.select('.node-layer')
            cache.connectionLayer = svg.select('.connection-layer')
            cache.gridLayer = svg.select('.grid-layer')
            cache.lastUpdate = now
        }
        return (cache[type] as SvgSel | LayerSel) || null
    }

    const clear = () => {
        cache = {}
    }

    return { getCachedSelection, clear }
}

export interface RafScheduler {
    scheduleRAF: (callback: () => void, priority?: CallbackPriority) => void
    clear: () => void
}

export function createRafScheduler(): RafScheduler {
    let rafId: number | null = null
    let rafScheduled = false
    let queue: Array<{ callback: () => void; priority: CallbackPriority }> = []

    const processRAFQueue = () => {
        if (queue.length === 0) {
            rafScheduled = false
            rafId = null
            return
        }
        // high > normal > low
        const rank: Record<CallbackPriority, number> = { high: 0, normal: 1, low: 2 }
        const current = [...queue].sort((a, b) => rank[a.priority] - rank[b.priority])
        queue = []
        for (const item of current) {
            try {
                item.callback()
            } catch {
                // swallow to avoid breaking the frame
            }
        }
        if (queue.length > 0) {
            rafId = requestAnimationFrame(processRAFQueue)
        } else {
            rafScheduled = false
            rafId = null
        }
    }

    const scheduleRAF = (callback: () => void, priority: CallbackPriority = 'normal') => {
        queue.push({ callback, priority })
        if (!rafScheduled) {
            rafScheduled = true
            rafId = requestAnimationFrame(processRAFQueue)
        }
    }

    const clear = () => {
        queue = []
        if (rafId) {
            cancelAnimationFrame(rafId)
            rafId = null
        }
        rafScheduled = false
    }

    return { scheduleRAF, clear }
}

export interface ZIndexManagerDeps {
    getNodeLayer: () => SVGGElement | null
    getAllNodeElements: () => Map<string, SVGGElement>
    isNodeSelected: (nodeId: string) => boolean
    isDragging: () => boolean
    getDraggedNodeId: () => string | null | undefined
    scheduleRAF: (cb: () => void, priority?: CallbackPriority) => void
}

export interface ZIndexManager {
    organizeNodeZIndex: () => void
    organizeNodeZIndexImmediate: () => void
    setNodeAsDragging: (nodeId: string) => void
    clearState: () => void
}

export function createZIndexManager(deps: ZIndexManagerDeps): ZIndexManager {
    let lastZIndexState = new Map<string, NodeZIndexState>()

    const executeUpdate = () => {
        const nodeLayer = deps.getNodeLayer()
        if (!nodeLayer) {
            return
        }
        const all = deps.getAllNodeElements()
        if (all.size === 0) {
            return
        }

        const normal: SVGGElement[] = []
        const selected: SVGGElement[] = []
        const dragging: SVGGElement[] = []
        const currentState = new Map<string, NodeZIndexState>()
        let hasChanges = false

        all.forEach((el, nodeId) => {
            if (!nodeLayer.contains(el)) {
                return
            }
            const isDraggingNode = deps.isDragging() && deps.getDraggedNodeId() === nodeId
            const isSelected = deps.isNodeSelected(nodeId)
            let state: NodeZIndexState
            if (isDraggingNode) {
                dragging.push(el)
                state = 'dragging'
            } else if (isSelected) {
                selected.push(el)
                state = 'selected'
            } else {
                normal.push(el)
                state = 'normal'
            }
            currentState.set(nodeId, state)
            if (lastZIndexState.get(nodeId) !== state) {
                hasChanges = true
            }
        })

        if (hasChanges || lastZIndexState.size !== currentState.size) {
            const ordered = [...normal, ...selected, ...dragging]
            const frag = document.createDocumentFragment()
            ordered.forEach((el) => frag.appendChild(el))
            nodeLayer.appendChild(frag)
            lastZIndexState = currentState
        }
    }

    const organizeNodeZIndex = () => {
        deps.scheduleRAF(executeUpdate, 'high')
    }

    const organizeNodeZIndexImmediate = () => {
        executeUpdate()
    }

    const setNodeAsDragging = (nodeId: string) => {
        lastZIndexState.set(nodeId, 'dragging')
        organizeNodeZIndexImmediate()
    }

    const clearState = () => {
        lastZIndexState.clear()
    }

    return { organizeNodeZIndex, organizeNodeZIndexImmediate, setNodeAsDragging, clearState }
}
