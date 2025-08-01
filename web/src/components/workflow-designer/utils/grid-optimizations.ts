/**
 * Grid Performance Optimizations
 * 
 * Alternative high-performance approaches for grid rendering:
 * 1. Single Path Approach - All dots as one SVG path
 * 2. Canvas-Based Approach - HTML5 Canvas for maximum performance  
 * 3. Adaptive Selection - Automatically chooses optimal approach
 */

import * as d3 from 'd3'
import { getVisibleCanvasBounds } from './canvas-utils'

export interface GridOptions {
  baseGridSize?: number
  dotRadius?: number
  dotColor?: string
  dotOpacity?: number
  padding?: number
}

export interface PerformanceMetrics {
  renderTime: number
  elementCount: number
  cacheHit: boolean
  approach: 'pattern' | 'path' | 'canvas'
}

/**
 * Single Path Approach - All dots consolidated into one SVG path element
 * Memory efficient, good for moderate dot counts (< 5000 dots)
 */
export function createSinglePathGrid(
  gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  transform: { x: number; y: number; k: number },
  viewportWidth: number,
  viewportHeight: number,
  options: GridOptions = {}
): PerformanceMetrics {
  const startTime = performance.now()
  const {
    baseGridSize = 20,
    dotRadius = 1.5,
    dotColor = '#d1d5db',
    dotOpacity = 0.6,
    padding = 200
  } = options

  const gridSize = baseGridSize * transform.k
  if (gridSize < 8) {
    gridLayer.selectAll('*').remove()
    return {
      renderTime: performance.now() - startTime,
      elementCount: 0,
      cacheHit: false,
      approach: 'path'
    }
  }

  const bounds = getVisibleCanvasBounds(transform, viewportWidth, viewportHeight, padding)
  
  const startX = Math.floor(bounds.minX / baseGridSize) * baseGridSize
  const endX = Math.ceil(bounds.maxX / baseGridSize) * baseGridSize
  const startY = Math.floor(bounds.minY / baseGridSize) * baseGridSize
  const endY = Math.ceil(bounds.maxY / baseGridSize) * baseGridSize

  // Build single path string with all dots
  let pathData = ''
  let dotCount = 0
  
  for (let x = startX; x <= endX; x += baseGridSize) {
    for (let y = startY; y <= endY; y += baseGridSize) {
      // Create circle path: M cx,cy m -r,0 a r,r 0 1,1 2r,0 a r,r 0 1,1 -2r,0
      const r = dotRadius / transform.k
      pathData += `M ${x},${y} m -${r},0 a ${r},${r} 0 1,1 ${2*r},0 a ${r},${r} 0 1,1 -${2*r},0 `
      dotCount++
    }
  }

  gridLayer.selectAll('*').remove()
  
  if (pathData) {
    gridLayer.append('path')
      .attr('class', 'grid-dots-path')
      .attr('d', pathData)
      .attr('fill', dotColor)
      .attr('opacity', dotOpacity)
      .style('pointer-events', 'none')
  }

  return {
    renderTime: performance.now() - startTime,
    elementCount: pathData ? 1 : 0,
    cacheHit: false,
    approach: 'path'
  }
}

/**
 * Canvas-Based Approach - Uses HTML5 Canvas for ultimate performance
 * Best for very high dot counts (> 10000 dots) or real-time interactions
 */
export function createCanvasBasedGrid(
  container: HTMLElement,
  transform: { x: number; y: number; k: number },
  viewportWidth: number,
  viewportHeight: number,
  options: GridOptions = {}
): PerformanceMetrics {
  const startTime = performance.now()
  const {
    baseGridSize = 20,
    dotRadius = 1.5,  
    dotColor = '#d1d5db',
    dotOpacity = 0.6,
    padding = 200
  } = options

  // Find or create canvas element
  let canvas = container.querySelector('.grid-canvas') as HTMLCanvasElement
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.className = 'grid-canvas'
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '1'
    container.appendChild(canvas)
  }

  // Set canvas size
  canvas.width = viewportWidth
  canvas.height = viewportHeight
  
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      renderTime: performance.now() - startTime,
      elementCount: 0,
      cacheHit: false,
      approach: 'canvas'
    }
  }

  // Clear canvas
  ctx.clearRect(0, 0, viewportWidth, viewportHeight)

  const gridSize = baseGridSize * transform.k
  if (gridSize < 8) {
    return {
      renderTime: performance.now() - startTime,
      elementCount: 0,
      cacheHit: false,
      approach: 'canvas'
    }
  }

  const bounds = getVisibleCanvasBounds(transform, viewportWidth, viewportHeight, padding)
  
  // Set dot style
  ctx.fillStyle = dotColor
  ctx.globalAlpha = dotOpacity

  let dotCount = 0
  const scaledRadius = dotRadius * transform.k

  // Draw dots
  for (let x = bounds.minX; x <= bounds.maxX; x += baseGridSize) {
    for (let y = bounds.minY; y <= bounds.maxY; y += baseGridSize) {
      const screenX = x * transform.k + transform.x
      const screenY = y * transform.k + transform.y
      
      // Only draw dots visible in viewport
      if (screenX >= -scaledRadius && screenX <= viewportWidth + scaledRadius && 
          screenY >= -scaledRadius && screenY <= viewportHeight + scaledRadius) {
        ctx.beginPath()
        ctx.arc(screenX, screenY, scaledRadius, 0, 2 * Math.PI)
        ctx.fill()
        dotCount++
      }
    }
  }

  return {
    renderTime: performance.now() - startTime,
    elementCount: dotCount,
    cacheHit: false,
    approach: 'canvas'
  }
}

/**
 * Adaptive Grid Selection - Automatically chooses the best approach
 * based on performance characteristics and dot count
 */
export function createAdaptiveGrid(
  gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  transform: { x: number; y: number; k: number },
  viewportWidth: number,
  viewportHeight: number,
  options: GridOptions = {}
): PerformanceMetrics {
  const bounds = getVisibleCanvasBounds(transform, viewportWidth, viewportHeight, options.padding || 200)
  const baseGridSize = options.baseGridSize || 20
  
  // Estimate dot count
  const dotsX = Math.ceil((bounds.maxX - bounds.minX) / baseGridSize)
  const dotsY = Math.ceil((bounds.maxY - bounds.minY) / baseGridSize)  
  const estimatedDots = dotsX * dotsY

  // Choose approach based on complexity
  if (estimatedDots < 1000) {
    // Low complexity: Use pattern approach (already implemented in main component)
    return {
      renderTime: 0,
      elementCount: 1,
      cacheHit: true,
      approach: 'pattern'
    }
  } else if (estimatedDots < 5000) {
    // Medium complexity: Use single path approach
    return createSinglePathGrid(gridLayer, transform, viewportWidth, viewportHeight, options)
  } else {
    // High complexity: Use canvas approach
    const container = gridLayer.node()?.closest('.canvas-container') as HTMLElement
    if (container) {
      return createCanvasBasedGrid(container, transform, viewportWidth, viewportHeight, options)
    }
    
    // Fallback to path approach
    return createSinglePathGrid(gridLayer, transform, viewportWidth, viewportHeight, options)
  }
}

/**
 * Performance measurement utility
 */
export function measureGridPerformance(
  renderFunction: () => void,
  iterations = 10
): { averageTime: number; minTime: number; maxTime: number } {
  const times: number[] = []
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    renderFunction()
    times.push(performance.now() - start)
  }
  
  return {
    averageTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times)
  }
}

/**
 * Cache key generator with improved collision avoidance
 */
export function generateGridCacheKey(
  transform: { x: number; y: number; k: number },
  viewportWidth: number,
  viewportHeight: number,
  precision = 5
): string {
  const roundedTransform = {
    x: Math.round(transform.x / precision) * precision,
    y: Math.round(transform.y / precision) * precision,
    k: Math.round(transform.k * 100) / 100
  }
  
  return `${roundedTransform.x}_${roundedTransform.y}_${roundedTransform.k}_${viewportWidth}_${viewportHeight}`
}