/*
  Unified Grid System: Combines pattern creation and performance monitoring
  Creates base dot grid (id: workflow-grid) + major overlay (id: workflow-grid-major)
  with intelligent scaling and caching for optimal performance.
*/
import * as d3 from 'd3'

export interface DualPatternOptions {
    baseColor?: string
    majorColor?: string
    baseOpacity?: number
    majorOpacity?: number
    majorStep?: number
}

// Consolidated dot calculation (replaces GridOptimizer.calculateDotProperties)
function calculateOptimalDotProperties(zoomLevel: number): {
    radius: number
    opacity: number
} {
    const zoomFactor = Math.max(0.3, Math.min(2.0, zoomLevel))
    const radius = Math.max(0.5, Math.min(3.0, zoomFactor * 1.1))
    const opacity = Math.max(0.2, Math.min(0.9, Math.pow(zoomFactor, 0.7) * 0.8))
    return { radius, opacity }
}

// Consolidated grid visibility check (replaces GridOptimizer.shouldShowGrid)
function shouldShowGrid(zoomLevel: number): boolean {
    return zoomLevel >= 0.2 // Don't show grid when zoomed out too far
}

// Consolidated padding calculation (replaces GridOptimizer.calculateIntelligentPadding)
function calculateIntelligentPadding(zoomLevel: number, basePadding: number = 400): number {
    return Math.max(200, Math.min(1000, basePadding / zoomLevel))
}

// Export consolidated functions for WorkflowCanvas to use
export const GridUtils = {
    shouldShowGrid,
    calculateIntelligentPadding,
}

export function ensureDualGridPatterns(
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    transformK: number,
    baseSize: number,
    opts?: DualPatternOptions
) {
    const patternId = 'workflow-grid'
    const majorPatternId = 'workflow-grid-major'

    const options: Required<DualPatternOptions> = {
        baseColor: opts?.baseColor ?? '#c7c8ca',
        majorColor: opts?.majorColor ?? '#c7c8ca',
        baseOpacity: opts?.baseOpacity ?? 0.8,
        majorOpacity: opts?.majorOpacity ?? 0.9,
        majorStep: opts?.majorStep ?? 5,
    }

    // Consolidated dot properties calculation
    const { radius: dotRadius } = calculateOptimalDotProperties(transformK)
    const baseRadius = Math.max(0.1, dotRadius / Math.max(0.0001, transformK))
    const majorRadius = Math.max(0.1, (dotRadius * 1.5) / Math.max(0.0001, transformK))    // Base pattern
    let basePat = defs.select<SVGPatternElement>(`#${patternId}`)
    if (basePat.empty()) {
        basePat = defs
            .append<SVGPatternElement>('pattern')
            .attr('id', patternId)
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', baseSize)
            .attr('height', baseSize)
    }
    basePat.attr('width', baseSize).attr('height', baseSize)
    let baseCircle = basePat.select<SVGCircleElement>('circle.base-dot')
    if (baseCircle.empty()) {
        baseCircle = basePat.append<SVGCircleElement>('circle').attr('class', 'base-dot')
    }
    baseCircle
        .attr('cx', baseSize / 2)
        .attr('cy', baseSize / 2)
        .attr('r', baseRadius)
        .attr('fill', options.baseColor)
        .attr('opacity', options.baseOpacity)

    // Major pattern
    const majorSize = baseSize * options.majorStep
    let majorPat = defs.select<SVGPatternElement>(`#${majorPatternId}`)
    if (majorPat.empty()) {
        majorPat = defs
            .append<SVGPatternElement>('pattern')
            .attr('id', majorPatternId)
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', majorSize)
            .attr('height', majorSize)
    }
    majorPat.attr('width', majorSize).attr('height', majorSize)
    let majorCircle = majorPat.select<SVGCircleElement>('circle.major-dot')
    if (majorCircle.empty()) {
        majorCircle = majorPat.append<SVGCircleElement>('circle').attr('class', 'major-dot')
    }
    majorCircle
        .attr('cx', majorSize / 2)
        .attr('cy', majorSize / 2)
        .attr('r', majorRadius)
        .attr('fill', options.majorColor)
        .attr('opacity', options.majorOpacity)

    return { patternId, majorPatternId }
}

export function renderDualGridRects(
    gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    bounds: { minX: number; minY: number; width: number; height: number },
    patternId: string,
    majorPatternId: string
) {
    gridLayer
        .append('rect')
        .attr('class', 'grid-pattern-rect base')
        .attr('x', bounds.minX)
        .attr('y', bounds.minY)
        .attr('width', bounds.width)
        .attr('height', bounds.height)
        .attr('fill', `url(#${patternId})`)
        .style('pointer-events', 'none')
        .style('will-change', 'transform')

    gridLayer
        .append('rect')
        .attr('class', 'grid-pattern-rect major')
        .attr('x', bounds.minX)
        .attr('y', bounds.minY)
        .attr('width', bounds.width)
        .attr('height', bounds.height)
        .attr('fill', `url(#${majorPatternId})`)
        .style('pointer-events', 'none')
        .style('will-change', 'transform')
}
