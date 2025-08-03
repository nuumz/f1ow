/**
 * Professional Visual Effects for Workflow Connections
 * 
 * Features:
 * - Advanced SVG markers and arrowheads
 * - Dynamic connection labels and badges
 * - Professional hover and selection effects
 * - Gradient and pattern fills
 * - Shadow and glow effects
 * - Connection status indicators
 * - Data flow animations
 */

import * as d3 from 'd3'
import type { Connection, WorkflowNode } from '../types'

// ============================================================================
// VISUAL EFFECT TYPES
// ============================================================================

export interface MarkerConfig {
  id: string
  type: 'arrow' | 'circle' | 'diamond' | 'triangle' | 'custom'
  size: number
  color: string
  outline?: boolean
  outlineColor?: string
  outlineWidth?: number
}

export interface ConnectionLabelConfig {
  text: string
  position: 'start' | 'middle' | 'end' | number // number for custom position (0-1)
  style: {
    fontSize: number
    fontFamily: string
    color: string
    backgroundColor?: string
    padding?: number
    borderRadius?: number
  }
  offset?: { x: number; y: number }
}

export interface VisualEffectConfig {
  shadow: boolean
  glow: boolean
  gradient: boolean
  animation: 'none' | 'pulse' | 'flow' | 'dash' | 'wave'
  strokePattern: 'solid' | 'dashed' | 'dotted' | 'custom'
  customDashArray?: number[]
}

export interface ConnectionTheme {
  default: VisualEffectConfig
  hover: VisualEffectConfig
  selected: VisualEffectConfig
  active: VisualEffectConfig
  error: VisualEffectConfig
  success: VisualEffectConfig
}

// ============================================================================
// ADVANCED MARKER SYSTEM
// ============================================================================

/**
 * Professional marker system for connection endpoints
 */
export class AdvancedMarkerSystem {
  private defs: d3.Selection<SVGDefsElement, unknown, null, undefined>
  private markerCache = new Map<string, MarkerConfig>()

  constructor(svgDefs: d3.Selection<SVGDefsElement, unknown, null, undefined>) {
    this.defs = svgDefs
    this.initializeDefaultMarkers()
  }

  /**
   * Create professional arrow markers with various styles
   */
  createArrowMarker(config: MarkerConfig): void {
    const { id, size, color, outline, outlineColor, outlineWidth } = config

    const marker = this.defs.append('marker')
      .attr('id', id)
      .attr('markerWidth', size * 1.5)
      .attr('markerHeight', size * 1.5)
      .attr('refX', size - 1)
      .attr('refY', size / 2)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('overflow', 'visible')

    // Create arrow path with professional styling
    const arrowPath = `M 0 0 L ${size} ${size/2} L 0 ${size} L ${size/4} ${size/2} Z`

    if (outline) {
      // Add outline for better visibility
      marker.append('path')
        .attr('d', arrowPath)
        .attr('fill', outlineColor || '#000000')
        .attr('stroke', outlineColor || '#000000')
        .attr('stroke-width', (outlineWidth || 1) + 1)
        .attr('stroke-linejoin', 'round')
    }

    marker.append('path')
      .attr('d', arrowPath)
      .attr('fill', color)
      .attr('stroke', color)
      .attr('stroke-width', 0.5)
      .attr('stroke-linejoin', 'round')

    this.markerCache.set(id, config)
  }

  /**
   * Create circular markers for special connection types
   */
  createCircleMarker(config: MarkerConfig): void {
    const { id, size, color, outline, outlineColor, outlineWidth } = config

    const marker = this.defs.append('marker')
      .attr('id', id)
      .attr('markerWidth', size * 2)
      .attr('markerHeight', size * 2)
      .attr('refX', size)
      .attr('refY', size)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    if (outline) {
      marker.append('circle')
        .attr('cx', size)
        .attr('cy', size)
        .attr('r', size + (outlineWidth || 1))
        .attr('fill', outlineColor || '#000000')
    }

    marker.append('circle')
      .attr('cx', size)
      .attr('cy', size)
      .attr('r', size)
      .attr('fill', color)
      .attr('stroke', outline ? (outlineColor || '#000000') : 'none')
      .attr('stroke-width', outline ? (outlineWidth || 1) : 0)

    this.markerCache.set(id, config)
  }

  /**
   * Create diamond markers for decision points
   */
  createDiamondMarker(config: MarkerConfig): void {
    const { id, size, color, outline, outlineColor, outlineWidth } = config

    const marker = this.defs.append('marker')
      .attr('id', id)
      .attr('markerWidth', size * 2)
      .attr('markerHeight', size * 2)
      .attr('refX', size)
      .attr('refY', size)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    const diamondPath = `M ${size} 0 L ${size * 2} ${size} L ${size} ${size * 2} L 0 ${size} Z`

    if (outline) {
      marker.append('path')
        .attr('d', diamondPath)
        .attr('fill', outlineColor || '#000000')
        .attr('stroke', outlineColor || '#000000')
        .attr('stroke-width', (outlineWidth || 1) + 1)
    }

    marker.append('path')
      .attr('d', diamondPath)
      .attr('fill', color)
      .attr('stroke', outline ? (outlineColor || '#000000') : 'none')
      .attr('stroke-width', outline ? (outlineWidth || 1) : 0)

    this.markerCache.set(id, config)
  }

  /**
   * Create animated markers with pulsing effect
   */
  createAnimatedMarker(config: MarkerConfig & { animationType: 'pulse' | 'rotate' | 'scale' }): void {
    const { id, size, color, animationType } = config

    const marker = this.defs.append('marker')
      .attr('id', id)
      .attr('markerWidth', size * 2)
      .attr('markerHeight', size * 2)
      .attr('refX', size)
      .attr('refY', size)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    const group = marker.append('g')

    // Create base shape
    const arrowPath = `M 0 ${size/2} L ${size * 0.8} 0 L ${size * 0.8} ${size/4} L ${size} ${size/2} L ${size * 0.8} ${size * 0.75} L ${size * 0.8} ${size} Z`
    
    group.append('path')
      .attr('d', arrowPath)
      .attr('fill', color)
      .attr('stroke', color)
      .attr('stroke-width', 0.5)

    // Add animation
    switch (animationType) {
      case 'pulse':
        group.append('animateTransform')
          .attr('attributeName', 'transform')
          .attr('type', 'scale')
          .attr('values', '1;1.3;1')
          .attr('dur', '2s')
          .attr('repeatCount', 'indefinite')
        break

      case 'rotate':
        group.append('animateTransform')
          .attr('attributeName', 'transform')
          .attr('type', 'rotate')
          .attr('values', `0 ${size} ${size};360 ${size} ${size}`)
          .attr('dur', '3s')
          .attr('repeatCount', 'indefinite')
        break

      case 'scale':
        group.append('animateTransform')
          .attr('attributeName', 'transform')
          .attr('type', 'scale')
          .attr('values', '0.8;1.2;0.8')
          .attr('dur', '1.5s')
          .attr('repeatCount', 'indefinite')
        break
    }

    this.markerCache.set(id, config)
  }

  /**
   * Initialize default professional markers
   */
  private initializeDefaultMarkers(): void {
    // Standard arrow markers
    this.createArrowMarker({
      id: 'arrow-default',
      type: 'arrow',
      size: 12,
      color: '#ffffff',
      outline: true,
      outlineColor: '#333333',
      outlineWidth: 1
    })

    this.createArrowMarker({
      id: 'arrow-hover',
      type: 'arrow',
      size: 14,
      color: '#1976D2',
      outline: true,
      outlineColor: '#0d47a1',
      outlineWidth: 1
    })

    this.createArrowMarker({
      id: 'arrow-selected',
      type: 'arrow',
      size: 16,
      color: '#2196F3',
      outline: true,
      outlineColor: '#1976D2',
      outlineWidth: 2
    })

    // Status markers
    this.createArrowMarker({
      id: 'arrow-success',
      type: 'arrow',
      size: 14,
      color: '#4CAF50',
      outline: true,
      outlineColor: '#2E7D32',
      outlineWidth: 1
    })

    this.createArrowMarker({
      id: 'arrow-error',
      type: 'arrow',
      size: 14,
      color: '#F44336',
      outline: true,
      outlineColor: '#C62828',
      outlineWidth: 1
    })

    this.createArrowMarker({
      id: 'arrow-warning',
      type: 'arrow',
      size: 14,
      color: '#FF9800',
      outline: true,
      outlineColor: '#E65100',
      outlineWidth: 1
    })

    // Special purpose markers
    this.createCircleMarker({
      id: 'circle-endpoint',
      type: 'circle',
      size: 6,
      color: '#ffffff',
      outline: true,
      outlineColor: '#333333',
      outlineWidth: 2
    })

    this.createDiamondMarker({
      id: 'diamond-decision',
      type: 'diamond',
      size: 8,
      color: '#9C27B0',
      outline: true,
      outlineColor: '#4A148C',
      outlineWidth: 1
    })

    // Animated markers
    this.createAnimatedMarker({
      id: 'arrow-active-pulse',
      type: 'arrow',
      size: 12,
      color: '#00BCD4',
      animationType: 'pulse'
    })
  }

  /**
   * Get marker reference for use in connections
   */
  getMarkerReference(markerId: string): string {
    return `url(#${markerId})`
  }

  /**
   * Get all available markers
   */
  getAvailableMarkers(): Map<string, MarkerConfig> {
    return new Map(this.markerCache)
  }
}

// ============================================================================
// GRADIENT AND PATTERN SYSTEM
// ============================================================================

/**
 * Advanced gradient and pattern system for connections
 */
export class ConnectionGradientSystem {
  private defs: d3.Selection<SVGDefsElement, unknown, null, undefined>
  private gradientCache = new Map<string, any>()

  constructor(svgDefs: d3.Selection<SVGDefsElement, unknown, null, undefined>) {
    this.defs = svgDefs
    this.initializeDefaultGradients()
  }

  /**
   * Create linear gradient for connections
   */
  createLinearGradient(
    id: string,
    colors: Array<{ offset: string; color: string; opacity?: number }>,
    direction: { x1: number; y1: number; x2: number; y2: number } = { x1: 0, y1: 0, x2: 1, y2: 0 }
  ): void {
    const gradient = this.defs.append('linearGradient')
      .attr('id', id)
      .attr('x1', `${direction.x1 * 100}%`)
      .attr('y1', `${direction.y1 * 100}%`)
      .attr('x2', `${direction.x2 * 100}%`)
      .attr('y2', `${direction.y2 * 100}%)`)

    colors.forEach(colorStop => {
      gradient.append('stop')
        .attr('offset', colorStop.offset)
        .attr('stop-color', colorStop.color)
        .attr('stop-opacity', colorStop.opacity || 1)
    })

    this.gradientCache.set(id, { type: 'linear', colors, direction })
  }

  /**
   * Create radial gradient for special effects
   */
  createRadialGradient(
    id: string,
    colors: Array<{ offset: string; color: string; opacity?: number }>,
    center: { cx: number; cy: number; r: number } = { cx: 0.5, cy: 0.5, r: 0.5 }
  ): void {
    const gradient = this.defs.append('radialGradient')
      .attr('id', id)
      .attr('cx', `${center.cx * 100}%`)
      .attr('cy', `${center.cy * 100}%`)
      .attr('r', `${center.r * 100}%`)

    colors.forEach(colorStop => {
      gradient.append('stop')
        .attr('offset', colorStop.offset)
        .attr('stop-color', colorStop.color)
        .attr('stop-opacity', colorStop.opacity || 1)
    })

    this.gradientCache.set(id, { type: 'radial', colors, center })
  }

  /**
   * Create animated gradient for data flow effects
   */
  createAnimatedGradient(
    id: string,
    baseColors: Array<{ offset: string; color: string }>,
    animationDuration: number = 2000
  ): void {
    const gradient = this.defs.append('linearGradient')
      .attr('id', id)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%')

    // Create multiple color stops for smooth animation
    const stops = []
    for (let i = 0; i <= 100; i += 10) {
      const stop = gradient.append('stop')
        .attr('offset', `${i}%`)
        .attr('stop-color', baseColors[0].color)
        .attr('stop-opacity', 0.3)
      
      stops.push(stop)
    }

    // Animate the stops to create flowing effect
    stops.forEach((stop, index) => {
      stop.append('animate')
        .attr('attributeName', 'stop-opacity')
        .attr('values', '0.3;1;0.3')
        .attr('dur', `${animationDuration}ms`)
        .attr('begin', `${index * 100}ms`)
        .attr('repeatCount', 'indefinite')
    })

    this.gradientCache.set(id, { type: 'animated', baseColors, animationDuration })
  }

  /**
   * Create pattern for dashed or textured connections
   */
  createConnectionPattern(
    id: string,
    patternType: 'dots' | 'dashes' | 'waves' | 'zigzag',
    color: string,
    spacing: number = 10
  ): void {
    const pattern = this.defs.append('pattern')
      .attr('id', id)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', spacing)
      .attr('height', spacing)

    switch (patternType) {
      case 'dots':
        pattern.append('circle')
          .attr('cx', spacing / 2)
          .attr('cy', spacing / 2)
          .attr('r', spacing / 6)
          .attr('fill', color)
        break

      case 'dashes':
        pattern.append('rect')
          .attr('x', 0)
          .attr('y', spacing / 3)
          .attr('width', spacing * 0.6)
          .attr('height', spacing / 3)
          .attr('fill', color)
        break

      case 'waves':
        const wavePath = `M 0 ${spacing/2} Q ${spacing/4} 0 ${spacing/2} ${spacing/2} T ${spacing} ${spacing/2}`
        pattern.append('path')
          .attr('d', wavePath)
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('fill', 'none')
        break

      case 'zigzag':
        const zigzagPath = `M 0 ${spacing/2} L ${spacing/4} 0 L ${spacing/2} ${spacing/2} L ${spacing*3/4} 0 L ${spacing} ${spacing/2}`
        pattern.append('path')
          .attr('d', zigzagPath)
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('fill', 'none')
        break
    }

    this.gradientCache.set(id, { type: 'pattern', patternType, color, spacing })
  }

  /**
   * Initialize default gradients
   */
  private initializeDefaultGradients(): void {
    // Data flow gradient
    this.createLinearGradient('gradient-data-flow', [
      { offset: '0%', color: '#2196F3', opacity: 0.8 },
      { offset: '50%', color: '#00BCD4', opacity: 1 },
      { offset: '100%', color: '#4CAF50', opacity: 0.8 }
    ])

    // Status gradients
    this.createLinearGradient('gradient-success', [
      { offset: '0%', color: '#4CAF50', opacity: 0.8 },
      { offset: '100%', color: '#8BC34A', opacity: 1 }
    ])

    this.createLinearGradient('gradient-error', [
      { offset: '0%', color: '#F44336', opacity: 0.8 },
      { offset: '100%', color: '#FF5722', opacity: 1 }
    ])

    this.createLinearGradient('gradient-warning', [
      { offset: '0%', color: '#FF9800', opacity: 0.8 },
      { offset: '100%', color: '#FFC107', opacity: 1 }
    ])

    // Animated flow gradient
    this.createAnimatedGradient('gradient-animated-flow', [
      { offset: '0%', color: '#2196F3' },
      { offset: '100%', color: '#00BCD4' }
    ], 2000)

    // Connection patterns
    this.createConnectionPattern('pattern-dots', 'dots', '#ffffff', 8)
    this.createConnectionPattern('pattern-dashes', 'dashes', '#ffffff', 12)
    this.createConnectionPattern('pattern-waves', 'waves', '#ffffff', 16)
  }

  /**
   * Get gradient reference for use in connections
   */
  getGradientReference(gradientId: string): string {
    return `url(#${gradientId})`
  }
}

// ============================================================================
// CONNECTION LABEL SYSTEM
// ============================================================================

/**
 * Advanced labeling system for connections
 */
export class ConnectionLabelSystem {
  private labelGroups = new Map<string, d3.Selection<SVGGElement, unknown, null, undefined>>()

  /**
   * Create professional connection label
   */
  createConnectionLabel(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    connectionId: string,
    pathElement: SVGPathElement,
    config: ConnectionLabelConfig
  ): void {
    // Remove existing label
    this.removeConnectionLabel(connectionId)

    // Calculate label position
    const position = this.calculateLabelPosition(pathElement, config.position)
    
    // Create label group
    const labelGroup = connectionElement.append('g')
      .attr('class', 'connection-label-group')
      .attr('transform', `translate(${position.x}, ${position.y})`)

    // Add background if specified
    if (config.style.backgroundColor) {
      const textMetrics = this.measureText(config.text, config.style)
      const padding = config.style.padding || 4
      
      labelGroup.append('rect')
        .attr('class', 'label-background')
        .attr('x', -textMetrics.width / 2 - padding)
        .attr('y', -textMetrics.height / 2 - padding)
        .attr('width', textMetrics.width + padding * 2)
        .attr('height', textMetrics.height + padding * 2)
        .attr('rx', config.style.borderRadius || 3)
        .attr('fill', config.style.backgroundColor)
        .attr('stroke', '#cccccc')
        .attr('stroke-width', 1)
    }

    // Add text label
    labelGroup.append('text')
      .attr('class', 'label-text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', config.style.fontSize)
      .attr('font-family', config.style.fontFamily)
      .attr('fill', config.style.color)
      .attr('pointer-events', 'none')
      .text(config.text)

    // Apply offset if specified
    if (config.offset) {
      labelGroup.attr('transform', 
        `translate(${position.x + config.offset.x}, ${position.y + config.offset.y})`
      )
    }

    this.labelGroups.set(connectionId, labelGroup)
  }

  /**
   * Create status badge for connections
   */
  createStatusBadge(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    connectionId: string,
    pathElement: SVGPathElement,
    status: 'success' | 'error' | 'warning' | 'info',
    message?: string
  ): void {
    const statusConfig = this.getStatusConfig(status)
    const position = this.calculateLabelPosition(pathElement, 0.2) // Near start of connection

    const badgeGroup = connectionElement.append('g')
      .attr('class', 'connection-status-badge')
      .attr('transform', `translate(${position.x}, ${position.y})`)

    // Badge background
    badgeGroup.append('circle')
      .attr('r', 8)
      .attr('fill', statusConfig.backgroundColor)
      .attr('stroke', statusConfig.borderColor)
      .attr('stroke-width', 2)

    // Status icon
    badgeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 10)
      .attr('font-weight', 'bold')
      .attr('fill', statusConfig.iconColor)
      .text(statusConfig.icon)

    // Tooltip for message
    if (message) {
      badgeGroup.append('title').text(message)
    }

    this.labelGroups.set(`${connectionId}-status`, badgeGroup)
  }

  /**
   * Create connection metrics label (throughput, latency, etc.)
   */
  createMetricsLabel(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    connectionId: string,
    pathElement: SVGPathElement,
    metrics: { label: string; value: string; unit?: string }
  ): void {
    const position = this.calculateLabelPosition(pathElement, 0.8) // Near end of connection

    const metricsGroup = connectionElement.append('g')
      .attr('class', 'connection-metrics')
      .attr('transform', `translate(${position.x}, ${position.y})`)

    // Metrics background
    const bgWidth = 60
    const bgHeight = 24

    metricsGroup.append('rect')
      .attr('x', -bgWidth / 2)
      .attr('y', -bgHeight / 2)
      .attr('width', bgWidth)
      .attr('height', bgHeight)
      .attr('rx', 4)
      .attr('fill', 'rgba(0, 0, 0, 0.8)')
      .attr('stroke', '#444444')
      .attr('stroke-width', 1)

    // Metrics text
    metricsGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 9)
      .attr('font-family', 'Monaco, monospace')
      .attr('fill', '#ffffff')
      .text(`${metrics.value}${metrics.unit || ''}`)

    this.labelGroups.set(`${connectionId}-metrics`, metricsGroup)
  }

  /**
   * Update existing label position
   */
  updateLabelPosition(connectionId: string, pathElement: SVGPathElement, position: number): void {
    const labelGroup = this.labelGroups.get(connectionId)
    if (labelGroup) {
      const newPosition = this.calculateLabelPosition(pathElement, position)
      labelGroup.attr('transform', `translate(${newPosition.x}, ${newPosition.y})`)
    }
  }

  /**
   * Remove connection label
   */
  removeConnectionLabel(connectionId: string): void {
    const labelGroup = this.labelGroups.get(connectionId)
    if (labelGroup) {
      labelGroup.remove()
      this.labelGroups.delete(connectionId)
    }
  }

  /**
   * Remove all labels
   */
  clearAllLabels(): void {
    this.labelGroups.forEach(group => group.remove())
    this.labelGroups.clear()
  }

  /**
   * Calculate label position along path
   */
  private calculateLabelPosition(pathElement: SVGPathElement, position: number | string): { x: number; y: number } {
    const pathLength = pathElement.getTotalLength()
    
    let offset: number
    if (typeof position === 'string') {
      switch (position) {
        case 'start': offset = pathLength * 0.1; break
        case 'middle': offset = pathLength * 0.5; break
        case 'end': offset = pathLength * 0.9; break
        default: offset = pathLength * 0.5
      }
    } else {
      offset = pathLength * Math.max(0, Math.min(1, position))
    }

    const point = pathElement.getPointAtLength(offset)
    return { x: point.x, y: point.y }
  }

  /**
   * Measure text dimensions
   */
  private measureText(text: string, style: ConnectionLabelConfig['style']): { width: number; height: number } {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    
    context.font = `${style.fontSize}px ${style.fontFamily}`
    const metrics = context.measureText(text)
    
    return {
      width: metrics.width,
      height: style.fontSize * 1.2 // Approximate height
    }
  }

  /**
   * Get status configuration
   */
  private getStatusConfig(status: string) {
    const configs = {
      success: {
        backgroundColor: '#4CAF50',
        borderColor: '#2E7D32',
        iconColor: '#ffffff',
        icon: '✓'
      },
      error: {
        backgroundColor: '#F44336',
        borderColor: '#C62828',
        iconColor: '#ffffff',
        icon: '✗'
      },
      warning: {
        backgroundColor: '#FF9800',
        borderColor: '#E65100',
        iconColor: '#ffffff',
        icon: '!'
      },
      info: {
        backgroundColor: '#2196F3',
        borderColor: '#1976D2',
        iconColor: '#ffffff',
        icon: 'i'
      }
    }

    return configs[status as keyof typeof configs] || configs.info
  }
}

// ============================================================================
// SHADOW AND GLOW EFFECTS
// ============================================================================

/**
 * Professional shadow and glow effects system
 */
export class ConnectionEffectsSystem {
  private defs: d3.Selection<SVGDefsElement, unknown, null, undefined>
  private effectsCache = new Map<string, any>()

  constructor(svgDefs: d3.Selection<SVGDefsElement, unknown, null, undefined>) {
    this.defs = svgDefs
    this.initializeDefaultEffects()
  }

  /**
   * Create drop shadow filter
   */
  createDropShadow(
    id: string,
    offset: { x: number; y: number } = { x: 2, y: 2 },
    blur: number = 4,
    color: string = 'rgba(0, 0, 0, 0.3)'
  ): void {
    const filter = this.defs.append('filter')
      .attr('id', id)
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    filter.append('feDropShadow')
      .attr('dx', offset.x)
      .attr('dy', offset.y)
      .attr('stdDeviation', blur)
      .attr('flood-color', color)

    this.effectsCache.set(id, { type: 'dropShadow', offset, blur, color })
  }

  /**
   * Create glow effect filter
   */
  createGlowEffect(
    id: string,
    color: string = '#2196F3',
    intensity: number = 3,
    size: number = 4
  ): void {
    const filter = this.defs.append('filter')
      .attr('id', id)
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '300%')
      .attr('height', '300%')

    // Create multiple glow layers for better effect
    for (let i = 1; i <= intensity; i++) {
      filter.append('feGaussianBlur')
        .attr('stdDeviation', size * i)
        .attr('result', `glow${i}`)

      filter.append('feFlood')
        .attr('flood-color', color)
        .attr('flood-opacity', 0.8 / i)
        .attr('result', `flood${i}`)

      filter.append('feComposite')
        .attr('in', `flood${i}`)
        .attr('in2', `glow${i}`)
        .attr('operator', 'in')
        .attr('result', `composite${i}`)
    }

    // Merge all glow layers
    const merge = filter.append('feMerge')
    for (let i = 1; i <= intensity; i++) {
      merge.append('feMergeNode').attr('in', `composite${i}`)
    }
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    this.effectsCache.set(id, { type: 'glow', color, intensity, size })
  }

  /**
   * Create pulsing glow effect
   */
  createPulsingGlow(
    id: string,
    color: string = '#2196F3',
    minIntensity: number = 2,
    maxIntensity: number = 6,
    duration: number = 2000
  ): void {
    const filter = this.defs.append('filter')
      .attr('id', id)
      .attr('x', '-100%')
      .attr('y', '-100%')
      .attr('width', '400%')
      .attr('height', '400%')

    const gaussianBlur = filter.append('feGaussianBlur')
      .attr('stdDeviation', minIntensity)
      .attr('result', 'coloredBlur')

    // Animate the blur intensity
    gaussianBlur.append('animate')
      .attr('attributeName', 'stdDeviation')
      .attr('values', `${minIntensity};${maxIntensity};${minIntensity}`)
      .attr('dur', `${duration}ms`)
      .attr('repeatCount', 'indefinite')

    filter.append('feFlood')
      .attr('flood-color', color)
      .attr('flood-opacity', 0.6)
      .attr('result', 'flood')

    filter.append('feComposite')
      .attr('in', 'flood')
      .attr('in2', 'coloredBlur')
      .attr('operator', 'in')
      .attr('result', 'composite')

    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'composite')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    this.effectsCache.set(id, { type: 'pulsingGlow', color, minIntensity, maxIntensity, duration })
  }

  /**
   * Initialize default effects
   */
  private initializeDefaultEffects(): void {
    // Basic drop shadows
    this.createDropShadow('shadow-subtle', { x: 1, y: 1 }, 2, 'rgba(0, 0, 0, 0.2)')
    this.createDropShadow('shadow-normal', { x: 2, y: 2 }, 4, 'rgba(0, 0, 0, 0.3)')
    this.createDropShadow('shadow-strong', { x: 4, y: 4 }, 8, 'rgba(0, 0, 0, 0.4)')

    // Glow effects
    this.createGlowEffect('glow-blue', '#2196F3', 2, 3)
    this.createGlowEffect('glow-green', '#4CAF50', 2, 3)
    this.createGlowEffect('glow-red', '#F44336', 2, 3)
    this.createGlowEffect('glow-orange', '#FF9800', 2, 3)

    // Pulsing effects
    this.createPulsingGlow('pulse-blue', '#2196F3', 2, 6, 2000)
    this.createPulsingGlow('pulse-green', '#4CAF50', 2, 6, 2000)
    this.createPulsingGlow('pulse-red', '#F44336', 2, 6, 1500)
  }

  /**
   * Get effect reference for use in connections
   */
  getEffectReference(effectId: string): string {
    return `url(#${effectId})`
  }

  /**
   * Apply effect to connection element
   */
  applyEffect(element: d3.Selection<any, any, any, any>, effectId: string): void {
    element.style('filter', this.getEffectReference(effectId))
  }

  /**
   * Remove effect from connection element
   */
  removeEffect(element: d3.Selection<any, any, any, any>): void {
    element.style('filter', null)
  }
}

// ============================================================================
// MAIN VISUAL EFFECTS MANAGER
// ============================================================================

/**
 * Main visual effects manager that orchestrates all visual enhancements
 */
export class ConnectionVisualEffectsManager {
  private markerSystem: AdvancedMarkerSystem
  private gradientSystem: ConnectionGradientSystem
  private labelSystem: ConnectionLabelSystem
  private effectsSystem: ConnectionEffectsSystem

  constructor(svgDefs: d3.Selection<SVGDefsElement, unknown, null, undefined>) {
    this.markerSystem = new AdvancedMarkerSystem(svgDefs)
    this.gradientSystem = new ConnectionGradientSystem(svgDefs)
    this.labelSystem = new ConnectionLabelSystem()
    this.effectsSystem = new ConnectionEffectsSystem(svgDefs)
  }

  /**
   * Apply complete visual enhancement to a connection
   */
  enhanceConnection(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    pathElement: SVGPathElement,
    connection: Connection,
    theme: Partial<ConnectionTheme> = {}
  ): void {
    const connectionId = connection.id

    // Apply marker
    d3.select(pathElement).attr('marker-end', this.markerSystem.getMarkerReference('arrow-default'))

    // Apply subtle shadow
    this.effectsSystem.applyEffect(d3.select(pathElement), 'shadow-subtle')

    // Add connection label if needed
    // this.labelSystem.createConnectionLabel(connectionElement, connectionId, pathElement, {
    //   text: 'Data Flow',
    //   position: 'middle',
    //   style: {
    //     fontSize: 10,
    //     fontFamily: 'Arial, sans-serif',
    //     color: '#666666'
    //   }
    // })
  }

  /**
   * Apply hover effect to connection
   */
  applyHoverEffect(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    pathElement: SVGPathElement
  ): void {
    d3.select(pathElement)
      .attr('marker-end', this.markerSystem.getMarkerReference('arrow-hover'))

    this.effectsSystem.applyEffect(d3.select(pathElement), 'glow-blue')
  }

  /**
   * Apply selection effect to connection
   */
  applySelectionEffect(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    pathElement: SVGPathElement
  ): void {
    d3.select(pathElement)
      .attr('marker-end', this.markerSystem.getMarkerReference('arrow-selected'))

    this.effectsSystem.applyEffect(d3.select(pathElement), 'pulse-blue')
  }

  /**
   * Apply status effect to connection
   */
  applyStatusEffect(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    pathElement: SVGPathElement,
    status: 'success' | 'error' | 'warning' | 'active'
  ): void {
    const statusConfig = {
      success: { marker: 'arrow-success', effect: 'glow-green' },
      error: { marker: 'arrow-error', effect: 'glow-red' },
      warning: { marker: 'arrow-warning', effect: 'glow-orange' },
      active: { marker: 'arrow-active-pulse', effect: 'pulse-blue' }
    }

    const config = statusConfig[status]
    if (config) {
      d3.select(pathElement).attr('marker-end', this.markerSystem.getMarkerReference(config.marker))
      this.effectsSystem.applyEffect(d3.select(pathElement), config.effect)
    }
  }

  /**
   * Remove all effects from connection
   */
  clearConnectionEffects(
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    pathElement: SVGPathElement,
    connectionId: string
  ): void {
    d3.select(pathElement)
      .attr('marker-end', this.markerSystem.getMarkerReference('arrow-default'))

    this.effectsSystem.removeEffect(d3.select(pathElement))
    this.labelSystem.removeConnectionLabel(connectionId)
  }

  /**
   * Get marker system for custom marker creation
   */
  getMarkerSystem(): AdvancedMarkerSystem {
    return this.markerSystem
  }

  /**
   * Get gradient system for custom gradient creation
   */
  getGradientSystem(): ConnectionGradientSystem {
    return this.gradientSystem
  }

  /**
   * Get label system for custom label creation
   */
  getLabelSystem(): ConnectionLabelSystem {
    return this.labelSystem
  }

  /**
   * Get effects system for custom effect creation
   */
  getEffectsSystem(): ConnectionEffectsSystem {
    return this.effectsSystem
  }
}