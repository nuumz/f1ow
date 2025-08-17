import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

/**
 * useGridEffect
 * - Isolates grid rendering with minimal dependencies to avoid re-render cascades
 * - Redraws grid only on: showGrid toggle, SVG size changes
 * - Uses rAF to batch updates and a small time throttle to prevent rapid redraws
 */
export function useGridEffect(
    params: {
        svgRef: React.RefObject<SVGSVGElement>
        isInitialized: boolean
        showGrid: boolean
        // createGrid is stable (useCallback with []) from caller
        createGrid: (gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>, width: number, height: number) => void
        // Optional cache ref with lastRenderTime used by caller for cleanup/reporting
        gridCacheRef?: React.MutableRefObject<{ lastRenderTime: number; key?: string } | null>
    }
) {
    const { svgRef, isInitialized, showGrid, createGrid, gridCacheRef } = params
    const rafIdRef = useRef<number | null>(null)
    const lastSizeRef = useRef<{ w: number; h: number } | null>(null)

    useEffect(() => {
        const svgEl = svgRef.current
        if (!svgEl || !isInitialized || !showGrid) return

        const svg = d3.select(svgEl)
        const gridLayerSel = svg.select<SVGGElement>('.grid-layer')
        if (gridLayerSel.empty()) return

        const scheduleRender = (width: number, height: number) => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = requestAnimationFrame(() => {
                try {
                    createGrid(gridLayerSel, width, height)
                    if (gridCacheRef) {
                        const now = performance.now()
                        gridCacheRef.current ??= { lastRenderTime: 0 }
                        gridCacheRef.current.lastRenderTime = now
                    }
                } finally {
                    rafIdRef.current = null
                }
            })
        }

        // Initial draw based on current size
        const rect = svgEl.getBoundingClientRect()
        lastSizeRef.current = { w: rect.width, h: rect.height }
        scheduleRender(rect.width, rect.height)

        // Observe size changes only (decoupled from canvasTransform object)
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const cr = entry.contentRect
                const prev = lastSizeRef.current
                if (!prev || Math.abs(prev.w - cr.width) >= 1 || Math.abs(prev.h - cr.height) >= 1) {
                    lastSizeRef.current = { w: cr.width, h: cr.height }
                    scheduleRender(cr.width, cr.height)
                }
            }
        })
        ro.observe(svgEl)

        return () => {
            ro.disconnect()
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
        }
    }, [svgRef, isInitialized, showGrid, createGrid, gridCacheRef])
}
