/**
 * Professional D3.js Animation System for Workflow Connections
 * 
 * Features:
 * - Smooth path transitions with d3.transition()
 * - Professional easing functions and timing
 * - Path morphing animations
 * - Hover and selection animations
 * - Performance-optimized animation scheduling
 * - Connection drawing animations (pen-like effect)
 */

import * as d3 from 'd3'
import type { Connection, WorkflowNode } from '../types'

// ============================================================================
// ANIMATION TYPES AND INTERFACES
// ============================================================================

export interface AnimationConfig {
  duration: number
  easing: d3.EasingFactory
  delay?: number
  onStart?: () => void
  onComplete?: () => void
}

export interface PathAnimationState {
  connectionId: string
  element: SVGPathElement
  currentPath: string
  targetPath: string
  animationProgress: number
  isAnimating: boolean
}

export interface ConnectionDrawingAnimation {
  pathLength: number
  duration: number
  drawProgress: number
  isComplete: boolean
}

// ============================================================================
// PROFESSIONAL EASING FUNCTIONS
// ============================================================================

/**
 * Professional easing functions for workflow connections
 */
export class ConnectionEasing {
  // Smooth, professional transitions
  static readonly SMOOTH = d3.easeQuadInOut
  static readonly GENTLE = d3.easeCubicInOut
  static readonly ELASTIC = d3.easeElasticOut.amplitude(1).period(0.3)
  static readonly BOUNCE = d3.easeBounceOut
  static readonly BACK = d3.easeBackOut.overshoot(1.7)
  
  // Fast, responsive transitions
  static readonly FAST = d3.easeQuadOut
  static readonly INSTANT = d3.easeLinear
  
  // Attention-grabbing effects
  static readonly PULSE = d3.easeSinInOut
  static readonly WOBBLE = (t: number) => Math.sin(t * Math.PI * 3) * (1 - t) + t
}

// ============================================================================
// PATH INTERPOLATION ENGINE
// ============================================================================

/**
 * Advanced path interpolation for smooth morphing between different connection shapes
 */
export class PathInterpolator {
  /**
   * Create interpolator between two SVG paths with matching point counts
   */
  static createPathInterpolator(pathA: string, pathB: string): (t: number) => string {
    const pointsA = this.extractPathPoints(pathA)
    const pointsB = this.extractPathPoints(pathB)
    
    // Normalize paths to have the same number of points
    const normalizedA = this.normalizePath(pointsA, Math.max(pointsA.length, pointsB.length))
    const normalizedB = this.normalizePath(pointsB, Math.max(pointsA.length, pointsB.length))
    
    return (t: number) => {
      const interpolatedPoints = normalizedA.map((pointA, index) => {
        const pointB = normalizedB[index]
        return {
          x: pointA.x + (pointB.x - pointA.x) * t,
          y: pointA.y + (pointB.y - pointA.y) * t,
          type: pointA.type
        }
      })
      
      return this.pointsToPath(interpolatedPoints)
    }
  }

  /**
   * Extract points from SVG path string
   */
  private static extractPathPoints(pathString: string): Array<{x: number, y: number, type: string}> {
    const points: Array<{x: number, y: number, type: string}> = []
    const commands = pathString.match(/[MLC]\s*[\d.-]+(\s*[\d.-]+)*/g) || []
    
    commands.forEach(command => {
      const type = command.charAt(0)
      const coords = command.slice(1).trim().split(/\s+/).map(Number)
      
      for (let i = 0; i < coords.length; i += 2) {
        if (coords[i + 1] !== undefined) {
          points.push({
            x: coords[i],
            y: coords[i + 1],
            type: i === 0 ? type : 'L'
          })
        }
      }
    })
    
    return points
  }

  /**
   * Normalize path to have specific number of points through interpolation
   */
  private static normalizePath(
    points: Array<{x: number, y: number, type: string}>, 
    targetCount: number
  ): Array<{x: number, y: number, type: string}> {
    if (points.length === targetCount) return points
    
    const normalized: Array<{x: number, y: number, type: string}> = []
    
    for (let i = 0; i < targetCount; i++) {
      const ratio = i / (targetCount - 1)
      const sourceIndex = ratio * (points.length - 1)
      const lowerIndex = Math.floor(sourceIndex)
      const upperIndex = Math.min(Math.ceil(sourceIndex), points.length - 1)
      const t = sourceIndex - lowerIndex
      
      const lowerPoint = points[lowerIndex]
      const upperPoint = points[upperIndex]
      
      normalized.push({
        x: lowerPoint.x + (upperPoint.x - lowerPoint.x) * t,
        y: lowerPoint.y + (upperPoint.y - lowerPoint.y) * t,
        type: i === 0 ? 'M' : 'L'
      })
    }
    
    return normalized
  }

  /**
   * Convert points back to SVG path string
   */
  private static pointsToPath(points: Array<{x: number, y: number, type: string}>): string {
    return points.map(point => `${point.type} ${point.x} ${point.y}`).join(' ')
  }
}

// ============================================================================
// CONNECTION ANIMATION MANAGER
// ============================================================================

/**
 * Manages all connection animations with performance optimization
 */
export class ConnectionAnimationManager {
  private activeAnimations = new Map<string, PathAnimationState>()
  private animationQueue: Array<() => void> = []
  private isProcessingQueue = false
  private performanceMode = false
  
  // Animation performance settings
  private readonly MAX_CONCURRENT_ANIMATIONS = 10
  private readonly PERFORMANCE_THRESHOLD_MS = 16.67 // 60fps
  
  /**
   * Animate path transition with professional easing
   */
  animatePathTransition(
    connectionId: string,
    pathElement: SVGPathElement,
    newPath: string,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 300,
      easing: ConnectionEasing.SMOOTH,
      delay: 0
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    
    return new Promise((resolve) => {
      // Cancel existing animation for this connection
      this.cancelAnimation(connectionId)
      
      const currentPath = pathElement.getAttribute('d') || ''
      
      // Create path interpolator
      const interpolator = PathInterpolator.createPathInterpolator(currentPath, newPath)
      
      // Store animation state
      const animationState: PathAnimationState = {
        connectionId,
        element: pathElement,
        currentPath,
        targetPath: newPath,
        animationProgress: 0,
        isAnimating: true
      }
      
      this.activeAnimations.set(connectionId, animationState)
      
      // Create D3 transition
      const transition = d3.select(pathElement)
        .transition()
        .duration(finalConfig.duration)
        .delay(finalConfig.delay || 0)
        .ease(finalConfig.easing)
        .attrTween('d', () => interpolator)
        .on('start', () => {
          finalConfig.onStart?.()
        })
        .on('end', () => {
          this.activeAnimations.delete(connectionId)
          finalConfig.onComplete?.()
          resolve()
        })
        .on('interrupt', () => {
          this.activeAnimations.delete(connectionId)
          resolve()
        })
      
      // Update animation progress during transition
      transition.tween('progress', () => {
        return (t: number) => {
          if (this.activeAnimations.has(connectionId)) {
            this.activeAnimations.get(connectionId)!.animationProgress = t
          }
        }
      })
    })
  }

  /**
   * Animate connection drawing effect (pen-like drawing)
   */
  animateConnectionDrawing(
    pathElement: SVGPathElement,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 800,
      easing: ConnectionEasing.GENTLE,
      delay: 0
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    
    return new Promise((resolve) => {
      const pathLength = pathElement.getTotalLength()
      
      // Set up initial state - line is invisible
      d3.select(pathElement)
        .attr('stroke-dasharray', `${pathLength} ${pathLength}`)
        .attr('stroke-dashoffset', pathLength)
        .style('opacity', 1)
      
      // Animate the drawing
      d3.select(pathElement)
        .transition()
        .duration(finalConfig.duration)
        .delay(finalConfig.delay || 0)
        .ease(finalConfig.easing)
        .attr('stroke-dashoffset', 0)
        .on('end', () => {
          // Clean up after animation
          d3.select(pathElement)
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)
          
          finalConfig.onComplete?.()
          resolve()
        })
    })
  }

  /**
   * Animate hover effect with smooth scaling and color transition
   */
  animateHoverEffect(
    connectionElement: SVGGElement,
    isHovering: boolean,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 200,
      easing: ConnectionEasing.FAST
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    
    return new Promise((resolve) => {
      const pathElement = connectionElement.querySelector('.connection-path') as SVGPathElement
      const transition = d3.select(pathElement).transition()
        .duration(finalConfig.duration)
        .ease(finalConfig.easing)
      
      if (isHovering) {
        transition
          .attr('stroke-width', 4)
          .attr('stroke', '#1976D2')
          .style('filter', 'drop-shadow(0 2px 4px rgba(25, 118, 210, 0.3))')
      } else {
        transition
          .attr('stroke-width', 2)
          .attr('stroke', 'white')
          .style('filter', null)
      }
      
      transition.on('end', () => resolve())
    })
  }

  /**
   * Animate selection effect with pulsing glow
   */
  animateSelectionEffect(
    connectionElement: SVGGElement,
    isSelected: boolean,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 300,
      easing: ConnectionEasing.GENTLE
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    
    return new Promise((resolve) => {
      const pathElement = connectionElement.querySelector('.connection-path') as SVGPathElement
      
      if (isSelected) {
        // Create pulsing effect
        const pulse = () => {
          d3.select(pathElement)
            .transition()
            .duration(1000)
            .ease(d3.easeSinInOut)
            .style('filter', 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.8))')
            .transition()
            .duration(1000)
            .ease(d3.easeSinInOut)
            .style('filter', 'drop-shadow(0 0 12px rgba(33, 150, 243, 0.4))')
            .on('end', pulse)
        }
        
        d3.select(pathElement)
          .transition()
          .duration(finalConfig.duration)
          .ease(finalConfig.easing)
          .attr('stroke-width', 3)
          .attr('stroke', '#2196F3')
          .on('end', () => {
            pulse()
            resolve()
          })
      } else {
        // Remove selection effect
        d3.select(pathElement)
          .interrupt() // Stop pulsing
          .transition()
          .duration(finalConfig.duration)
          .ease(finalConfig.easing)
          .attr('stroke-width', 2)
          .attr('stroke', 'white')
          .style('filter', null)
          .on('end', () => resolve())
      }
    })
  }

  /**
   * Animate multiple connections appearing in sequence
   */
  animateConnectionSequence(
    connections: Array<{ element: SVGPathElement; delay?: number }>,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 600,
      easing: ConnectionEasing.GENTLE
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    
    const animationPromises = connections.map((conn, index) => {
      const delay = conn.delay ?? (index * 100) // Stagger by 100ms by default
      
      return this.animateConnectionDrawing(conn.element, {
        ...finalConfig,
        delay
      })
    })
    
    return Promise.all(animationPromises).then(() => {})
  }

  /**
   * Animate path morphing for node repositioning
   */
  animatePathMorphing(
    connectionId: string,
    pathElement: SVGPathElement,
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    pathGenerator: (source: WorkflowNode, target: WorkflowNode) => string,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 400,
      easing: ConnectionEasing.SMOOTH
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    const newPath = pathGenerator(sourceNode, targetNode)
    
    return this.animatePathTransition(connectionId, pathElement, newPath, finalConfig)
  }

  /**
   * Cancel specific animation
   */
  cancelAnimation(connectionId: string): void {
    const animationState = this.activeAnimations.get(connectionId)
    if (animationState) {
      d3.select(animationState.element).interrupt()
      this.activeAnimations.delete(connectionId)
    }
  }

  /**
   * Cancel all active animations
   */
  cancelAllAnimations(): void {
    this.activeAnimations.forEach((state, connectionId) => {
      this.cancelAnimation(connectionId)
    })
    this.activeAnimations.clear()
  }

  /**
   * Get animation state for a connection
   */
  getAnimationState(connectionId: string): PathAnimationState | null {
    return this.activeAnimations.get(connectionId) || null
  }

  /**
   * Check if any animations are currently running
   */
  hasActiveAnimations(): boolean {
    return this.activeAnimations.size > 0
  }

  /**
   * Enable/disable performance mode (reduces animation quality for performance)
   */
  setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled
    
    if (enabled) {
      // Cancel all current animations and use instant updates
      this.cancelAllAnimations()
    }
  }

  /**
   * Batch multiple animations for better performance
   */
  batchAnimations(animations: Array<() => Promise<void>>): Promise<void> {
    if (this.performanceMode) {
      // Execute all immediately without animation
      animations.forEach(anim => anim())
      return Promise.resolve()
    }
    
    // Limit concurrent animations
    if (animations.length > this.MAX_CONCURRENT_ANIMATIONS) {
      return this.processBatchedAnimations(animations)
    }
    
    return Promise.all(animations.map(anim => anim())).then(() => {})
  }

  /**
   * Process batched animations in chunks to maintain performance
   */
  private async processBatchedAnimations(animations: Array<() => Promise<void>>): Promise<void> {
    const chunks = this.chunkArray(animations, this.MAX_CONCURRENT_ANIMATIONS)
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(anim => anim()))
      
      // Small delay between batches to prevent frame drops
      await new Promise(resolve => setTimeout(resolve, 16))
    }
  }

  /**
   * Utility to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Cleanup all resources
   */
  dispose(): void {
    this.cancelAllAnimations()
    this.animationQueue = []
    this.isProcessingQueue = false
  }
}

// ============================================================================
// SPECIALIZED ANIMATION EFFECTS
// ============================================================================

/**
 * Specialized animation effects for different connection states
 */
export class ConnectionEffects {
  private animationManager: ConnectionAnimationManager

  constructor(animationManager: ConnectionAnimationManager) {
    this.animationManager = animationManager
  }

  /**
   * Data flow animation - shows data moving along the connection
   */
  async animateDataFlow(
    pathElement: SVGPathElement,
    direction: 'forward' | 'backward' = 'forward',
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 2000,
      easing: d3.easeLinear
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    const pathLength = pathElement.getTotalLength()
    
    // Create data particle effect
    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    particle.setAttribute('r', '3')
    particle.setAttribute('fill', '#2196F3')
    particle.style.filter = 'drop-shadow(0 0 4px rgba(33, 150, 243, 0.8))'
    
    pathElement.parentElement?.appendChild(particle)
    
    return new Promise((resolve) => {
      const startOffset = direction === 'forward' ? 0 : pathLength
      const endOffset = direction === 'forward' ? pathLength : 0
      
      d3.select(particle)
        .datum({ offset: startOffset })
        .transition()
        .duration(finalConfig.duration)
        .ease(finalConfig.easing)
        .tween('pathPosition', function() {
          return (t: number) => {
            const offset = startOffset + (endOffset - startOffset) * t
            const point = pathElement.getPointAtLength(offset)
            
            d3.select(this)
              .attr('cx', point.x)
              .attr('cy', point.y)
          }
        })
        .on('end', () => {
          particle.remove()
          resolve()
        })
    })
  }

  /**
   * Error state animation - shows connection error with warning effect
   */
  async animateErrorState(
    pathElement: SVGPathElement,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 600,
      easing: ConnectionEasing.BOUNCE
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    
    return new Promise((resolve) => {
      d3.select(pathElement)
        .transition()
        .duration(finalConfig.duration)
        .ease(finalConfig.easing)
        .attr('stroke', '#f44336')
        .attr('stroke-width', 3)
        .style('filter', 'drop-shadow(0 0 6px rgba(244, 67, 54, 0.6))')
        .transition()
        .duration(200)
        .attr('stroke-dasharray', '10,5')
        .on('end', () => resolve())
    })
  }

  /**
   * Success state animation - shows successful connection
   */
  async animateSuccessState(
    pathElement: SVGPathElement,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 400,
      easing: ConnectionEasing.BACK
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    
    return new Promise((resolve) => {
      d3.select(pathElement)
        .transition()
        .duration(finalConfig.duration)
        .ease(finalConfig.easing)
        .attr('stroke', '#4caf50')
        .attr('stroke-width', 3)
        .style('filter', 'drop-shadow(0 0 6px rgba(76, 175, 80, 0.6))')
        .transition()
        .duration(300)
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .style('filter', null)
        .on('end', () => resolve())
    })
  }

  /**
   * Highlight effect for related connections
   */
  async animateHighlight(
    pathElements: SVGPathElement[],
    intensity: number = 1,
    config: Partial<AnimationConfig> = {}
  ): Promise<void> {
    const defaultConfig: AnimationConfig = {
      duration: 300,
      easing: ConnectionEasing.GENTLE
    }
    
    const finalConfig = { ...defaultConfig, ...config }
    const highlightColor = `rgba(33, 150, 243, ${0.6 * intensity})`
    
    const animations = pathElements.map(element => 
      new Promise<void>((resolve) => {
        d3.select(element)
          .transition()
          .duration(finalConfig.duration)
          .ease(finalConfig.easing)
          .style('filter', `drop-shadow(0 0 ${4 * intensity}px ${highlightColor})`)
          .attr('stroke-width', 2 + intensity)
          .on('end', () => resolve())
      })
    )
    
    await Promise.all(animations)
  }
}

// ============================================================================
// ANIMATION PRESETS
// ============================================================================

/**
 * Pre-configured animation presets for common use cases
 */
export const ConnectionAnimationPresets = {
  // Subtle, professional animations
  SUBTLE_FADE: {
    duration: 200,
    easing: ConnectionEasing.GENTLE
  },
  
  SMOOTH_TRANSITION: {
    duration: 300,
    easing: ConnectionEasing.SMOOTH
  },
  
  // Attention-grabbing animations
  BOUNCE_IN: {
    duration: 600,
    easing: ConnectionEasing.BOUNCE
  },
  
  ELASTIC_APPEAR: {
    duration: 800,
    easing: ConnectionEasing.ELASTIC
  },
  
  // Fast, responsive animations
  QUICK_RESPONSE: {
    duration: 150,
    easing: ConnectionEasing.FAST
  },
  
  INSTANT: {
    duration: 0,
    easing: ConnectionEasing.INSTANT
  },
  
  // Data flow animations
  DATA_FLOW_SLOW: {
    duration: 3000,
    easing: d3.easeLinear
  },
  
  DATA_FLOW_FAST: {
    duration: 1000,
    easing: d3.easeLinear
  }
} as const

export type AnimationPreset = keyof typeof ConnectionAnimationPresets