/**
 * Production-Ready Enhanced Connection System
 * 
 * This module provides a robust, type-safe, and performance-optimized connection system
 * that gracefully degrades when advanced features are unavailable. It consolidates
 * all enhanced connection functionality into a single, maintainable module.
 */

import * as d3 from 'd3'
import type { WorkflowNode, NodeVariant, Connection } from '../types'
import { getPortPositions, getShapeAwareDimensions } from './node-utils'
import { 
  generateVariantAwareConnectionPath, 
  generateMultipleConnectionPath,
  calculatePortPosition
} from './connection-utils'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ViewportBounds {
  x: number
  y: number
  width: number
  height: number
  zoom: number
}

export interface EnhancedConnectionConfig {
  // Path generation
  algorithm: 'auto' | 'bezier' | 'smooth' | 'orthogonal' | 'bundled' | 'force-directed'
  curveTension: number
  
  // Visual effects
  enableAdvancedEffects: boolean
  theme: 'default' | 'professional' | 'minimal' | 'vibrant'
  
  // Performance
  enablePerformanceOptimizations: boolean
  enableCulling: boolean
  enableCaching: boolean
  
  // Animation
  enableAnimations: boolean
  animationDuration: number
  animationEasing: string
  
  // Collision avoidance
  avoidCollisions: boolean
  snapToGrid: boolean
  
  // Bundling
  enableBundling: boolean
  bundleThreshold: number
  
  // Error handling
  fallbackToStandard: boolean
  logErrors: boolean
}

export interface ConnectionRenderLevel {
  visible: Connection[]
  renderLevel: Map<string, 'high' | 'medium' | 'low'>
}

export interface PerformanceMetrics {
  connectionsRendered: number
  averageRenderTime: number
  cacheHitRate: number
  cullPercentage: number
  animationsActive: number
}

// ============================================================================
// ENHANCED CONNECTION MANAGER
// ============================================================================

/**
 * Production-ready enhanced connection manager that provides professional features
 * with graceful degradation and comprehensive error handling
 */
export class EnhancedConnectionManager {
  private config: EnhancedConnectionConfig
  private canvasBounds: ViewportBounds
  private isInitialized = false
  private performanceCache = new Map<string, string>()
  private lastCleanup = Date.now()
  private metrics: PerformanceMetrics = {
    connectionsRendered: 0,
    averageRenderTime: 0,
    cacheHitRate: 0,
    cullPercentage: 0,
    animationsActive: 0
  }

  // Advanced feature flags (determined at runtime)
  private advancedFeaturesAvailable = false
  private visualEffectsInitialized = false

  constructor(canvasBounds: ViewportBounds, config: Partial<EnhancedConnectionConfig> = {}) {
    this.canvasBounds = this.validateCanvasBounds(canvasBounds)
    this.config = this.createDefaultConfig(config)
    
    // Test for advanced feature availability
    this.detectAdvancedFeatures()
    
    this.log('Enhanced Connection Manager initialized', {
      advancedFeatures: this.advancedFeaturesAvailable,
      config: this.config
    })
  }

  /**
   * Create default configuration with fallbacks
   */
  private createDefaultConfig(userConfig: Partial<EnhancedConnectionConfig>): EnhancedConnectionConfig {
    const defaults: EnhancedConnectionConfig = {
      algorithm: 'auto',
      curveTension: 0.4,
      enableAdvancedEffects: true,
      theme: 'professional',
      enablePerformanceOptimizations: true,
      enableCulling: true,
      enableCaching: true,
      enableAnimations: true,
      animationDuration: 300,
      animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      avoidCollisions: false, // Disabled by default for performance
      snapToGrid: false,
      enableBundling: false, // Disabled by default for simplicity
      bundleThreshold: 50,
      fallbackToStandard: true,
      logErrors: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
    }
    
    return { ...defaults, ...userConfig }
  }

  /**
   * Validate canvas bounds to prevent runtime errors
   */
  private validateCanvasBounds(bounds: ViewportBounds): ViewportBounds {
    return {
      x: Number.isFinite(bounds.x) ? bounds.x : 0,
      y: Number.isFinite(bounds.y) ? bounds.y : 0,
      width: Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width : 1000,
      height: Number.isFinite(bounds.height) && bounds.height > 0 ? bounds.height : 800,
      zoom: Number.isFinite(bounds.zoom) && bounds.zoom > 0 ? bounds.zoom : 1
    }
  }

  /**
   * Detect if advanced features are available
   */
  private detectAdvancedFeatures(): void {
    try {
      // Test for required APIs and dependencies
      const hasD3 = typeof d3 !== 'undefined' && d3.version
      const hasAnimationFrame = typeof requestAnimationFrame !== 'undefined'
      const hasPerformanceAPI = typeof performance !== 'undefined'
      
      this.advancedFeaturesAvailable = hasD3 && hasAnimationFrame && hasPerformanceAPI
      
      this.log('Advanced features detection', {
        d3Available: hasD3,
        animationFrameAvailable: hasAnimationFrame,
        performanceAPIAvailable: hasPerformanceAPI,
        overallAvailable: this.advancedFeaturesAvailable
      })
    } catch (error) {
      this.logError('Failed to detect advanced features', error)
      this.advancedFeaturesAvailable = false
    }
  }

  /**
   * Initialize visual effects with proper error handling
   */
  initializeVisualEffects(svgDefs: d3.Selection<SVGDefsElement, unknown, null, undefined>): boolean {
    if (!this.config.enableAdvancedEffects || !this.advancedFeaturesAvailable) {
      this.log('Visual effects disabled or unavailable')
      return false
    }

    try {
      this.createAdvancedMarkers(svgDefs)
      this.createAdvancedFilters(svgDefs)
      this.visualEffectsInitialized = true
      this.isInitialized = true
      
      this.log('Visual effects initialized successfully')
      return true
    } catch (error) {
      this.logError('Failed to initialize visual effects', error)
      this.visualEffectsInitialized = false
      
      if (this.config.fallbackToStandard) {
        this.log('Falling back to standard visual effects')
        return false
      }
      
      throw error
    }
  }

  /**
   * Generate enhanced connection path with comprehensive error handling
   */
  generateEnhancedConnectionPath(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string,
    connectionIndex: number = 0,
    totalConnections: number = 1,
    variant: NodeVariant = 'standard',
    _allNodes: WorkflowNode[] = [],
    _allConnections: Connection[] = []
  ): string {
    const startTime = performance.now()
    
    try {
      // Validate inputs
      this.validateConnectionInputs(sourceNode, sourcePortId, targetNode, targetPortId)
      
      // Check cache first if enabled
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(
          sourceNode, sourcePortId, targetNode, targetPortId,
          connectionIndex, totalConnections, variant
        )
        
        const cachedPath = this.performanceCache.get(cacheKey)
        if (cachedPath) {
          this.metrics.cacheHitRate++
          return cachedPath
        }
      }

      let path: string

      // Use enhanced path generation if available
      if (this.advancedFeaturesAvailable && this.config.enableAdvancedEffects) {
        if (totalConnections > 1 && this.config.enableBundling) {
          path = this.generateEnhancedMultipleConnectionPath(
            sourceNode, sourcePortId, targetNode, targetPortId,
            connectionIndex, totalConnections, variant
          )
        } else {
          path = this.generateEnhancedSingleConnectionPath(
            sourceNode, sourcePortId, targetNode, targetPortId, variant
          )
        }
      } else {
        // Fallback to standard path generation
        if (totalConnections > 1) {
          path = generateMultipleConnectionPath(
            sourceNode, sourcePortId, targetNode, targetPortId,
            connectionIndex, totalConnections, variant
          )
        } else {
          path = generateVariantAwareConnectionPath(
            sourceNode, sourcePortId, targetNode, targetPortId, variant
          )
        }
      }

      // Cache the result if enabled
      if (this.config.enableCaching && path) {
        const cacheKey = this.generateCacheKey(
          sourceNode, sourcePortId, targetNode, targetPortId,
          connectionIndex, totalConnections, variant
        )
        this.performanceCache.set(cacheKey, path)
      }

      // Update metrics
      const endTime = performance.now()
      this.updateRenderMetrics(endTime - startTime)
      
      return path
      
    } catch (error) {
      this.logError('Enhanced path generation failed', error)
      
      if (this.config.fallbackToStandard) {
        this.log('Falling back to standard path generation')
        try {
          if (totalConnections > 1) {
            return generateMultipleConnectionPath(
              sourceNode, sourcePortId, targetNode, targetPortId,
              connectionIndex, totalConnections, variant
            )
          } else {
            return generateVariantAwareConnectionPath(
              sourceNode, sourcePortId, targetNode, targetPortId, variant
            )
          }
        } catch (fallbackError) {
          this.logError('Fallback path generation also failed', fallbackError)
          return this.generateEmergencyFallbackPath(sourceNode, targetNode)
        }
      }
      
      throw error
    }
  }

  /**
   * Generate enhanced single connection path
   */
  private generateEnhancedSingleConnectionPath(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string,
    variant: NodeVariant
  ): string {
    const basePath = generateVariantAwareConnectionPath(
      sourceNode, sourcePortId, targetNode, targetPortId, variant
    )

    return this.enhancePath(basePath)
  }

  /**
   * Generate enhanced multiple connection path
   */
  private generateEnhancedMultipleConnectionPath(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string,
    connectionIndex: number,
    totalConnections: number,
    variant: NodeVariant
  ): string {
    const basePath = generateMultipleConnectionPath(
      sourceNode, sourcePortId, targetNode, targetPortId,
      connectionIndex, totalConnections, variant
    )

    return this.enhancePath(basePath, connectionIndex, totalConnections)
  }

  /**
   * Enhance path with improved curves and control points
   */
  private enhancePath(basePath: string, connectionIndex?: number, totalConnections?: number): string {
    if (!this.config.enableAdvancedEffects || !basePath) return basePath

    try {
      // Enhanced Bézier curve adjustments
      if (basePath.includes('C')) {
        const enhancedPath = basePath.replace(/C\s*([^C]+)/g, (match, coords) => {
          const numbers = coords.trim().split(/\s+/).map(parseFloat)
          if (numbers.length >= 6 && numbers.every((n: number) => Number.isFinite(n))) {
            const [cp1x, cp1y, cp2x, cp2y, x, y] = numbers
            
            // Apply tension and smoothing
            const tensionFactor = 1 + (this.config.curveTension * 0.2)
            const enhancedCp1x = cp1x * tensionFactor
            const enhancedCp2x = cp2x * tensionFactor
            
            // Add slight variation for multiple connections
            let yOffset = 0
            if (connectionIndex !== undefined && totalConnections !== undefined && totalConnections > 1) {
              const maxOffset = 5
              const spacing = maxOffset / Math.max(1, totalConnections - 1)
              yOffset = (connectionIndex * spacing) - (maxOffset / 2)
            }
            
            return `C ${enhancedCp1x} ${cp1y + yOffset} ${enhancedCp2x} ${cp2y + yOffset} ${x} ${y}`
          }
          return match
        })
        
        return enhancedPath
      }
    } catch (error) {
      this.logError('Path enhancement failed, using original', error)
    }

    return basePath
  }

  /**
   * Apply enhanced visual effects with error handling
   */
  applyEnhancedEffects(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    pathElement: SVGPathElement,
    _connection: Connection,
    state: 'default' | 'hover' | 'selected' | 'active' = 'default'
  ): boolean {
    if (!this.visualEffectsInitialized || !this.advancedFeaturesAvailable) {
      return false
    }

    try {
      const path = d3.select(pathElement)
      
      switch (state) {
        case 'hover':
          this.applyHoverEffect(path)
          break
        case 'selected':
          this.applySelectionEffect(path)
          break
        case 'active':
          this.applyActiveEffect(path)
          break
        default:
          this.applyDefaultEffect(path)
          break
      }
      
      return true
    } catch (error) {
      this.logError('Failed to apply enhanced effects', error)
      return false
    }
  }

  /**
   * Animate connection drawing with error handling
   */
  async animateConnectionDrawing(
    pathElement: SVGPathElement,
    duration?: number
  ): Promise<boolean> {
    if (!this.config.enableAnimations || !this.advancedFeaturesAvailable) {
      return false
    }

    try {
      const totalLength = pathElement.getTotalLength()
      const animDuration = duration || this.config.animationDuration
      
      d3.select(pathElement)
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(animDuration)
        .ease(d3.easeQuadOut)
        .attr('stroke-dashoffset', 0)
        .on('end', () => {
          d3.select(pathElement)
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)
        })

      this.metrics.animationsActive++
      return true
    } catch (error) {
      this.logError('Failed to animate connection drawing', error)
      return false
    }
  }

  /**
   * Animate path changes with error handling
   */
  async animatePathChange(
    _connectionId: string,
    pathElement: SVGPathElement,
    newPath: string,
    duration?: number
  ): Promise<boolean> {
    if (!this.config.enableAnimations || !this.advancedFeaturesAvailable) {
      pathElement.setAttribute('d', newPath)
      return false
    }

    try {
      const animDuration = duration || this.config.animationDuration
      
      d3.select(pathElement)
        .transition()
        .duration(animDuration)
        .ease(d3.easeQuadOut)
        .attr('d', newPath)

      return true
    } catch (error) {
      this.logError('Failed to animate path change', error)
      pathElement.setAttribute('d', newPath)
      return false
    }
  }

  /**
   * Get optimized connections for rendering with culling
   */
  getOptimizedConnections(
    connections: Connection[],
    nodeMap: Map<string, WorkflowNode>,
    zoomLevel: number
  ): ConnectionRenderLevel {
    if (!this.config.enablePerformanceOptimizations || !this.config.enableCulling) {
      const renderLevel = new Map<string, 'high' | 'medium' | 'low'>()
      connections.forEach(conn => renderLevel.set(conn.id, 'high'))
      return { visible: connections, renderLevel }
    }

    try {
      const visible: Connection[] = []
      const renderLevel = new Map<string, 'high' | 'medium' | 'low'>()
      
      for (const connection of connections) {
        const sourceNode = nodeMap.get(connection.sourceNodeId)
        const targetNode = nodeMap.get(connection.targetNodeId)
        
        if (!sourceNode || !targetNode) continue
        
        // Simple viewport culling
        const isVisible = this.isConnectionVisible(sourceNode, targetNode, zoomLevel)
        
        if (isVisible) {
          visible.push(connection)
          
          // Determine render quality based on zoom and complexity
          if (zoomLevel > 1.5) {
            renderLevel.set(connection.id, 'high')
          } else if (zoomLevel > 0.5) {
            renderLevel.set(connection.id, 'medium')
          } else {
            renderLevel.set(connection.id, 'low')
          }
        }
      }
      
      // Update metrics
      this.metrics.cullPercentage = ((connections.length - visible.length) / connections.length) * 100
      
      return { visible, renderLevel }
    } catch (error) {
      this.logError('Failed to optimize connections', error)
      
      // Fallback to showing all connections
      const renderLevel = new Map<string, 'high' | 'medium' | 'low'>()
      connections.forEach(conn => renderLevel.set(conn.id, 'medium'))
      return { visible: connections, renderLevel }
    }
  }

  /**
   * Update viewport bounds
   */
  updateViewport(bounds: ViewportBounds): void {
    this.canvasBounds = this.validateCanvasBounds(bounds)
    
    // Cleanup cache periodically
    if (Date.now() - this.lastCleanup > 30000) { // 30 seconds
      this.performMaintenance()
    }
  }

  /**
   * Update configuration with validation
   */
  updateConfig(newConfig: Partial<EnhancedConnectionConfig>): void {
    try {
      this.config = { ...this.config, ...newConfig }
      this.log('Configuration updated', newConfig)
    } catch (error) {
      this.logError('Failed to update configuration', error)
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EnhancedConnectionConfig {
    return { ...this.config }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Perform maintenance (cache cleanup, metrics reset)
   */
  performMaintenance(): void {
    try {
      // Clear old cache entries
      if (this.performanceCache.size > 1000) {
        this.performanceCache.clear()
        this.log('Performance cache cleared')
      }
      
      // Reset some metrics
      this.metrics.cacheHitRate = 0
      this.metrics.animationsActive = 0
      
      this.lastCleanup = Date.now()
    } catch (error) {
      this.logError('Maintenance failed', error)
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    try {
      this.performanceCache.clear()
      this.isInitialized = false
      this.visualEffectsInitialized = false
      this.log('Enhanced Connection Manager disposed')
    } catch (error) {
      this.logError('Disposal failed', error)
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private validateConnectionInputs(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string
  ): void {
    if (!sourceNode || !targetNode) {
      throw new Error('Source and target nodes are required')
    }
    
    if (!sourcePortId || !targetPortId) {
      throw new Error('Source and target port IDs are required')
    }
    
    if (sourceNode.id === targetNode.id) {
      throw new Error('Self-connections are not supported')
    }
  }

  private generateCacheKey(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string,
    connectionIndex: number,
    totalConnections: number,
    variant: NodeVariant
  ): string {
    return `${sourceNode.id}-${sourcePortId}-${targetNode.id}-${targetPortId}-${connectionIndex}-${totalConnections}-${variant}-${sourceNode.x}-${sourceNode.y}-${targetNode.x}-${targetNode.y}`
  }

  private generateEmergencyFallbackPath(sourceNode: WorkflowNode, targetNode: WorkflowNode): string {
    // Generate a simple straight line as absolute fallback
    return `M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`
  }

  private isConnectionVisible(sourceNode: WorkflowNode, targetNode: WorkflowNode, zoomLevel: number): boolean {
    // Simple visibility check based on canvas bounds
    const margin = 50 / zoomLevel // Larger margin for lower zoom
    
    const minX = this.canvasBounds.x - margin
    const maxX = this.canvasBounds.x + this.canvasBounds.width + margin
    const minY = this.canvasBounds.y - margin
    const maxY = this.canvasBounds.y + this.canvasBounds.height + margin
    
    // Check if either node is visible
    return (
      (sourceNode.x >= minX && sourceNode.x <= maxX && sourceNode.y >= minY && sourceNode.y <= maxY) ||
      (targetNode.x >= minX && targetNode.x <= maxX && targetNode.y >= minY && targetNode.y <= maxY)
    )
  }

  private updateRenderMetrics(renderTime: number): void {
    this.metrics.connectionsRendered++
    
    // Update average render time with exponential moving average
    const alpha = 0.1
    this.metrics.averageRenderTime = (alpha * renderTime) + ((1 - alpha) * this.metrics.averageRenderTime)
  }

  private createAdvancedMarkers(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>): void {
    // Professional arrow marker with gradient
    const marker = defs.append('marker')
      .attr('id', 'enhanced-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 3)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')

    marker.append('path')
      .attr('d', 'M0,0 L0,6 L9,3 z')
      .attr('fill', 'url(#enhanced-arrow-gradient)')

    // Professional gradient
    const gradient = defs.append('linearGradient')
      .attr('id', 'enhanced-arrow-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#2196F3')
      .attr('stop-opacity', 0.8)

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#1976D2')
      .attr('stop-opacity', 1)
  }

  private createAdvancedFilters(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>): void {
    // Enhanced glow filter
    const filter = defs.append('filter')
      .attr('id', 'enhanced-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '2')
      .attr('result', 'coloredBlur')

    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Professional shadow filter
    const shadowFilter = defs.append('filter')
      .attr('id', 'enhanced-shadow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%')

    shadowFilter.append('feDropShadow')
      .attr('dx', '1')
      .attr('dy', '1')
      .attr('stdDeviation', '1')
      .attr('flood-color', 'rgba(0,0,0,0.3)')
  }

  private applyHoverEffect(path: d3.Selection<SVGPathElement, unknown, null, undefined>): void {
    path
      .transition()
      .duration(150)
      .attr('stroke', '#1976D2')
      .attr('stroke-width', 3)
      .style('filter', 'url(#enhanced-glow)')
  }

  private applySelectionEffect(path: d3.Selection<SVGPathElement, unknown, null, undefined>): void {
    path
      .attr('stroke', '#2196F3')
      .attr('stroke-width', 3)
      .style('filter', 'url(#enhanced-glow)')
      .style('marker-end', 'url(#enhanced-arrow)')
  }

  private applyActiveEffect(path: d3.Selection<SVGPathElement, unknown, null, undefined>): void {
    path
      .attr('stroke', '#4CAF50')
      .attr('stroke-width', 4)
      .style('filter', 'url(#enhanced-glow)')
      .style('marker-end', 'url(#enhanced-arrow)')
  }

  private applyDefaultEffect(path: d3.Selection<SVGPathElement, unknown, null, undefined>): void {
    path
      .transition()
      .duration(150)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('filter', null)
      .style('marker-end', null)
  }

  private log(message: string, data?: any): void {
    if (this.config.logErrors && typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      console.log(`[EnhancedConnectionManager] ${message}`, data || '')
    }
  }

  private logError(message: string, error: any): void {
    if (this.config.logErrors) {
      console.error(`[EnhancedConnectionManager] ${message}`, error)
    }
  }
}

// ============================================================================
// GLOBAL INSTANCE AND BACKWARD COMPATIBILITY
// ============================================================================

let globalEnhancedManager: EnhancedConnectionManager | null = null

/**
 * Initialize enhanced connection system
 */
export function initializeEnhancedConnections(
  canvasBounds: ViewportBounds,
  svgDefs?: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  config?: Partial<EnhancedConnectionConfig>
): EnhancedConnectionManager {
  globalEnhancedManager = new EnhancedConnectionManager(canvasBounds, config)
  
  if (svgDefs) {
    globalEnhancedManager.initializeVisualEffects(svgDefs)
  }
  
  return globalEnhancedManager
}

/**
 * Enhanced version of generateVariantAwareConnectionPath with fallback
 */
export function generateEnhancedVariantAwareConnectionPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string,
  variant: NodeVariant = 'standard',
  enhancedFeatures: boolean = true
): string {
  if (enhancedFeatures && globalEnhancedManager) {
    try {
      return globalEnhancedManager.generateEnhancedConnectionPath(
        sourceNode, sourcePortId, targetNode, targetPortId, 0, 1, variant
      )
    } catch (error) {
      console.warn('Enhanced path generation failed, falling back to standard:', error)
    }
  }

  // Always fallback to original implementation
  return generateVariantAwareConnectionPath(
    sourceNode, sourcePortId, targetNode, targetPortId, variant
  )
}

/**
 * Enhanced version of generateMultipleConnectionPath with fallback
 */
export function generateEnhancedMultipleConnectionPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string,
  connectionIndex: number = 0,
  totalConnections: number = 1,
  variant: NodeVariant = 'standard',
  enhancedFeatures: boolean = true
): string {
  if (enhancedFeatures && globalEnhancedManager) {
    try {
      return globalEnhancedManager.generateEnhancedConnectionPath(
        sourceNode, sourcePortId, targetNode, targetPortId,
        connectionIndex, totalConnections, variant
      )
    } catch (error) {
      console.warn('Enhanced multiple path generation failed, falling back to standard:', error)
    }
  }

  // Always fallback to original implementation
  return generateMultipleConnectionPath(
    sourceNode, sourcePortId, targetNode, targetPortId,
    connectionIndex, totalConnections, variant
  )
}

/**
 * Get the enhanced connection manager instance
 */
export function getEnhancedConnectionManager(): EnhancedConnectionManager | null {
  return globalEnhancedManager
}

/**
 * Check if enhanced features are available
 */
export function isEnhancedConnectionSystemAvailable(): boolean {
  return globalEnhancedManager !== null
}

// Re-export base functions for compatibility
export { 
  generateVariantAwareConnectionPath,
  generateMultipleConnectionPath,
  calculatePortPosition
} from './connection-utils'