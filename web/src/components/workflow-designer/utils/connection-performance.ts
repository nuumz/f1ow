/**
 * Performance Optimization System for Workflow Connections
 * 
 * Features:
 * - Viewport-based connection culling
 * - Intelligent path caching with memoization
 * - Canvas rendering for high-density connections
 * - Level-of-detail (LOD) rendering
 * - Batch update optimization
 * - Memory management and cleanup
 */

import * as d3 from 'd3'
import type { WorkflowNode, Connection, PortPosition } from '../types'
import type { ConnectionPath } from './advanced-path-algorithms'

// ============================================================================
// PERFORMANCE TYPES AND INTERFACES
// ============================================================================

export interface ViewportBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export interface ConnectionCache {
  pathData: string
  lastUpdated: number
  complexity: number
  renderLevel: 'high' | 'medium' | 'low'
}

export interface PerformanceMetrics {
  visibleConnections: number
  cachedConnections: number
  renderTime: number
  updateTime: number
  memoryUsage: number
  frameRate: number
}

export interface RenderingConfig {
  enableCulling: boolean
  enableCaching: boolean
  useCanvasForHighDensity: boolean
  maxCachedPaths: number
  cullingMargin: number
  lodThreshold: number
  batchSize: number
}

// ============================================================================
// VIEWPORT CULLING SYSTEM
// ============================================================================

/**
 * Efficient viewport-based culling for connections
 */
export class ViewportCullingEngine {
  private viewportBounds: ViewportBounds
  private cullingMargin: number

  constructor(viewportBounds: ViewportBounds, cullingMargin: number = 100) {
    this.viewportBounds = viewportBounds
    this.cullingMargin = cullingMargin
  }

  /**
   * Update viewport bounds for culling calculations
   */
  updateViewport(bounds: ViewportBounds): void {
    this.viewportBounds = bounds
  }

  /**
   * Check if a connection should be rendered based on viewport visibility
   */
  shouldRenderConnection(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    zoomLevel: number = 1
  ): boolean {
    const margin = this.cullingMargin / zoomLevel

    // Expand viewport bounds with margin
    const expandedBounds = {
      minX: this.viewportBounds.minX - margin,
      minY: this.viewportBounds.minY - margin,
      maxX: this.viewportBounds.maxX + margin,
      maxY: this.viewportBounds.maxY + margin
    }

    // Check if either node is visible
    const sourceVisible = this.isNodeInBounds(sourceNode, expandedBounds)
    const targetVisible = this.isNodeInBounds(targetNode, expandedBounds)

    // Render if either node is visible or connection crosses viewport
    if (sourceVisible || targetVisible) {
      return true
    }

    // Check if connection line crosses the viewport
    return this.doesConnectionCrossViewport(sourceNode, targetNode, expandedBounds)
  }

  /**
   * Get all visible connections from a list
   */
  getVisibleConnections(
    connections: Connection[],
    nodeMap: Map<string, WorkflowNode>,
    zoomLevel: number = 1
  ): Connection[] {
    return connections.filter(connection => {
      const sourceNode = nodeMap.get(connection.sourceNodeId)
      const targetNode = nodeMap.get(connection.targetNodeId)

      if (!sourceNode || !targetNode) return false

      return this.shouldRenderConnection(sourceNode, targetNode, zoomLevel)
    })
  }

  /**
   * Calculate level of detail based on zoom and distance
   */
  calculateLevelOfDetail(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    zoomLevel: number
  ): 'high' | 'medium' | 'low' {
    const distance = Math.sqrt(
      Math.pow(targetNode.x - sourceNode.x, 2) +
      Math.pow(targetNode.y - sourceNode.y, 2)
    )

    const scaledDistance = distance * zoomLevel

    if (zoomLevel < 0.5 || scaledDistance > 1000) {
      return 'low'
    } else if (zoomLevel < 1.0 || scaledDistance > 500) {
      return 'medium'
    } else {
      return 'high'
    }
  }

  /**
   * Check if a node is within bounds
   */
  private isNodeInBounds(node: WorkflowNode, bounds: ViewportBounds): boolean {
    const nodeWidth = 200 // Approximate node width
    const nodeHeight = 80  // Approximate node height

    return !(
      node.x + nodeWidth / 2 < bounds.minX ||
      node.x - nodeWidth / 2 > bounds.maxX ||
      node.y + nodeHeight / 2 < bounds.minY ||
      node.y - nodeHeight / 2 > bounds.maxY
    )
  }

  /**
   * Check if connection line crosses the viewport
   */
  private doesConnectionCrossViewport(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    bounds: ViewportBounds
  ): boolean {
    // Simple line-rectangle intersection test
    return this.lineIntersectsRect(
      sourceNode.x, sourceNode.y,
      targetNode.x, targetNode.y,
      bounds.minX, bounds.minY,
      bounds.maxX, bounds.maxY
    )
  }

  /**
   * Line-rectangle intersection algorithm
   */
  private lineIntersectsRect(
    x1: number, y1: number, x2: number, y2: number,
    rectX1: number, rectY1: number, rectX2: number, rectY2: number
  ): boolean {
    // Check if line endpoints are on opposite sides of any rectangle edge
    const left = (x1 < rectX1 && x2 < rectX1)
    const right = (x1 > rectX2 && x2 > rectX2)
    const top = (y1 < rectY1 && y2 < rectY1)
    const bottom = (y1 > rectY2 && y2 > rectY2)

    // If line is completely outside rectangle on any side
    if (left || right || top || bottom) {
      return false
    }

    return true
  }
}

// ============================================================================
// PATH CACHING SYSTEM
// ============================================================================

/**
 * Intelligent caching system for connection paths
 */
export class ConnectionPathCache {
  private cache = new Map<string, ConnectionCache>()
  private readonly maxCacheSize: number
  private readonly cacheExpiry: number // milliseconds

  constructor(maxCacheSize: number = 1000, cacheExpiry: number = 5 * 60 * 1000) {
    this.maxCacheSize = maxCacheSize
    this.cacheExpiry = cacheExpiry
  }

  /**
   * Generate cache key for a connection
   */
  private generateCacheKey(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    sourcePort?: PortPosition,
    targetPort?: PortPosition,
    variant?: string
  ): string {
    const sourcePos = sourcePort ? `${sourcePort.x},${sourcePort.y}` : `${sourceNode.x},${sourceNode.y}`
    const targetPos = targetPort ? `${targetPort.x},${targetPort.y}` : `${targetNode.x},${targetNode.y}`
    const variantStr = variant || 'standard'

    return `${sourceNode.id}-${targetNode.id}-${sourcePos}-${targetPos}-${variantStr}`
  }

  /**
   * Get cached path if available and valid
   */
  getCachedPath(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    sourcePort?: PortPosition,
    targetPort?: PortPosition,
    variant?: string
  ): ConnectionCache | null {
    const key = this.generateCacheKey(sourceNode, targetNode, sourcePort, targetPort, variant)
    const cached = this.cache.get(key)

    if (!cached) return null

    // Check if cache entry has expired
    if (Date.now() - cached.lastUpdated > this.cacheExpiry) {
      this.cache.delete(key)
      return null
    }

    return cached
  }

  /**
   * Cache a connection path
   */
  setCachedPath(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    pathData: string,
    renderLevel: 'high' | 'medium' | 'low',
    sourcePort?: PortPosition,
    targetPort?: PortPosition,
    variant?: string
  ): void {
    const key = this.generateCacheKey(sourceNode, targetNode, sourcePort, targetPort, variant)

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntries(Math.floor(this.maxCacheSize * 0.2)) // Remove 20% of cache
    }

    const complexity = this.calculatePathComplexity(pathData)

    this.cache.set(key, {
      pathData,
      lastUpdated: Date.now(),
      complexity,
      renderLevel
    })
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredEntries(): number {
    const now = Date.now()
    let removedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastUpdated > this.cacheExpiry) {
        this.cache.delete(key)
        removedCount++
      }
    }

    return removedCount
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number
    maxSize: number
    hitRate: number
    memoryUsage: number
  } {
    const memoryUsage = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.pathData.length * 2, 0) // Rough estimate

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0, // Would need hit/miss tracking for accurate calculation
      memoryUsage
    }
  }

  /**
   * Calculate complexity of a path for caching priority
   */
  private calculatePathComplexity(pathData: string): number {
    // Count number of curve commands and points
    const curveCommands = (pathData.match(/[CQS]/g) || []).length
    const points = (pathData.match(/[\d.-]+/g) || []).length / 2

    return curveCommands * 2 + points
  }

  /**
   * Remove oldest cache entries
   */
  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastUpdated - b.lastUpdated)

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.cache.delete(entries[i][0])
    }
  }

  /**
   * Clear all cached paths
   */
  clear(): void {
    this.cache.clear()
  }
}

// ============================================================================
// CANVAS RENDERER FOR HIGH-DENSITY CONNECTIONS
// ============================================================================

/**
 * Canvas-based renderer for high-performance connection rendering
 */
export class CanvasConnectionRenderer {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private devicePixelRatio: number

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')!
    this.devicePixelRatio = window.devicePixelRatio || 1

    this.setupCanvas(width, height)
  }

  /**
   * Setup canvas with proper scaling for high-DPI displays
   */
  private setupCanvas(width: number, height: number): void {
    const scaledWidth = width * this.devicePixelRatio
    const scaledHeight = height * this.devicePixelRatio

    this.canvas.width = scaledWidth
    this.canvas.height = scaledHeight
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    this.context.scale(this.devicePixelRatio, this.devicePixelRatio)
    this.context.imageSmoothingEnabled = true
    this.context.imageSmoothingQuality = 'high'
  }

  /**
   * Render multiple connections efficiently on canvas
   */
  renderConnections(
    connections: ConnectionPath[],
    transform: { x: number; y: number; k: number }
  ): void {
    this.context.save()
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Apply transform
    this.context.translate(transform.x, transform.y)
    this.context.scale(transform.k, transform.k)

    // Set default styles
    this.context.lineWidth = 2
    this.context.strokeStyle = '#ffffff'
    this.context.lineCap = 'round'
    this.context.lineJoin = 'round'

    // Batch render connections by style for efficiency
    const connectionsByStyle = this.groupConnectionsByStyle(connections)

    for (const [style, styleConnections] of connectionsByStyle) {
      this.applyStyle(style)
      this.context.beginPath()

      for (const connection of styleConnections) {
        this.addPathToContext(connection.pathData)
      }

      this.context.stroke()
    }

    this.context.restore()
  }

  /**
   * Group connections by rendering style for batching
   */
  private groupConnectionsByStyle(connections: ConnectionPath[]): Map<string, ConnectionPath[]> {
    const grouped = new Map<string, ConnectionPath[]>()

    for (const connection of connections) {
      const style = this.getConnectionStyle(connection)
      const styleKey = JSON.stringify(style)

      if (!grouped.has(styleKey)) {
        grouped.set(styleKey, [])
      }

      grouped.get(styleKey)!.push(connection)
    }

    return grouped
  }

  /**
   * Get rendering style for a connection
   */
  private getConnectionStyle(connection: ConnectionPath): {
    strokeStyle: string
    lineWidth: number
    lineDash?: number[]
  } {
    // Default style
    return {
      strokeStyle: '#ffffff',
      lineWidth: 2
    }
  }

  /**
   * Apply style to canvas context
   */
  private applyStyle(styleStr: string): void {
    const style = JSON.parse(styleStr)
    this.context.strokeStyle = style.strokeStyle
    this.context.lineWidth = style.lineWidth

    if (style.lineDash) {
      this.context.setLineDash(style.lineDash)
    } else {
      this.context.setLineDash([])
    }
  }

  /**
   * Add SVG path to canvas context
   */
  private addPathToContext(pathData: string): void {
    // Simple SVG path parser for basic M, L, C commands
    const commands = pathData.match(/[MLC]\s*[\d.-]+(\s*[\d.-]+)*/g) || []

    for (const command of commands) {
      const type = command.charAt(0)
      const coords = command.slice(1).trim().split(/\s+/).map(Number)

      switch (type) {
        case 'M':
          if (coords.length >= 2) {
            this.context.moveTo(coords[0], coords[1])
          }
          break
        case 'L':
          if (coords.length >= 2) {
            this.context.lineTo(coords[0], coords[1])
          }
          break
        case 'C':
          if (coords.length >= 6) {
            this.context.bezierCurveTo(
              coords[0], coords[1], coords[2], coords[3], coords[4], coords[5]
            )
          }
          break
      }
    }
  }

  /**
   * Get canvas element for DOM insertion
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.setupCanvas(width, height)
  }

  /**
   * Clear canvas
   */
  clear(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * Dispose of canvas resources
   */
  dispose(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.canvas.remove()
  }
}

// ============================================================================
// BATCH UPDATE SYSTEM
// ============================================================================

/**
 * Batch update system for efficient DOM manipulation
 */
export class BatchUpdateManager {
  private updateQueue = new Map<string, () => void>()
  private isProcessing = false
  private batchSize: number
  private frameId: number | null = null

  constructor(batchSize: number = 50) {
    this.batchSize = batchSize
  }

  /**
   * Queue an update operation
   */
  queueUpdate(key: string, updateFn: () => void): void {
    this.updateQueue.set(key, updateFn)

    if (!this.isProcessing) {
      this.scheduleProcessing()
    }
  }

  /**
   * Schedule batch processing on next animation frame
   */
  private scheduleProcessing(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
    }

    this.frameId = requestAnimationFrame(() => {
      this.processBatch()
    })
  }

  /**
   * Process queued updates in batches
   */
  private processBatch(): void {
    this.isProcessing = true
    const updates = Array.from(this.updateQueue.values())
    this.updateQueue.clear()

    // Process updates in chunks to avoid blocking the main thread
    const processChunk = (startIndex: number) => {
      const endIndex = Math.min(startIndex + this.batchSize, updates.length)

      for (let i = startIndex; i < endIndex; i++) {
        try {
          updates[i]()
        } catch (error) {
          console.warn('Batch update error:', error)
        }
      }

      if (endIndex < updates.length) {
        // More updates to process, schedule next chunk
        requestAnimationFrame(() => processChunk(endIndex))
      } else {
        // All updates processed
        this.isProcessing = false

        // Check if new updates were queued during processing
        if (this.updateQueue.size > 0) {
          this.scheduleProcessing()
        }
      }
    }

    if (updates.length > 0) {
      processChunk(0)
    } else {
      this.isProcessing = false
    }
  }

  /**
   * Cancel all pending updates
   */
  cancelAll(): void {
    this.updateQueue.clear()
    this.isProcessing = false

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.updateQueue.size
  }
}

// ============================================================================
// MAIN PERFORMANCE MANAGER
// ============================================================================

/**
 * Main performance management system that coordinates all optimizations
 */
export class ConnectionPerformanceManager {
  private cullingEngine: ViewportCullingEngine
  private pathCache: ConnectionPathCache
  private canvasRenderer: CanvasConnectionRenderer | null = null
  private batchManager: BatchUpdateManager
  private config: RenderingConfig
  private metrics: PerformanceMetrics

  // Performance monitoring
  private lastFrameTime = 0
  private frameCount = 0
  private performanceObserver: PerformanceObserver | null = null

  constructor(
    viewportBounds: ViewportBounds,
    config: Partial<RenderingConfig> = {}
  ) {
    const defaultConfig: RenderingConfig = {
      enableCulling: true,
      enableCaching: true,
      useCanvasForHighDensity: true,
      maxCachedPaths: 1000,
      cullingMargin: 100,
      lodThreshold: 0.5,
      batchSize: 50
    }

    this.config = { ...defaultConfig, ...config }
    this.cullingEngine = new ViewportCullingEngine(viewportBounds, this.config.cullingMargin)
    this.pathCache = new ConnectionPathCache(this.config.maxCachedPaths)
    this.batchManager = new BatchUpdateManager(this.config.batchSize)

    this.metrics = {
      visibleConnections: 0,
      cachedConnections: 0,
      renderTime: 0,
      updateTime: 0,
      memoryUsage: 0,
      frameRate: 0
    }

    this.initializePerformanceMonitoring()
  }

  /**
   * Update viewport for culling calculations
   */
  updateViewport(bounds: ViewportBounds): void {
    this.cullingEngine.updateViewport(bounds)
  }

  /**
   * Get optimized connection list based on performance settings
   */
  getOptimizedConnections(
    connections: Connection[],
    nodeMap: Map<string, WorkflowNode>,
    zoomLevel: number
  ): {
    visible: Connection[]
    renderLevel: Map<string, 'high' | 'medium' | 'low'>
    useCanvas: boolean
  } {
    const startTime = performance.now()

    let visibleConnections = connections
    const renderLevel = new Map<string, 'high' | 'medium' | 'low'>()

    // Apply viewport culling if enabled
    if (this.config.enableCulling) {
      visibleConnections = this.cullingEngine.getVisibleConnections(
        connections,
        nodeMap,
        zoomLevel
      )
    }

    // Calculate level of detail for each visible connection
    for (const connection of visibleConnections) {
      const sourceNode = nodeMap.get(connection.sourceNodeId)
      const targetNode = nodeMap.get(connection.targetNodeId)

      if (sourceNode && targetNode) {
        const lod = this.cullingEngine.calculateLevelOfDetail(sourceNode, targetNode, zoomLevel)
        renderLevel.set(connection.id, lod)
      }
    }

    // Determine if canvas rendering should be used
    const useCanvas = this.config.useCanvasForHighDensity && 
                     visibleConnections.length > 100 && 
                     zoomLevel < this.config.lodThreshold

    // Update metrics
    this.metrics.visibleConnections = visibleConnections.length
    this.metrics.updateTime = performance.now() - startTime

    return {
      visible: visibleConnections,
      renderLevel,
      useCanvas
    }
  }

  /**
   * Get cached path or generate new one
   */
  getOrGeneratePath(
    connection: Connection,
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    pathGenerator: () => string,
    renderLevel: 'high' | 'medium' | 'low' = 'high'
  ): string {
    if (!this.config.enableCaching) {
      return pathGenerator()
    }

    const cached = this.pathCache.getCachedPath(sourceNode, targetNode)

    if (cached && cached.renderLevel === renderLevel) {
      return cached.pathData
    }

    const pathData = pathGenerator()
    this.pathCache.setCachedPath(sourceNode, targetNode, pathData, renderLevel)

    return pathData
  }

  /**
   * Queue a connection update for batch processing
   */
  queueConnectionUpdate(connectionId: string, updateFn: () => void): void {
    this.batchManager.queueUpdate(connectionId, updateFn)
  }

  /**
   * Initialize canvas renderer for high-density rendering
   */
  initializeCanvasRenderer(width: number, height: number): HTMLCanvasElement | null {
    if (!this.config.useCanvasForHighDensity) {
      return null
    }

    this.canvasRenderer = new CanvasConnectionRenderer(width, height)
    return this.canvasRenderer.getCanvas()
  }

  /**
   * Render connections on canvas
   */
  renderOnCanvas(
    connections: ConnectionPath[],
    transform: { x: number; y: number; k: number }
  ): void {
    if (!this.canvasRenderer) {
      return
    }

    const startTime = performance.now()
    this.canvasRenderer.renderConnections(connections, transform)
    this.metrics.renderTime = performance.now() - startTime
  }

  /**
   * Perform maintenance tasks (cache cleanup, etc.)
   */
  performMaintenance(): void {
    const removedEntries = this.pathCache.clearExpiredEntries()
    const cacheStats = this.pathCache.getCacheStats()

    this.metrics.cachedConnections = cacheStats.size
    this.metrics.memoryUsage = cacheStats.memoryUsage

    if (removedEntries > 0) {
      console.log(`🧹 Cleaned up ${removedEntries} expired cache entries`)
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RenderingConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Update sub-systems
    this.batchManager = new BatchUpdateManager(this.config.batchSize)
    this.pathCache = new ConnectionPathCache(this.config.maxCachedPaths)
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            // Track custom performance measurements
          }
        }
      })

      this.performanceObserver.observe({ entryTypes: ['measure'] })
    }

    // Simple frame rate monitoring
    const measureFrameRate = () => {
      const now = performance.now()
      this.frameCount++

      if (now - this.lastFrameTime >= 1000) {
        this.metrics.frameRate = this.frameCount
        this.frameCount = 0
        this.lastFrameTime = now
      }

      requestAnimationFrame(measureFrameRate)
    }

    measureFrameRate()
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.batchManager.cancelAll()
    this.pathCache.clear()
    this.canvasRenderer?.dispose()

    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
    }
  }
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Utility functions for performance optimization
 */
export class PerformanceUtils {
  /**
   * Debounce function for expensive operations
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null

    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => func(...args), wait)
    }
  }

  /**
   * Throttle function for frequent operations
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => { inThrottle = false }, limit)
      }
    }
  }

  /**
   * Memory usage estimation for objects
   */
  static estimateMemoryUsage(obj: any): number {
    const seen = new WeakSet()

    function sizeOf(obj: any): number {
      if (obj === null || obj === undefined) return 0
      if (typeof obj === 'boolean') return 4
      if (typeof obj === 'number') return 8
      if (typeof obj === 'string') return obj.length * 2
      if (typeof obj === 'object') {
        if (seen.has(obj)) return 0
        seen.add(obj)

        let size = 0
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            size += sizeOf(key) + sizeOf(obj[key])
          }
        }
        return size
      }
      return 0
    }

    return sizeOf(obj)
  }

  /**
   * Check if device supports high performance features
   */
  static getDeviceCapabilities(): {
    highDPI: boolean
    webGL: boolean
    hardwareAcceleration: boolean
    maxCanvasSize: number
    memoryLimit: number
  } {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!

    // Check for WebGL support
    let webGL = false
    try {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      webGL = !!gl
    } catch (e) {
      webGL = false
    }

    return {
      highDPI: window.devicePixelRatio > 1,
      webGL,
      hardwareAcceleration: context.imageSmoothingEnabled,
      maxCanvasSize: 4096, // Conservative estimate
      memoryLimit: (navigator as any).deviceMemory || 4 // GB estimate
    }
  }
}