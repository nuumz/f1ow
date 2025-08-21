/*
  Unified Grid System: Combines pattern creation and performance monitoring
  Creates base dot grid (id: workflow-grid) + major overlay (id: workflow-grid-major)
  with intelligent scaling and caching for optimal performance.
*/
import * as d3 from 'd3'
import type React from 'react'

export interface GridCacheRef {
    transform: string
    pattern: string
    lastRenderTime: number
    viewport: { width: number; height: number }
    bounds: {
        minX: number
        minY: number
        maxX: number
        maxY: number
        width: number
        height: number
    }
}

// Type definitions for dependencies
export interface GridConstants {
    BASE_GRID_SIZE: number
    PERFORMANCE_LOG_INTERVAL: number
    PERFORMANCE_WARNING_INTERVAL: number
}

export interface GridPerformanceMonitor {
    recordRender(renderTime: number): void
    getMetrics(): {
        renderCount: number
        avgRenderTime: number
        cacheHitRate: number
    }
    getPerformanceReport(): {
        status: 'good' | 'warning' | 'poor' | 'excellent'
        summary: string
    }
    // Optional cache APIs (provided by performance-monitor singleton used by WorkflowCanvas)
    recordCacheHit?(): void
    recordCacheMiss?(): void
    isCacheExpired?(cache: { lastRenderTime: number; transform: { x: number; y: number; k: number }; viewport: { width: number; height: number } } | null): boolean
    generateCacheKey?(
        transform: { x: number; y: number; k: number },
        viewport: { width: number; height: number },
        tolerance?: { position: number; zoom: number; viewport: number }
    ): string
    validateCacheConsistency?(
        cache: { lastRenderTime: number; transform: { x: number; y: number; k: number }; viewport: { width: number; height: number } },
        currentTransform: { x: number; y: number; k: number },
        currentViewport: { width: number; height: number }
    ): boolean
}

export interface DebugLogger {
    warn(message: string, data?: unknown): void
}

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

// High-performance pattern-based grid creation with enhanced caching and performance monitoring
export function createGrid(
    gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    transform: { x: number; y: number; k: number },
    viewportWidth: number,
    viewportHeight: number,
    options: {
        showGrid: boolean
        gridCacheRef: React.MutableRefObject<GridCacheRef | null>
        gridPerformanceRef: React.MutableRefObject<GridPerformanceMonitor | null>
        getVisibleCanvasBounds: (
            transform: { x: number; y: number; k: number },
            viewportWidth: number,
            viewportHeight: number,
            padding: number
        ) => { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }
        GRID_CONSTANTS: GridConstants
        dbg?: DebugLogger
    }
) {
    const {
        showGrid,
        gridCacheRef,
        gridPerformanceRef,
        getVisibleCanvasBounds,
        GRID_CONSTANTS,
        dbg
    } = options

    const startTime = performance.now()

    // Early exit and cleanup if grid is hidden
    if (!showGrid) {
        gridLayer.selectAll('.grid-pattern-rect').remove()
        return
    }

    // Resolve owning SVG and defs
    const owningSvg = gridLayer.node()?.ownerSVGElement
    if (!owningSvg) {
        return
    }
    const svgSelection = d3.select(owningSvg)
    let defs = svgSelection.select<SVGDefsElement>('defs')
    if (defs.empty()) {
        defs = svgSelection.insert<SVGDefsElement>('defs', ':first-child')
    }

    // Compute cache key with tolerance and attempt cache short-circuit
    const perf = gridPerformanceRef.current
    const cacheKey = perf && perf.generateCacheKey
        ? perf.generateCacheKey(
            transform,
            { width: viewportWidth, height: viewportHeight }
        )
        : JSON.stringify({
            k: transform.k,
            x: Math.round(transform.x),
            y: Math.round(transform.y),
            vw: Math.round(viewportWidth),
            vh: Math.round(viewportHeight),
        })

    const existing = gridCacheRef.current
    if (existing && existing.transform === cacheKey) {
        // Validate cache freshness and viewport stability
        const cacheInfo = {
            lastRenderTime: existing.lastRenderTime,
            transform, // not used by validateCacheConsistency currently
            viewport: { width: existing.viewport.width, height: existing.viewport.height },
        }
        const cacheFresh = perf && perf.isCacheExpired ? !perf.isCacheExpired(cacheInfo) : true
        const viewportStable = perf && perf.validateCacheConsistency
            ? perf.validateCacheConsistency(
                cacheInfo,
                transform,
                { width: viewportWidth, height: viewportHeight }
            )
            : true

        if (cacheFresh && viewportStable) {
            // Cache hit: skip re-rendering grid rectangles
            if (perf && perf.recordCacheHit) {
                perf.recordCacheHit()
            }
            // Keep cache fresh
            existing.lastRenderTime = performance.now()
            existing.viewport = { width: viewportWidth, height: viewportHeight }
            // Keep a lightweight attribute update for debugging/inspection
            gridLayer.attr(
                'data-grid-size',
                `${Math.round(viewportWidth)}x${Math.round(viewportHeight)}`
            )
            return
        }
    }

    // Ensure patterns exist (base + major) via utility
    const baseSize = GRID_CONSTANTS.BASE_GRID_SIZE
    const { patternId, majorPatternId } = ensureDualGridPatterns(defs, transform.k, baseSize)

    // PERFORMANCE: Selective clearing - only remove grid elements, preserve other content
    gridLayer.selectAll('.grid-pattern-rect').remove()

    // Enhanced bounds calculation with intelligent padding using GridUtils
    const padding = GridUtils.calculateIntelligentPadding(transform.k)
    const bounds = getVisibleCanvasBounds(transform, viewportWidth, viewportHeight, padding)

    // Validate bounds to prevent invalid rectangles
    if (bounds.width <= 0 || bounds.height <= 0) {
        console.warn('🚨 Grid: Invalid bounds calculated', bounds)
        return
    }

    // Render layered rects via utility
    renderDualGridRects(gridLayer, bounds, patternId, majorPatternId)

    // Enhanced cache with all necessary data and performance tracking
    const renderTime = performance.now() - startTime
    // Count as cache miss since we had to re-render
    if (gridPerformanceRef.current && gridPerformanceRef.current.recordCacheMiss) {
        gridPerformanceRef.current.recordCacheMiss()
    }
    gridPerformanceRef.current?.recordRender(renderTime)

    // Store current viewport size for debugging/inspection
    gridLayer.attr(
        'data-grid-size',
        `${Math.round(viewportWidth)}x${Math.round(viewportHeight)}`
    )

    // Update grid cache
    const now = performance.now()
    gridCacheRef.current = {
        transform: cacheKey,
        pattern: `${patternId},${majorPatternId}`,
        lastRenderTime: now,
        viewport: { width: viewportWidth, height: viewportHeight },
        bounds,
    }

    // Reduced performance logging - only show summary periodically in dev
    if (process.env.NODE_ENV === 'development' && gridPerformanceRef.current && dbg) {
        const metrics = gridPerformanceRef.current.getMetrics()
        if (metrics.renderCount % GRID_CONSTANTS.PERFORMANCE_LOG_INTERVAL === 0) {
            dbg.warn('🔍 Grid Performance Summary (every 100 renders)', {
                renderTime: `${renderTime.toFixed(2)}ms`,
                avgRenderTime: `${metrics.avgRenderTime.toFixed(2)}ms`,
                cacheHitRate: `${metrics.cacheHitRate.toFixed(1)}%`,
                totalRenders: metrics.renderCount,
            })
        }
        const report = gridPerformanceRef.current.getPerformanceReport()
        if (
            (report.status === 'warning' || report.status === 'poor') &&
            metrics.renderCount % GRID_CONSTANTS.PERFORMANCE_WARNING_INTERVAL === 0
        ) {
            console.warn(
                `🚨 Grid Performance ${report.status.toUpperCase()} (every 50th):`,
                report.summary
            )
        }
    }
}
