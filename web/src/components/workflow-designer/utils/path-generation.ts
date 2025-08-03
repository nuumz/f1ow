/**
 * Path Generation Module
 * Pure functions for generating SVG connection paths between nodes
 */

import type { PortPosition, NodeVariant } from '../types'

/**
 * Configuration for path generation
 */
export interface PathConfig {
  arrowOffset?: number
  controlOffsetMin?: number
  smoothingFactor?: number
}

/**
 * Default path configuration
 */
const DEFAULT_PATH_CONFIG: Required<PathConfig> = {
  arrowOffset: 7,
  controlOffsetMin: 60,
  smoothingFactor: 2.5
}

/**
 * Types of connection flows for different path algorithms
 */
export type ConnectionFlow = 'horizontal' | 'vertical' | 'bottom-to-input'

/**
 * Determines the connection flow type based on port types
 */
export function getConnectionFlow(
  isSourceBottomPort: boolean,
  isTargetBottomPort: boolean
): ConnectionFlow {
  if (isSourceBottomPort) {
    return 'bottom-to-input'
  }
  return 'horizontal'
}

/**
 * Calculates adjusted target position accounting for arrow markers
 */
export function calculateArrowAdjustedPosition(
  source: PortPosition,
  target: PortPosition,
  arrowOffset: number = DEFAULT_PATH_CONFIG.arrowOffset
): PortPosition {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (distance === 0) {
    return target
  }
  
  const offsetRatio = arrowOffset / distance
  return {
    x: target.x - (dx * offsetRatio),
    y: target.y - (dy * offsetRatio)
  }
}

/**
 * Generates control points for horizontal flow connections
 */
export function generateHorizontalControlPoints(
  source: PortPosition,
  target: PortPosition,
  config: Required<PathConfig>
): { cp1: PortPosition; cp2: PortPosition } {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const controlOffset = Math.max(Math.abs(dx) / config.smoothingFactor, config.controlOffsetMin)
  
  return {
    cp1: {
      x: source.x + controlOffset,
      y: source.y + dy * 0.1
    },
    cp2: {
      x: target.x - controlOffset,
      y: target.y - dy * 0.1
    }
  }
}

/**
 * Generates control points for bottom port to input connections
 */
export function generateBottomToInputControlPoints(
  source: PortPosition,
  target: PortPosition,
  config: Required<PathConfig>
): { cp1: PortPosition; cp2: PortPosition } {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const controlOffset = Math.max(Math.abs(dy) / config.smoothingFactor, config.controlOffsetMin)
  
  return {
    cp1: {
      x: source.x, // Keep same x position (straight down)
      y: source.y + controlOffset
    },
    cp2: {
      x: target.x,
      y: target.y - Math.max(Math.abs(dx) / config.smoothingFactor, 40)
    }
  }
}

/**
 * Generates a cubic Bezier curve SVG path
 */
export function generateCubicBezierPath(
  source: PortPosition,
  target: PortPosition,
  cp1: PortPosition,
  cp2: PortPosition
): string {
  return `M ${source.x} ${source.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${target.x} ${target.y}`
}

/**
 * Core path generation function with flow-specific algorithms
 */
export function generateConnectionPath(
  sourcePos: PortPosition,
  targetPos: PortPosition,
  flow: ConnectionFlow,
  config: PathConfig = {}
): string {
  const fullConfig = { ...DEFAULT_PATH_CONFIG, ...config }
  
  // Calculate arrow-adjusted target position
  const adjustedTarget = calculateArrowAdjustedPosition(sourcePos, targetPos, fullConfig.arrowOffset)
  
  // Generate control points based on flow type
  let controlPoints: { cp1: PortPosition; cp2: PortPosition }
  
  switch (flow) {
    case 'bottom-to-input':
      controlPoints = generateBottomToInputControlPoints(sourcePos, adjustedTarget, fullConfig)
      break
    case 'horizontal':
    default:
      controlPoints = generateHorizontalControlPoints(sourcePos, adjustedTarget, fullConfig)
      break
  }
  
  return generateCubicBezierPath(sourcePos, adjustedTarget, controlPoints.cp1, controlPoints.cp2)
}

/**
 * Generates path for connection preview (mouse following)
 */
export function generatePreviewPath(
  sourcePos: PortPosition,
  previewPos: PortPosition,
  flow: ConnectionFlow,
  config: PathConfig = {}
): string {
  return generateConnectionPath(sourcePos, previewPos, flow, config)
}

/**
 * Generates offset path for multiple connections
 */
export function generateOffsetPath(
  sourcePos: PortPosition,
  targetPos: PortPosition,
  offsetY: number,
  config: PathConfig = {}
): string {
  const fullConfig = { ...DEFAULT_PATH_CONFIG, ...config }
  
  // Apply offset to both positions
  const offsetSource: PortPosition = { x: sourcePos.x, y: sourcePos.y + offsetY }
  const offsetTarget: PortPosition = { x: targetPos.x, y: targetPos.y + offsetY }
  
  // Use horizontal flow for offset connections
  return generateConnectionPath(offsetSource, offsetTarget, 'horizontal', fullConfig)
}

/**
 * Calculates Y offset for multiple connections
 */
export function calculateConnectionOffset(
  connectionIndex: number,
  totalConnections: number,
  spacing: number = 15
): number {
  if (totalConnections <= 1) {
    return 0
  }
  
  if (totalConnections === 2) {
    // For 2 connections: one above center, one below center
    return connectionIndex === 0 ? -spacing / 2 : spacing / 2
  }
  
  // For 3+ connections: spread them out evenly
  const totalSpacing = spacing * (totalConnections - 1)
  return (connectionIndex * spacing) - (totalSpacing / 2)
}

/**
 * Validates path generation inputs
 */
export function validatePathInputs(source: PortPosition, target: PortPosition): boolean {
  return (
    isFinite(source.x) && isFinite(source.y) &&
    isFinite(target.x) && isFinite(target.y)
  )
}