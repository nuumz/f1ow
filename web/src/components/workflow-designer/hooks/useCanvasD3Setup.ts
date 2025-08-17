import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'

export interface CanvasLayers {
    root: SVGGElement | null
    grid: SVGGElement | null
    nodes: SVGGElement | null
    connections: SVGGElement | null
}

interface Params {
    svgRef: React.RefObject<SVGSVGElement>
    canvasTransform: { x: number; y: number; k: number }
    onRegisterZoomBehavior?: (zoom: d3.ZoomBehavior<SVGSVGElement, unknown>) => void
    onTransformChange?: (transform: d3.ZoomTransform) => void
    onZoomLevelChange?: (k: number) => void
    isConnecting: boolean
    connectionStart: { nodeId: string; portId: string; type: 'input' | 'output' } | null
    onPortDrag: (x: number, y: number) => void
    currentTransformRef: React.MutableRefObject<d3.ZoomTransform | { x: number; y: number; k: number }>
}

/**
 * Create/select base SVG groups and bind zoom once; set initial transform.
 * Returns layer elements for downstream rendering hooks.
 */
export function useCanvasD3Setup(params: Params) {
    const { svgRef, canvasTransform, onRegisterZoomBehavior, onTransformChange, onZoomLevelChange, isConnecting, connectionStart, onPortDrag, currentTransformRef } = params

    const layersRef = useRef<CanvasLayers>({ root: null, grid: null, nodes: null, connections: null })

    useEffect(() => {
        const svgEl = svgRef.current
        if (!svgEl) return

        const svg = d3.select(svgEl)

        // Ensure root group exists
        let root = svg.select<SVGGElement>('g.canvas-root')
        if (root.empty()) {
            root = svg.append('g').attr('class', 'canvas-root')
        }

        // Ensure child layers exist
        let grid = root.select<SVGGElement>('g.grid-layer')
        if (grid.empty()) {
            grid = root.append('g').attr('class', 'grid-layer').style('pointer-events', 'none')
        }
        let nodes = root.select<SVGGElement>('g.node-layer')
        if (nodes.empty()) {
            nodes = root.append('g').attr('class', 'node-layer')
        }
        let connections = root.select<SVGGElement>('g.connection-layer')
        if (connections.empty()) {
            connections = root.append('g').attr('class', 'connection-layer')
        }

        layersRef.current = {
            root: root.node(),
            grid: grid.node(),
            nodes: nodes.node(),
            connections: connections.node(),
        }

        // Zoom behavior (bind once)
        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.4, 4])
            .on('zoom', (event) => {
                const transform = event.transform
                const prev = currentTransformRef.current as d3.ZoomTransform | { x: number; y: number; k: number }
                const prevK = prev.k

                // Update root transform (fresh selection avoids stale references)
                const rootNow = d3.select(svgEl).select<SVGGElement>('g.canvas-root')
                if (!rootNow.empty()) {
                    rootNow.attr('transform', transform.toString())
                }

                if (onZoomLevelChange && prevK !== transform.k) {
                    onZoomLevelChange(transform.k)
                }

                // Only notify when transform actually changed (prevents update-depth loops)
                const dx = Math.abs((prev.x ?? 0) - transform.x)
                const dy = Math.abs((prev.y ?? 0) - transform.y)
                const dk = Math.abs(prev.k - transform.k)
                const changed = dx > 0.1 || dy > 0.1 || dk > 1e-6
                if (changed) {
                    onTransformChange?.(transform)
                }

                // Keep preview endpoint pinned during pan/zoom
                if (isConnecting && connectionStart && svgEl) {
                    const srcEvt: Event | undefined = (event as unknown as { sourceEvent?: Event }).sourceEvent
                    if (srcEvt) {
                        const nativeEvt = srcEvt as MouseEvent
                        const [screenX, screenY] = d3.pointer(nativeEvt, svgEl)
                        const [canvasX, canvasY] = transform.invert([screenX, screenY])
                        onPortDrag(canvasX, canvasY)
                    }
                }

                // Update ref after consumers used previous value
                currentTransformRef.current = transform
            })

        if (svg.attr('data-zoom-init') !== 'true') {
            svg.call(zoom)
            svg.attr('data-zoom-init', 'true')
            onRegisterZoomBehavior?.(zoom)
        }

        // Set/Sync transform only if different from current to avoid re-entrant zoom events
        const current = d3.zoomTransform(svgEl)
        const target = d3.zoomIdentity.translate(canvasTransform.x, canvasTransform.y).scale(canvasTransform.k)
        const same =
            Math.abs(current.k - target.k) < 1e-6 &&
            Math.abs(current.x - target.x) < 0.1 &&
            Math.abs(current.y - target.y) < 0.1
        if (!same) {
            svg.call(zoom.transform, target)
        }
    }, [svgRef, canvasTransform.x, canvasTransform.y, canvasTransform.k, onRegisterZoomBehavior, onTransformChange, onZoomLevelChange, isConnecting, connectionStart, onPortDrag, currentTransformRef])

    return useMemo(() => layersRef.current, [])
}
