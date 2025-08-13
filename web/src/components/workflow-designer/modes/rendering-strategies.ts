/**
 * Mode Rendering Strategies - Strategy Pattern Implementation
 * Each strategy implements specific rendering logic for different modes
 * Following SOLID principles with clear separation of concerns
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as d3 from 'd3'
import { generateOrthogonalRoundedPath } from '../utils/connection-utils'
import type { 
  ModeRenderingStrategy, 
  ModeDefinition, 
  ConnectionRenderData, 
  PortRenderData, 
  CanvasRenderData, 
  RenderData,
  ModeTheme,
  Point2D
} from '../types/mode-system'
// (Optional) shared generators imported elsewhere; not relying here to allow fine‑tuned architecture styling

/**
 * Base Abstract Strategy - Template Method Pattern
 * Provides common functionality and structure for all rendering strategies
 */
abstract class BaseRenderingStrategy implements ModeRenderingStrategy {
  protected isActive = false
  protected performanceMetrics = {
    renderTime: 0,
    lastRender: Date.now()
  }

  constructor(public readonly mode: ModeDefinition) {}

  // Template method - defines the algorithm structure
  renderConnection(connection: ConnectionRenderData): SVGElement {
    const startTime = performance.now()
    
    const element = this.createConnectionElement(connection)
    this.applyConnectionStyling(element, connection)
    this.addConnectionInteractivity(element, connection)
    
    this.performanceMetrics.renderTime = performance.now() - startTime
    return element
  }

  renderPort(port: PortRenderData): SVGElement {
    const startTime = performance.now()
    
    const element = this.createPortElement(port)
    this.applyPortStyling(element, port)
    this.addPortInteractivity(element, port)
    
    this.performanceMetrics.renderTime += performance.now() - startTime
    return element
  }

  renderCanvas(canvas: CanvasRenderData): void {
    this.applyCanvasBackground(canvas)
    this.renderGridPattern(canvas)
    this.applyOverlayEffects(canvas)
  }

  renderMarkers(defs: SVGDefsElement): void {
    this.createConnectionMarkers(defs)
    this.createPortPatterns(defs)
    this.createAnimationDefinitions(defs)
  }

  // Abstract methods - must be implemented by concrete strategies
  protected abstract createConnectionElement(connection: ConnectionRenderData): SVGElement
  protected abstract createPortElement(port: PortRenderData): SVGElement
  protected abstract applyConnectionStyling(element: SVGElement, connection: ConnectionRenderData): void
  protected abstract applyPortStyling(element: SVGElement, port: PortRenderData): void

  // Template method implementations
  protected addConnectionInteractivity(element: SVGElement, connection: ConnectionRenderData): void {
    const d3Element = d3.select(element)
    
    d3Element
      .style('cursor', 'pointer')
      .on('mouseenter', () => this.onConnectionHover(element, connection, true))
      .on('mouseleave', () => this.onConnectionHover(element, connection, false))
      .on('click', () => this.onConnectionClick(element, connection))
  }

  protected addPortInteractivity(element: SVGElement, port: PortRenderData): void {
    const d3Element = d3.select(element)
    
    d3Element
      .style('cursor', 'pointer')
      .on('mouseenter', () => this.onPortHover(element, port, true))
      .on('mouseleave', () => this.onPortHover(element, port, false))
      .on('click', () => this.onPortClick(element, port))
  }

  protected applyCanvasBackground(_canvas: CanvasRenderData): void {
    const container = d3.select('.canvas-container')
    const background = this.mode.canvasStyle.backgroundType === 'gradient' 
      ? this.mode.canvasStyle.backgroundValue 
      : this.mode.theme.background

    container.style('background', background)
  }

  protected renderGridPattern(canvas: CanvasRenderData): void {
    const { gridStyle } = this.mode.canvasStyle
    if (!gridStyle.enabled) return

    // Grid rendering logic will be implemented by specific strategies
    this.createGridPattern(canvas, gridStyle)
  }

  protected applyOverlayEffects(canvas: CanvasRenderData): void {
    const { overlayEffects } = this.mode.canvasStyle
    overlayEffects.forEach(effect => {
      this.createOverlayEffect(canvas, effect)
    })
  }

  // Event handlers
  protected onConnectionHover(element: SVGElement, _connection: ConnectionRenderData, isHovered: boolean): void {
    const { hoverEffect } = this.mode.connectionStyle
    const d3Element = d3.select(element)

    if (isHovered) {
      d3Element
        .transition()
        .duration(this.mode.connectionStyle.transitionDuration)
        .style('stroke-width', hoverEffect.strokeWidth)
        .style('opacity', hoverEffect.opacity)
        .style('filter', `drop-shadow(0 0 ${hoverEffect.shadowBlur}px ${this.mode.theme.primary})`)
    } else {
      d3Element
        .transition()
        .duration(this.mode.connectionStyle.transitionDuration)
        .style('stroke-width', this.mode.connectionStyle.strokeWidth)
        .style('opacity', this.mode.connectionStyle.opacity)
        .style('filter', 'none')
    }
  }

  protected onPortHover(element: SVGElement, _port: PortRenderData, isHovered: boolean): void {
    const { hoverEffect } = this.mode.portStyle
    const d3Element = d3.select(element)

    if (isHovered) {
      d3Element
        .transition()
        .duration(hoverEffect.transitionDuration)
        .style('transform', `scale(${hoverEffect.scaleTransform})`)
        .style('filter', `drop-shadow(0 0 ${hoverEffect.shadowBlur}px ${this.mode.theme.primary})`)
    } else {
      d3Element
        .transition()
        .duration(hoverEffect.transitionDuration)
        .style('transform', 'scale(1)')
        .style('filter', 'none')
    }
  }

  protected onConnectionClick(_element: SVGElement, connection: ConnectionRenderData): void {
    // Connection click handling - can be overridden by specific strategies
    console.log('Connection clicked:', connection.id)
  }

  protected onPortClick(_element: SVGElement, port: PortRenderData): void {
    // Port click handling - can be overridden by specific strategies
    console.log('Port clicked:', port.id)
  }

  // Abstract methods for specific implementations
  protected abstract createConnectionMarkers(defs: SVGDefsElement): void
  protected abstract createPortPatterns(defs: SVGDefsElement): void
  protected abstract createAnimationDefinitions(defs: SVGDefsElement): void
  protected abstract createGridPattern(canvas: CanvasRenderData, gridStyle: any): void
  protected abstract createOverlayEffect(canvas: CanvasRenderData, effect: any): void

  // Lifecycle methods
  onModeActivated(): void {
    this.isActive = true
    console.log(`${this.mode.name} mode activated`)
  }

  onModeDeactivated(): void {
    this.isActive = false
    this.cleanup()
    console.log(`${this.mode.name} mode deactivated`)
  }

  onThemeChanged(_theme: ModeTheme): void {
    // Theme change handling - can be overridden
    console.log(`Theme changed for ${this.mode.name}`)
  }

  shouldRerender(oldData: RenderData, newData: RenderData): boolean {
    // Simple change detection - can be optimized per strategy
    return oldData.timestamp !== newData.timestamp ||
           oldData.connections.length !== newData.connections.length ||
           oldData.ports.length !== newData.ports.length
  }

  cleanup(): void {
    // Cleanup resources
    d3.selectAll('.mode-specific-element').remove()
  }
}

/**
 * Workflow Mode Strategy - Clean, bright execution-focused rendering
 */
export class WorkflowRenderingStrategy extends BaseRenderingStrategy {
  protected createConnectionElement(connection: ConnectionRenderData): SVGElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', 'workflow-connection')
    path.setAttribute('d', this.calculateConnectionPath(connection))
    return path
  }

  protected createPortElement(port: PortRenderData): SVGElement {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('class', 'workflow-port')
    circle.setAttribute('cx', port.position.x.toString())
    circle.setAttribute('cy', port.position.y.toString())
    circle.setAttribute('r', (this.mode.portStyle.size / 2).toString())
    return circle
  }

  protected applyConnectionStyling(element: SVGElement, connection: ConnectionRenderData): void {
    const d3Element = d3.select(element)
    const style = this.mode.connectionStyle

    d3Element
      .style('stroke', connection.selected ? this.mode.theme.success : this.mode.theme.primary)
      .style('stroke-width', style.strokeWidth)
      .style('stroke-dasharray', style.strokeDashArray || 'none')
      .style('opacity', style.opacity)
      .style('fill', 'none')
      .style('marker-end', `url(#workflow-arrow-${connection.selected ? 'selected' : 'default'})`)

    // Add flow animation
    if (style.animationType === 'flow') {
      d3Element.style('stroke-dasharray', '8,4')
        .append('animateTransform')
        .attr('attributeName', 'stroke-dashoffset')
        .attr('values', '0;12')
        .attr('dur', '1s')
        .attr('repeatCount', 'indefinite')
    }
  }

  protected applyPortStyling(element: SVGElement, port: PortRenderData): void {
    const d3Element = d3.select(element)
    const typeColor = this.mode.portStyle.typeIndicators.colorMapping[port.dataType] || this.mode.theme.primary

    d3Element
      .style('fill', port.connected ? typeColor : this.mode.theme.background)
      .style('stroke', typeColor)
      .style('stroke-width', this.mode.portStyle.strokeWidth)
      .style('filter', `drop-shadow(0 0 ${this.mode.portStyle.shadowBlur}px ${typeColor})`)

    // Add connected indicator
    if (port.connected && this.mode.portStyle.connectedIndicator.enabled) {
      d3Element.style('animation', 'workflow-port-glow 2s infinite')
    }
  }

  protected createConnectionMarkers(defs: SVGDefsElement): void {
    // Default arrow marker
    const defaultMarker = d3.select(defs).append('marker')
      .attr('id', 'workflow-arrow-default')
      .attr('markerWidth', this.mode.connectionStyle.markerSize)
      .attr('markerHeight', this.mode.connectionStyle.markerSize)
      .attr('refX', this.mode.connectionStyle.markerSize - 2)
      .attr('refY', this.mode.connectionStyle.markerSize / 2)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    defaultMarker.append('polygon')
      .attr('points', `0,0 ${this.mode.connectionStyle.markerSize-2},${this.mode.connectionStyle.markerSize/2} 0,${this.mode.connectionStyle.markerSize}`)
      .attr('fill', this.mode.theme.primary)
      .attr('stroke', 'none')

    // Selected arrow marker
    const selectedMarker = d3.select(defs).append('marker')
      .attr('id', 'workflow-arrow-selected')
      .attr('markerWidth', this.mode.connectionStyle.markerSize + 2)
      .attr('markerHeight', this.mode.connectionStyle.markerSize + 2)
      .attr('refX', this.mode.connectionStyle.markerSize)
      .attr('refY', (this.mode.connectionStyle.markerSize + 2) / 2)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    selectedMarker.append('polygon')
      .attr('points', `0,0 ${this.mode.connectionStyle.markerSize},${(this.mode.connectionStyle.markerSize+2)/2} 0,${this.mode.connectionStyle.markerSize+2}`)
      .attr('fill', this.mode.theme.success)
      .attr('stroke', 'none')
      .attr('filter', `drop-shadow(0 0 4px ${this.mode.theme.success})`)
  }

  protected createPortPatterns(defs: SVGDefsElement): void {
    // Create patterns for different port types
    Object.entries(this.mode.portStyle.typeIndicators.colorMapping).forEach(([type, color]) => {
      const pattern = d3.select(defs).append('pattern')
        .attr('id', `workflow-port-${type}`)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 4)
        .attr('height', 4)

      pattern.append('circle')
        .attr('cx', 2)
        .attr('cy', 2)
        .attr('r', 1)
        .attr('fill', color)
        .attr('opacity', 0.3)
    })
  }

  protected createAnimationDefinitions(_defs: SVGDefsElement): void {
    // Create CSS animations for workflow mode
    const style = document.createElement('style')
    style.textContent = `
      @keyframes workflow-port-glow {
        0%, 100% { filter: drop-shadow(0 0 ${this.mode.portStyle.shadowBlur}px ${this.mode.theme.primary}); }
        50% { filter: drop-shadow(0 0 ${this.mode.portStyle.shadowBlur * 2}px ${this.mode.theme.primary}); }
      }
      
      .workflow-connection {
        transition: all ${this.mode.connectionStyle.transitionDuration}ms ease;
      }
      
      .workflow-port {
        transition: all ${this.mode.portStyle.hoverEffect.transitionDuration}ms ease;
      }
    `
    document.head.appendChild(style)
  }

  protected createGridPattern(_canvas: CanvasRenderData, gridStyle: any): void {
    // Workflow mode uses subtle dot grid
    const svg = d3.select('.workflow-canvas')
    let defs = svg.select<SVGDefsElement>('defs')
    if (defs.empty()) {
      defs = svg.append<SVGDefsElement>('defs')
    }

    const pattern = defs.append('pattern')
      .attr('id', 'workflow-grid')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', gridStyle.size)
      .attr('height', gridStyle.size)

    pattern.append('circle')
      .attr('cx', gridStyle.size / 2)
      .attr('cy', gridStyle.size / 2)
      .attr('r', 1)
      .attr('fill', gridStyle.color)
      .attr('opacity', gridStyle.opacity)

    // Apply grid to canvas background
    svg.select('.grid-layer').selectAll('*').remove()
    svg.select('.grid-layer').append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#workflow-grid)')
  }

  protected createOverlayEffect(_canvas: CanvasRenderData, _effect: any): void {
    // Workflow mode typically doesn't use overlay effects
    // This is intentionally minimal to maintain clean appearance
  }

  private calculateConnectionPath(connection: ConnectionRenderData): string {
    const { sourcePoint, targetPoint } = connection
    const dx = targetPoint.x - sourcePoint.x
    const dy = targetPoint.y - sourcePoint.y
    
    // Create smooth curved path
    const controlOffset = Math.max(Math.abs(dx) / 2, 80)
    const cp1x = sourcePoint.x + controlOffset
    const cp1y = sourcePoint.y + dy * 0.05
    const cp2x = targetPoint.x - controlOffset
    const cp2y = targetPoint.y - dy * 0.05

    return `M ${sourcePoint.x} ${sourcePoint.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${targetPoint.x} ${targetPoint.y}`
  }
}

/**
 * Architecture Mode Strategy - Dark, sophisticated blueprint-style rendering
 */
export class ArchitectureRenderingStrategy extends BaseRenderingStrategy {
  protected createConnectionElement(connection: ConnectionRenderData): SVGElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', 'architecture-connection')
    path.setAttribute('d', this.calculateArchitecturalPath(connection))
    return path
  }

  protected createPortElement(port: PortRenderData): SVGElement {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('class', 'architecture-port')
    rect.setAttribute('x', (port.position.x - this.mode.portStyle.size / 2).toString())
    rect.setAttribute('y', (port.position.y - this.mode.portStyle.size / 2).toString())
    rect.setAttribute('width', this.mode.portStyle.size.toString())
    rect.setAttribute('height', this.mode.portStyle.size.toString())
    return rect
  }

  protected applyConnectionStyling(element: SVGElement, connection: ConnectionRenderData): void {
    const d3Element = d3.select(element)
    const style = this.mode.connectionStyle

    d3Element
      .style('stroke', connection.selected ? this.mode.theme.error : this.mode.theme.primary)
      .style('stroke-width', style.strokeWidth)
      .style('stroke-dasharray', style.strokeDashArray || 'none')
      .style('opacity', style.opacity)
      .style('fill', 'none')
      .style('marker-end', `url(#architecture-diamond-${connection.selected ? 'selected' : 'default'})`)

    // Add pulse animation for architecture
    if (style.animationType === 'pulse') {
      d3Element.style('animation', 'architecture-pulse 2s infinite')
    }
  }

  protected applyPortStyling(element: SVGElement, port: PortRenderData): void {
    const d3Element = d3.select(element)
    const typeColor = this.mode.portStyle.typeIndicators.colorMapping[port.dataType] || this.mode.theme.primary

    d3Element
      .style('fill', port.connected ? typeColor : 'transparent')
      .style('stroke', typeColor)
      .style('stroke-width', this.mode.portStyle.strokeWidth)
      .style('stroke-dasharray', port.connected ? 'none' : '3,2')
      .style('filter', `drop-shadow(0 0 ${this.mode.portStyle.shadowBlur}px ${typeColor})`)

    // Add architectural port pattern
    if (port.connected) {
      d3Element.style('fill', `url(#architecture-port-pattern-${port.dataType})`)
    }
  }

  protected createConnectionMarkers(defs: SVGDefsElement): void {
    // Diamond marker for default connections
    const defaultMarker = d3.select(defs).append('marker')
      .attr('id', 'architecture-diamond-default')
      .attr('markerWidth', this.mode.connectionStyle.markerSize)
      .attr('markerHeight', this.mode.connectionStyle.markerSize)
      .attr('refX', this.mode.connectionStyle.markerSize - 2)
      .attr('refY', this.mode.connectionStyle.markerSize / 2)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    defaultMarker.append('polygon')
      .attr('points', `${this.mode.connectionStyle.markerSize/2},0 ${this.mode.connectionStyle.markerSize-2},${this.mode.connectionStyle.markerSize/2} ${this.mode.connectionStyle.markerSize/2},${this.mode.connectionStyle.markerSize} 0,${this.mode.connectionStyle.markerSize/2}`)
      .attr('fill', this.mode.theme.primary)
      .attr('stroke', this.mode.theme.primary)
      .attr('stroke-width', 1)

    // Selected diamond marker
    const selectedMarker = d3.select(defs).append('marker')
      .attr('id', 'architecture-diamond-selected')
      .attr('markerWidth', this.mode.connectionStyle.markerSize + 4)
      .attr('markerHeight', this.mode.connectionStyle.markerSize + 4)
      .attr('refX', this.mode.connectionStyle.markerSize + 2)
      .attr('refY', (this.mode.connectionStyle.markerSize + 4) / 2)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    selectedMarker.append('polygon')
      .attr('points', `${(this.mode.connectionStyle.markerSize+4)/2},0 ${this.mode.connectionStyle.markerSize+2},${(this.mode.connectionStyle.markerSize+4)/2} ${(this.mode.connectionStyle.markerSize+4)/2},${this.mode.connectionStyle.markerSize+4} 0,${(this.mode.connectionStyle.markerSize+4)/2}`)
      .attr('fill', this.mode.theme.error)
      .attr('stroke', this.mode.theme.error)
      .attr('stroke-width', 2)
      .attr('filter', `drop-shadow(0 0 6px ${this.mode.theme.error})`)
  }

  protected createPortPatterns(defs: SVGDefsElement): void {
    // Create sophisticated patterns for architectural components
    Object.entries(this.mode.portStyle.typeIndicators.colorMapping).forEach(([type, color]) => {
      const pattern = d3.select(defs).append('pattern')
        .attr('id', `architecture-port-pattern-${type}`)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 8)
        .attr('height', 8)

      // Different patterns for different types
      switch (type) {
        case 'service':
          pattern.append('rect').attr('width', 8).attr('height', 8).attr('fill', color).attr('opacity', 0.2)
          pattern.append('path').attr('d', 'M0,4 L8,4 M4,0 L4,8').attr('stroke', color).attr('stroke-width', 1)
          break
        case 'database':
          pattern.append('ellipse').attr('cx', 4).attr('cy', 4).attr('rx', 3).attr('ry', 2).attr('fill', 'none').attr('stroke', color)
          break
        case 'api':
          pattern.append('polygon').attr('points', '2,2 6,2 6,6 2,6').attr('fill', 'none').attr('stroke', color)
          break
        default:
          pattern.append('circle').attr('cx', 4).attr('cy', 4).attr('r', 2).attr('fill', color).attr('opacity', 0.3)
      }
    })
  }

  protected createAnimationDefinitions(_defs: SVGDefsElement): void {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes architecture-pulse {
        0%, 100% { 
          opacity: ${this.mode.connectionStyle.opacity}; 
          stroke-width: ${this.mode.connectionStyle.strokeWidth}px;
        }
        50% { 
          opacity: 1; 
          stroke-width: ${this.mode.connectionStyle.strokeWidth + 1}px;
        }
      }
      
      .architecture-connection {
        transition: all ${this.mode.connectionStyle.transitionDuration}ms ease;
      }
      
      .architecture-port {
        transition: all ${this.mode.portStyle.hoverEffect.transitionDuration}ms ease;
      }
    `
    document.head.appendChild(style)
  }

  protected createGridPattern(_canvas: CanvasRenderData, gridStyle: any): void {
    // Architecture mode uses blueprint-style line grid
    const svg = d3.select('.workflow-canvas')
    let defs = svg.select<SVGDefsElement>('defs')
    if (defs.empty()) {
      defs = svg.append<SVGDefsElement>('defs')
    }

    const pattern = defs.append('pattern')
      .attr('id', 'architecture-grid')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', gridStyle.size)
      .attr('height', gridStyle.size)

    // Create blueprint-style grid
    pattern.append('rect')
      .attr('width', gridStyle.size)
      .attr('height', gridStyle.size)
      .attr('fill', 'none')
      .attr('stroke', gridStyle.color)
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', gridStyle.opacity)

    // Apply grid
    svg.select('.grid-layer').selectAll('*').remove()
    svg.select('.grid-layer').append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#architecture-grid)')
  }

  protected createOverlayEffect(_canvas: CanvasRenderData, effect: any): void {
    if (effect.type === 'vignette') {
      const svg = d3.select('.workflow-canvas')
      let defs = svg.select<SVGDefsElement>('defs')
      if (defs.empty()) {
        defs = svg.append<SVGDefsElement>('defs')
      }

      const gradient = defs.append('radialGradient')
        .attr('id', 'architecture-vignette')
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '70%')

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', 'transparent')

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', effect.color)
        .attr('stop-opacity', effect.intensity)

      svg.append('rect')
        .attr('class', 'vignette-overlay')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'url(#architecture-vignette)')
        .attr('pointer-events', 'none')
    }
  }

  private calculateArchitecturalPath(connection: ConnectionRenderData): string {
  const { sourcePoint, targetPoint } = connection
  // Future: could pass node boxes if available via metadata
  return generateOrthogonalRoundedPath(sourcePoint, targetPoint, 18, { strategy: 'auto', allowDoubleBend: false })
  }
}

/**
 * Debug Mode Strategy - High-contrast, technical analysis rendering
 */
export class DebugRenderingStrategy extends BaseRenderingStrategy {
  private readonly debugInfo = new Map<string, any>()

  protected createConnectionElement(connection: ConnectionRenderData): SVGElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', 'debug-connection')
    path.setAttribute('d', this.calculateDebugPath(connection))
    
    // Add debug data attribute
    path.setAttribute('data-debug-id', connection.id)
    this.debugInfo.set(connection.id, {
      type: 'connection',
      dataType: connection.dataType,
      metadata: connection.metadata
    })
    
    return path
  }

  protected createPortElement(port: PortRenderData): SVGElement {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygon.setAttribute('class', 'debug-port')
    
    // Create hexagon shape
    const size = this.mode.portStyle.size / 2
    const points = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3
      const x = port.position.x + size * Math.cos(angle)
      const y = port.position.y + size * Math.sin(angle)
      points.push(`${x},${y}`)
    }
    polygon.setAttribute('points', points.join(' '))
    
    // Add debug data
    polygon.setAttribute('data-debug-id', port.id)
    this.debugInfo.set(port.id, {
      type: 'port',
      dataType: port.dataType,
      connected: port.connected,
      metadata: port.metadata
    })
    
    return polygon
  }

  protected applyConnectionStyling(element: SVGElement, connection: ConnectionRenderData): void {
    const d3Element = d3.select(element)
    const style = this.mode.connectionStyle

    d3Element
      .style('stroke', connection.selected ? this.mode.theme.error : this.mode.theme.primary)
      .style('stroke-width', style.strokeWidth)
      .style('stroke-dasharray', style.strokeDashArray || 'none')
      .style('opacity', style.opacity)
      .style('fill', 'none')
      .style('marker-end', `url(#debug-square-${connection.selected ? 'selected' : 'default'})`)

    // Add technical wave animation
    if (style.animationType === 'wave') {
      d3Element.style('animation', 'debug-wave 1s infinite linear')
    }

    // Add debug label
    this.addDebugLabel(element, connection)
  }

  protected applyPortStyling(element: SVGElement, port: PortRenderData): void {
    const d3Element = d3.select(element)
    const typeColor = this.mode.portStyle.typeIndicators.colorMapping[port.dataType] || this.mode.theme.primary

    d3Element
      .style('fill', port.connected ? typeColor : 'transparent')
      .style('stroke', typeColor)
      .style('stroke-width', this.mode.portStyle.strokeWidth)
      .style('filter', `drop-shadow(0 0 ${this.mode.portStyle.shadowBlur}px ${typeColor})`)

    // Add debug information overlay
    this.addPortDebugInfo(element, port)
  }

  protected createConnectionMarkers(defs: SVGDefsElement): void {
    // Square marker for debug connections
    const defaultMarker = d3.select(defs).append('marker')
      .attr('id', 'debug-square-default')
      .attr('markerWidth', this.mode.connectionStyle.markerSize)
      .attr('markerHeight', this.mode.connectionStyle.markerSize)
      .attr('refX', this.mode.connectionStyle.markerSize - 1)
      .attr('refY', this.mode.connectionStyle.markerSize / 2)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    defaultMarker.append('rect')
      .attr('width', this.mode.connectionStyle.markerSize - 2)
      .attr('height', this.mode.connectionStyle.markerSize - 2)
      .attr('x', 1)
      .attr('y', 1)
      .attr('fill', this.mode.theme.primary)
      .attr('stroke', this.mode.theme.primary)

    // Selected square marker
    const selectedMarker = d3.select(defs).append('marker')
      .attr('id', 'debug-square-selected')
      .attr('markerWidth', this.mode.connectionStyle.markerSize + 2)
      .attr('markerHeight', this.mode.connectionStyle.markerSize + 2)
      .attr('refX', this.mode.connectionStyle.markerSize + 1)
      .attr('refY', (this.mode.connectionStyle.markerSize + 2) / 2)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')

    selectedMarker.append('rect')
      .attr('width', this.mode.connectionStyle.markerSize)
      .attr('height', this.mode.connectionStyle.markerSize)
      .attr('x', 1)
      .attr('y', 1)
      .attr('fill', this.mode.theme.error)
      .attr('stroke', this.mode.theme.error)
      .attr('stroke-width', 2)
      .attr('filter', `drop-shadow(0 0 6px ${this.mode.theme.error})`)
  }

  protected createPortPatterns(defs: SVGDefsElement): void {
    // Create technical patterns for debug mode
    Object.entries(this.mode.portStyle.typeIndicators.colorMapping).forEach(([type, color]) => {
      const pattern = d3.select(defs).append('pattern')
        .attr('id', `debug-port-pattern-${type}`)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 6)
        .attr('height', 6)

      // Technical circuit-like patterns
      pattern.append('rect').attr('width', 6).attr('height', 6).attr('fill', color).attr('opacity', 0.1)
      pattern.append('path').attr('d', 'M0,3 L6,3 M3,0 L3,6').attr('stroke', color).attr('stroke-width', 0.5)
      pattern.append('circle').attr('cx', 3).attr('cy', 3).attr('r', 1).attr('fill', color).attr('opacity', 0.5)
    })
  }

  protected createAnimationDefinitions(_defs: SVGDefsElement): void {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes debug-wave {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: 12; }
      }
      
      .debug-connection {
        transition: all ${this.mode.connectionStyle.transitionDuration}ms linear;
      }
      
      .debug-port {
        transition: all ${this.mode.portStyle.hoverEffect.transitionDuration}ms linear;
      }
      
      .debug-label {
        font-family: 'Courier New', monospace;
        font-size: 10px;
        fill: ${this.mode.theme.foreground};
        pointer-events: none;
      }
    `
    document.head.appendChild(style)
  }

  protected createGridPattern(_canvas: CanvasRenderData, gridStyle: any): void {
    // Debug mode uses technical cross-hatch grid
    const svg = d3.select('.workflow-canvas')
    let defs = svg.select<SVGDefsElement>('defs')
    if (defs.empty()) {
      defs = svg.append<SVGDefsElement>('defs')
    }

    const pattern = defs.append('pattern')
      .attr('id', 'debug-grid')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', gridStyle.size)
      .attr('height', gridStyle.size)

    // Create technical grid pattern
    pattern.append('path')
      .attr('d', `M0,${gridStyle.size/2} L${gridStyle.size},${gridStyle.size/2} M${gridStyle.size/2},0 L${gridStyle.size/2},${gridStyle.size}`)
      .attr('stroke', gridStyle.color)
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '1,1')
      .attr('opacity', gridStyle.opacity)

    // Add center dot
    pattern.append('circle')
      .attr('cx', gridStyle.size / 2)
      .attr('cy', gridStyle.size / 2)
      .attr('r', 0.5)
      .attr('fill', gridStyle.color)
      .attr('opacity', gridStyle.opacity * 1.5)

    // Apply grid
    svg.select('.grid-layer').selectAll('*').remove()
    svg.select('.grid-layer').append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#debug-grid)')
  }

  protected createOverlayEffect(_canvas: CanvasRenderData, effect: any): void {
    const svg = d3.select('.workflow-canvas')
    
    if (effect.type === 'scanlines') {
      // Create animated scanlines effect
      let defs = svg.select<SVGDefsElement>('defs')
      if (defs.empty()) {
        defs = svg.append<SVGDefsElement>('defs')
      }

      const pattern = defs.append('pattern')
        .attr('id', 'debug-scanlines')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 4)
        .attr('height', 4)

      pattern.append('rect')
        .attr('width', 4)
        .attr('height', 2)
        .attr('fill', effect.color)
        .attr('opacity', effect.intensity)

      svg.append('rect')
        .attr('class', 'scanlines-overlay')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'url(#debug-scanlines)')
        .attr('pointer-events', 'none')
        .style('animation', 'debug-scanlines-move 0.1s infinite linear')

      // Add scanlines animation
      const scanlineStyle = document.createElement('style')
      scanlineStyle.textContent = `
        @keyframes debug-scanlines-move {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
      `
      document.head.appendChild(scanlineStyle)
    }

    if (effect.type === 'noise') {
      // Create subtle noise effect
      svg.append('rect')
        .attr('class', 'noise-overlay')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', effect.color)
        .attr('opacity', effect.intensity)
        .attr('pointer-events', 'none')
        .style('mix-blend-mode', 'overlay')
    }
  }

  private calculateDebugPath(connection: ConnectionRenderData): string {
    const { sourcePoint, targetPoint } = connection
    
    // Create technical, segmented path
    const segments = 3
    const points: Point2D[] = [sourcePoint]
    
    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const x = sourcePoint.x + (targetPoint.x - sourcePoint.x) * t
      const y = sourcePoint.y + (targetPoint.y - sourcePoint.y) * t + Math.sin(t * Math.PI * 2) * 5
      points.push({ x, y })
    }
    
    points.push(targetPoint)
    
    return points.map((point, index) => 
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
    ).join(' ')
  }

  private addDebugLabel(element: SVGElement, connection: ConnectionRenderData): void {
    const parent = element.parentElement
    if (!parent) return

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.setAttribute('class', 'debug-label')
    text.setAttribute('x', ((connection.sourcePoint.x + connection.targetPoint.x) / 2).toString())
    text.setAttribute('y', ((connection.sourcePoint.y + connection.targetPoint.y) / 2 - 5).toString())
    text.setAttribute('text-anchor', 'middle')
    text.textContent = `${connection.dataType}:${connection.id.substring(0, 8)}`
    
    parent.appendChild(text)
  }

  private addPortDebugInfo(element: SVGElement, port: PortRenderData): void {
    const parent = element.parentElement
    if (!parent) return

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.setAttribute('class', 'debug-label')
    text.setAttribute('x', (port.position.x + 15).toString())
    text.setAttribute('y', (port.position.y + 3).toString())
    text.textContent = `${port.type}:${port.dataType}`
    
    parent.appendChild(text)
  }

  // Override cleanup to remove debug-specific elements
  cleanup(): void {
    super.cleanup()
    this.debugInfo.clear()
    d3.selectAll('.debug-label').remove()
    d3.selectAll('.scanlines-overlay').remove()
    d3.selectAll('.noise-overlay').remove()
  }
}

// Export strategy factory
export const createRenderingStrategy = (mode: ModeDefinition): ModeRenderingStrategy => {
  switch (mode.id) {
    case 'workflow':
      return new WorkflowRenderingStrategy(mode)
    case 'architecture':
      return new ArchitectureRenderingStrategy(mode)
    case 'debug':
      return new DebugRenderingStrategy(mode)
    default:
      throw new Error(`Unknown mode: ${mode.id}`)
  }
}