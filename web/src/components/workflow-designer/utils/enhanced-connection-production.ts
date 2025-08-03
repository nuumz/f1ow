/**
 * Production-Ready Enhanced Connection System
 * 
 * This module provides a clean, optimized connection system that's ready for production use.
 * It focuses on reliability, performance, and maintainability while providing enhanced features.
 */

import * as d3 from 'd3'
import type { WorkflowNode, Connection, NodeVariant } from '../types'
import { 
  generateVariantAwareConnectionPath, 
  generateMultipleConnectionPath,
  getConnectionGroupInfo
} from './connection-utils'
import { getShapeAwareDimensions, getPortPositions } from './node-utils'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface PortPosition {
  x: number
  y: number
}

export interface ProductionConnectionConfig {
  // Visual enhancements
  enableSmoothing: boolean
  enableAnimation: boolean
  enableHoverEffects: boolean
  
  // Performance
  enableCaching: boolean
  maxCacheSize: number
  
  // Debug (for development)
  enableDebugMode: boolean
}

export interface ConnectionMetrics {
  totalConnections: number
  cachedConnections: number
  renderTime: number
  cacheHitRate: number
}

// ============================================================================
// PRODUCTION CONNECTION MANAGER
// ============================================================================

/**
 * Production-ready connection manager with essential enhancements
 */
export class ProductionConnectionManager {
  private config: ProductionConnectionConfig
  private pathCache = new Map<string, string>()
  private metricsData: ConnectionMetrics
  private isInitialized = false

  constructor(config: Partial<ProductionConnectionConfig> = {}) {
    // Default production configuration
    const defaultConfig: ProductionConnectionConfig = {
      enableSmoothing: true,
      enableAnimation: true,
      enableHoverEffects: true,
      enableCaching: true,
      maxCacheSize: 1000,
      enableDebugMode: process.env.NODE_ENV === 'development'
    }
    
    this.config = { ...defaultConfig, ...config }
    this.metricsData = {
      totalConnections: 0,
      cachedConnections: 0,
      renderTime: 0,
      cacheHitRate: 0
    }

    this.log('Production Connection Manager initialized')
  }

  /**
   * Initialize visual effects with SVG definitions
   */
  initialize(svgDefs: d3.Selection<SVGDefsElement, unknown, null, undefined>): void {
    if (this.isInitialized) return

    try {
      this.createProductionMarkers(svgDefs)
      this.isInitialized = true
      this.log('Visual effects initialized successfully')
    } catch (error) {
      this.logError('Failed to initialize visual effects:', error)
    }
  }

  /**
   * Generate enhanced connection path with fallback
   */
  generateConnectionPath(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string,
    connectionIndex: number = 0,
    totalConnections: number = 1,
    variant: NodeVariant = 'standard'
  ): string {
    const startTime = performance.now()
    
    try {
      // Create cache key
      const cacheKey = this.createCacheKey(
        sourceNode.id, sourcePortId, targetNode.id, targetPortId, 
        connectionIndex, totalConnections, variant
      )

      // Check cache first
      if (this.config.enableCaching && this.pathCache.has(cacheKey)) {
        const cachedPath = this.pathCache.get(cacheKey)!
        this.updateMetrics(performance.now() - startTime, true)
        return cachedPath
      }

      let path: string

      // Generate path based on connection count
      if (totalConnections > 1) {
        path = this.generateEnhancedMultiplePath(
          sourceNode, sourcePortId, targetNode, targetPortId,
          connectionIndex, totalConnections, variant
        )
      } else {
        path = this.generateEnhancedSinglePath(
          sourceNode, sourcePortId, targetNode, targetPortId, variant
        )
      }

      // Cache the result
      if (this.config.enableCaching) {
        this.cacheResult(cacheKey, path)
      }

      this.updateMetrics(performance.now() - startTime, false)
      return path

    } catch (error) {
      this.logError('Failed to generate enhanced path, falling back to standard:', error)
      
      // Fallback to standard path generation
      return this.generateFallbackPath(
        sourceNode, sourcePortId, targetNode, targetPortId,
        connectionIndex, totalConnections, variant
      )
    }
  }

  /**
   * Apply enhanced visual effects
   */
  applyEnhancedEffects(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    pathElement: SVGPathElement,
    effectType: 'hover' | 'selected' | 'default' = 'default'
  ): void {
    if (!this.isInitialized || !this.config.enableHoverEffects) return

    try {
      const pathSelection = d3.select(pathElement)
      
      switch (effectType) {
        case 'hover':
          pathSelection
            .transition()
            .duration(200)
            .attr('stroke-width', 3)
            .attr('stroke', '#2196F3')
            .style('filter', 'drop-shadow(0 0 4px rgba(33, 150, 243, 0.5))')
          break
          
        case 'selected':
          pathSelection
            .attr('stroke-width', 3)
            .attr('stroke', '#4CAF50')
            .style('filter', 'drop-shadow(0 0 6px rgba(76, 175, 80, 0.6))')
          break
          
        default:
          pathSelection
            .transition()
            .duration(200)
            .attr('stroke-width', 2)
            .attr('stroke', 'white')
            .style('filter', null)
          break
      }
    } catch (error) {
      this.logError('Failed to apply enhanced effects:', error)
    }
  }

  /**
   * Animate connection drawing
   */
  async animateConnectionDrawing(pathElement: SVGPathElement): Promise<void> {
    if (!this.config.enableAnimation) return

    try {
      const totalLength = pathElement.getTotalLength()
      
      d3.select(pathElement)
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(600)
        .ease(d3.easeQuadOut)
        .attr('stroke-dashoffset', 0)
        .on('end', () => {
          d3.select(pathElement)
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)
        })
    } catch (error) {
      this.logError('Failed to animate connection:', error)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ProductionConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.log('Configuration updated:', newConfig)
  }

  /**
   * Get performance metrics
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metricsData }
  }

  /**
   * Clear cache and reset metrics
   */
  performMaintenance(): void {
    const cacheSize = this.pathCache.size
    
    if (cacheSize > this.config.maxCacheSize) {
      // Keep only the most recently used entries
      const entries = Array.from(this.pathCache.entries())
      const keepCount = Math.floor(this.config.maxCacheSize * 0.8)
      const entriesToKeep = entries.slice(-keepCount)
      
      this.pathCache.clear()
      entriesToKeep.forEach(([key, value]) => this.pathCache.set(key, value))
      
      this.log(`Cache cleaned: ${cacheSize} -> ${this.pathCache.size} entries`)
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.pathCache.clear()
    this.log('Production Connection Manager disposed')
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateEnhancedSinglePath(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string,
    variant: NodeVariant
  ): string {
    // Use enhanced smoothing if enabled
    if (this.config.enableSmoothing) {
      return this.generateSmoothPath(sourceNode, sourcePortId, targetNode, targetPortId, variant)
    }
    
    // Fallback to standard path
    return generateVariantAwareConnectionPath(
      sourceNode, sourcePortId, targetNode, targetPortId, variant
    )
  }

  private generateEnhancedMultiplePath(
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

    // Apply smoothing enhancement if enabled
    if (this.config.enableSmoothing) {
      return this.enhancePathSmoothing(basePath)
    }

    return basePath
  }

  private generateSmoothPath(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string,
    variant: NodeVariant
  ): string {
    const sourcePos = this.calculatePortPosition(sourceNode, sourcePortId, variant)
    const targetPos = this.calculatePortPosition(targetNode, targetPortId, variant)

    const dx = targetPos.x - sourcePos.x
    const dy = targetPos.y - sourcePos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Calculate enhanced control points with better curves
    const controlDistance = Math.max(distance * 0.4, 80)
    const cp1x = sourcePos.x + controlDistance
    const cp1y = sourcePos.y + dy * 0.1
    const cp2x = targetPos.x - controlDistance
    const cp2y = targetPos.y - dy * 0.1

    // Adjust target for arrow
    const arrowOffset = 7
    const offsetRatio = distance > 0 ? arrowOffset / distance : 0
    const adjustedTargetX = targetPos.x - (dx * offsetRatio)
    const adjustedTargetY = targetPos.y - (dy * offsetRatio)

    return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${adjustedTargetX} ${adjustedTargetY}`
  }

  private enhancePathSmoothing(path: string): string {
    // Simple path enhancement - increase curve smoothness
    try {
      return path.replace(/C\s*([^C]+)/g, (match, coords) => {
        const numbers = coords.trim().split(/\s+/).map(Number)
        if (numbers.length >= 6) {
          const [cp1x, cp1y, cp2x, cp2y, x, y] = numbers
          // Slightly adjust control points for smoother curves
          const enhancedCp1x = cp1x * 1.05
          const enhancedCp2x = cp2x * 1.05
          return `C ${enhancedCp1x} ${cp1y} ${enhancedCp2x} ${cp2y} ${x} ${y}`
        }
        return match
      })
    } catch (error) {
      this.logError('Failed to enhance path smoothing:', error)
      return path
    }
  }

  private calculatePortPosition(
    node: WorkflowNode,
    portId: string,
    variant: NodeVariant = 'standard'
  ): PortPosition {
    const nodeX = node.x
    const nodeY = node.y

    // Check for bottom ports first
    if (node.bottomPorts) {
      const bottomPort = node.bottomPorts.find(p => p.id === portId)
      if (bottomPort) {
        const bottomPortIndex = node.bottomPorts.indexOf(bottomPort)
        const dimensions = getShapeAwareDimensions(node)
        const nodeWidth = dimensions.width || 200
        const nodeHeight = dimensions.height || 80
        const portCount = node.bottomPorts.length
        
        const scale = variant === 'compact' ? 0.8 : 1
        const usableWidth = Math.min(nodeWidth * 0.8, nodeWidth - 70)
        
        let relativeX = 0
        if (portCount === 1) {
          relativeX = 0
        } else if (portCount === 2) {
          const spacing = usableWidth / 3
          relativeX = bottomPortIndex === 0 ? -spacing : spacing
        } else if (portCount === 3) {
          const halfWidth = usableWidth / 2
          const positions = [-halfWidth, 0, halfWidth]
          relativeX = positions[bottomPortIndex] || 0
        } else {
          const spacing = usableWidth / (portCount - 1)
          relativeX = -usableWidth / 2 + spacing * bottomPortIndex
        }
        
        return {
          x: nodeX + (relativeX * scale),
          y: nodeY + ((nodeHeight / 2) * scale)
        }
      }
    }

    // Regular input/output ports
    const isOutputPort = node.outputs.some(p => p.id === portId)
    const ports = isOutputPort ? node.outputs : node.inputs
    const port = ports.find(p => p.id === portId)
    const portIndex = port ? ports.indexOf(port) : 0

    const portType = isOutputPort ? 'output' : 'input'
    const portPositions = getPortPositions(node, portType)
    const portPosition = portPositions[portIndex] || { x: 0, y: 0 }

    const scale = variant === 'compact' ? 0.8 : 1
    
    return {
      x: nodeX + (portPosition.x * scale),
      y: nodeY + (portPosition.y * scale)
    }
  }

  private generateFallbackPath(
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string,
    connectionIndex: number,
    totalConnections: number,
    variant: NodeVariant
  ): string {
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
    } catch (error) {
      this.logError('Fallback path generation failed:', error)
      return `M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`
    }
  }

  private createProductionMarkers(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>): void {
    // Enhanced arrow marker
    const arrow = defs.append('marker')
      .attr('id', 'production-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 3)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')

    arrow.append('path')
      .attr('d', 'M0,0 L0,6 L9,3 z')
      .attr('fill', 'white')
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5)

    // Glow filter for hover effects
    const filter = defs.append('filter')
      .attr('id', 'production-glow')
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
  }

  private createCacheKey(
    sourceId: string, sourcePortId: string,
    targetId: string, targetPortId: string,
    index: number, total: number, variant: NodeVariant
  ): string {
    return `${sourceId}-${sourcePortId}-${targetId}-${targetPortId}-${index}-${total}-${variant}`
  }

  private cacheResult(key: string, path: string): void {
    if (this.pathCache.size >= this.config.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.pathCache.keys().next().value
      if (firstKey) {
        this.pathCache.delete(firstKey)
      }
    }
    this.pathCache.set(key, path)
  }

  private updateMetrics(renderTime: number, cacheHit: boolean): void {
    this.metricsData.totalConnections++
    this.metricsData.renderTime = renderTime
    
    if (cacheHit) {
      this.metricsData.cachedConnections++
    }
    
    this.metricsData.cacheHitRate = 
      (this.metricsData.cachedConnections / this.metricsData.totalConnections) * 100
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.enableDebugMode) {
      console.log(`[ProductionConnectionManager] ${message}`, ...args)
    }
  }

  private logError(message: string, error: any): void {
    if (this.config.enableDebugMode) {
      console.error(`[ProductionConnectionManager] ${message}`, error)
    }
  }
}

// ============================================================================
// GLOBAL INSTANCE AND HELPER FUNCTIONS
// ============================================================================

let globalProductionManager: ProductionConnectionManager | null = null

/**
 * Initialize the production connection system
 */
export function initializeProductionConnections(
  svgDefs?: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  config?: Partial<ProductionConnectionConfig>
): ProductionConnectionManager {
  globalProductionManager = new ProductionConnectionManager(config)
  
  if (svgDefs) {
    globalProductionManager.initialize(svgDefs)
  }
  
  return globalProductionManager
}

/**
 * Enhanced connection path generation with production reliability
 */
export function generateProductionConnectionPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string,
  connectionIndex: number = 0,
  totalConnections: number = 1,
  variant: NodeVariant = 'standard',
  useEnhanced: boolean = true
): string {
  if (useEnhanced && globalProductionManager) {
    return globalProductionManager.generateConnectionPath(
      sourceNode, sourcePortId, targetNode, targetPortId,
      connectionIndex, totalConnections, variant
    )
  }

  // Fallback to standard implementation
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
}

/**
 * Get the global production manager instance
 */
export function getProductionConnectionManager(): ProductionConnectionManager | null {
  return globalProductionManager
}

/**
 * Apply production-ready visual effects
 */
export function applyProductionEffects(
  connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
  pathElement: SVGPathElement,
  effectType: 'hover' | 'selected' | 'default' = 'default'
): void {
  if (globalProductionManager) {
    globalProductionManager.applyEnhancedEffects(connectionElement, pathElement, effectType)
  }
}

/**
 * Animate connection drawing with production settings
 */
export async function animateProductionConnection(pathElement: SVGPathElement): Promise<void> {
  if (globalProductionManager) {
    await globalProductionManager.animateConnectionDrawing(pathElement)
  }
}

// Export types for external use
export type {
  ProductionConnectionConfig,
  ConnectionMetrics,
  PortPosition
}