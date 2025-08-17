import { useEffect } from 'react'
import * as d3 from 'd3'
import { useCleanupRegistry } from './useCleanupRegistry'

interface Params {
    svgRef: React.RefObject<SVGSVGElement>
    onCanvasClick: () => void
    onCanvasMouseMove: (x: number, y: number) => void
}

/**
 * Binds root SVG events with proper namespacing and guaranteed cleanup.
 * Prevents stale closures by re-binding only when handlers change.
 */
export function useCanvasEvents({ svgRef, onCanvasClick, onCanvasMouseMove }: Params) {
    const { addDisposer } = useCleanupRegistry()

    useEffect(() => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        // Bind namespaced handlers
        svg.on('click.canvas', () => onCanvasClick())
        svg.on('mousemove.canvas', (event: MouseEvent) => {
            const node = svg.node()
            if (!node) return
            const [x, y] = d3.pointer(event, node)
            const transform = d3.zoomTransform(node)
            const [canvasX, canvasY] = transform.invert([x, y])
            onCanvasMouseMove(canvasX, canvasY)
        })

        const dispose = () => {
            svg.on('click.canvas', null).on('mousemove.canvas', null)
        }
        addDisposer(dispose)
        return dispose
    }, [svgRef, onCanvasClick, onCanvasMouseMove, addDisposer])
}
