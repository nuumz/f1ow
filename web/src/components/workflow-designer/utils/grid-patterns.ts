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
    majorType?: 'dot' | 'plus' // Type of major pattern: plus or dot
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
        majorColor: opts?.majorColor ?? '#d0d1d3',
        baseOpacity: opts?.baseOpacity ?? 0.5,
        majorOpacity: opts?.majorOpacity ?? 0.5,
        majorStep: opts?.majorStep ?? 5,
        majorType: opts?.majorType ?? 'dot', // Default to plus
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

    // Major pattern - only plus without base dots
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

    // Clear any existing content
    majorPat.selectAll('*').remove()

    // Add background mask to hide base dots where plus will be
    const centerX = majorSize / 2
    const centerY = majorSize / 2

    // Create major pattern based on majorType
    if (options.majorType === 'plus') {
        // Create plus shape
        const plusSize = majorRadius * 1.5
        const strokeWidth = majorRadius * 0.5

        // Create plus path (horizontal + vertical lines)
        const plusPath = [
            `M ${centerX - plusSize} ${centerY}`,  // Move to left
            `L ${centerX + plusSize} ${centerY}`,  // Horizontal line
            `M ${centerX} ${centerY - plusSize}`,  // Move to top
            `L ${centerX} ${centerY + plusSize}`   // Vertical line
        ].join(' ')

        majorPat
            .append('path')
            .attr('class', 'major-plus')
            .attr('d', plusPath)
            .attr('stroke', options.majorColor)
            .attr('stroke-width', strokeWidth)
            .attr('stroke-linecap', 'round')
            .attr('fill', 'none')
            .attr('opacity', options.majorOpacity)
    } else {
        // Add major dot on top
        majorPat
            .append('circle')
            .attr('class', 'major-dot')
            .attr('cx', centerX)
            .attr('cy', centerY)
            .attr('r', majorRadius)
            .attr('fill', options.majorColor)
            .attr('opacity', options.majorOpacity)
    }

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
