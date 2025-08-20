/**
 * Port Positioning Module
 * Handles calculation of port positions for different node types and variants
 */

import type { WorkflowNode, PortPosition, NodeVariant } from '../types'

// Shared type alias for port kind literals (lint rule: avoid repeating unions)
type PortKind = 'input' | 'output' | 'bottom'
type RegularPortKind = 'input' | 'output'
import { getPortPositions, getShapeAwareDimensions, getNodeShape } from './node-utils'

/**
 * Port calculation configuration
 */
export interface PortConfig {
  variant: NodeVariant
  scale?: number
}

/**
 * Port layout information for bottom ports
 */
interface BottomPortLayout {
  usableWidth: number
  relativeX: number
  scale: number
}

/**
 * Gets the scaling factor for a node variant
 */
export function getVariantScale(variant: NodeVariant): number {
  switch (variant) {
    case 'compact':
      return 0.8
    case 'standard':
    default:
      return 1.0
  }
}

/**
 * Calculates usable width for bottom port positioning
 */
export function calculateUsableWidth(nodeWidth: number): number {
  // Use the smaller of: 80% width OR (width - 70px)
  return Math.min(nodeWidth * 0.8, nodeWidth - 70)
}

/**
 * Calculates relative X position for bottom ports based on port count and index
 */
export function calculateBottomPortRelativeX(
  portIndex: number,
  portCount: number,
  usableWidth: number
): number {
  if (portCount === 1) {
    // Single port: center it
    return 0
  }

  if (portCount === 2) {
    // Two ports: optimized positioning for visual balance
    const spacing = usableWidth / 3 // Divide available space into thirds
    const positions = [-spacing, spacing] // Place at 1/3 and 2/3 positions
    return positions[portIndex] || 0
  }

  if (portCount === 3) {
    // Three ports: center one, balance others
    const halfWidth = usableWidth / 2
    const positions = [-halfWidth, 0, halfWidth]
    return positions[portIndex] || 0
  }

  // Multiple ports (4+): distribute evenly with optimal spacing
  const spacing = usableWidth / (portCount - 1)
  return -usableWidth / 2 + spacing * portIndex
}

/**
 * Calculates bottom port layout information
 */
export function calculateBottomPortLayout(
  node: WorkflowNode,
  portIndex: number,
  variant: NodeVariant
): BottomPortLayout {
  const dimensions = getShapeAwareDimensions(node)
  const nodeWidth = dimensions.width || 200
  const portCount = node.bottomPorts?.length || 0
  const scale = getVariantScale(variant)
  const usableWidth = calculateUsableWidth(nodeWidth)
  const relativeX = calculateBottomPortRelativeX(portIndex, portCount, usableWidth)

  return {
    usableWidth,
    relativeX,
    scale
  }
}

/**
 * Calculates position for a bottom port
 */
export function calculateBottomPortPosition(
  node: WorkflowNode,
  portId: string,
  variant: NodeVariant = 'standard'
): PortPosition | null {
  if (!node.bottomPorts) {
    return null
  }

  const bottomPort = node.bottomPorts.find(p => p.id === portId)
  if (!bottomPort) {
    return null
  }

  const bottomPortIndex = node.bottomPorts.indexOf(bottomPort)
  const dimensions = getShapeAwareDimensions(node)
  const nodeHeight = dimensions.height || 80

  const layout = calculateBottomPortLayout(node, bottomPortIndex, variant)

  const portX = node.x + (layout.relativeX * layout.scale)
  // If the node is a diamond, its rendered bottom tip is at 0.75 * halfHeight
  const shape = getNodeShape(node.type)
  const halfH = (nodeHeight / 2)
  const bottomOffset = shape === 'diamond' ? halfH * 0.75 : halfH
  const portY = node.y + (bottomOffset * layout.scale)

  return { x: portX, y: portY }
}

/**
 * Calculates position for a regular input/output port
 */
export function calculateRegularPortPosition(
  node: WorkflowNode,
  portId: string,
  portType: RegularPortKind,
  variant: NodeVariant = 'standard'
): PortPosition {
  // Find port index in regular ports
  const ports = portType === 'input' ? node.inputs : node.outputs
  const port = ports.find(p => p.id === portId)
  const portIndex = port ? ports.indexOf(port) : 0

  // Get shape-aware port positions
  const portPositions = getPortPositions(node, portType)
  const basePosition = portPositions[portIndex] || { x: 0, y: 0 }

  // Apply variant scaling
  const scale = getVariantScale(variant)

  return {
    x: node.x + (basePosition.x * scale),
    y: node.y + (basePosition.y * scale)
  }
}

/**
 * Main port position calculation function
 * Determines port type and delegates to appropriate calculation function
 */
export function calculatePortPosition(
  node: WorkflowNode,
  portId: string,
  portType: PortKind,
  variant: NodeVariant = 'standard'
): PortPosition {
  // Handle bottom ports
  if (portType === 'bottom' || node.bottomPorts?.some(p => p.id === portId)) {
    const bottomPortPosition = calculateBottomPortPosition(node, portId, variant)
    if (bottomPortPosition) {
      return bottomPortPosition
    }
  }

  // Handle regular input/output ports
  const normalizedPortType: RegularPortKind = portType === 'bottom' ? 'output' : portType
  return calculateRegularPortPosition(node, portId, normalizedPortType, variant)
}

/**
 * Batch calculates positions for multiple ports
 */
export function calculateMultiplePortPositions(
  node: WorkflowNode,
  portConfigs: Array<{ portId: string; portType: PortKind }>,
  variant: NodeVariant = 'standard'
): PortPosition[] {
  return portConfigs.map(config =>
    calculatePortPosition(node, config.portId, config.portType, variant)
  )
}

/**
 * Gets all port positions for a node
 */
export function getAllNodePortPositions(
  node: WorkflowNode,
  variant: NodeVariant = 'standard'
): {
  inputs: PortPosition[]
  outputs: PortPosition[]
  bottomPorts: PortPosition[]
} {
  const inputs = node.inputs.map(port =>
    calculatePortPosition(node, port.id, 'input', variant)
  )

  const outputs = node.outputs.map(port =>
    calculatePortPosition(node, port.id, 'output', variant)
  )

  const bottomPorts = (node.bottomPorts || []).map(port =>
    calculatePortPosition(node, port.id, 'bottom', variant)
  )

  return { inputs, outputs, bottomPorts }
}

/**
 * Validates that a port exists on a node
 */
export function validatePortExists(
  node: WorkflowNode,
  portId: string,
  portType: PortKind
): boolean {
  switch (portType) {
    case 'input':
      return node.inputs.some(p => p.id === portId)
    case 'output':
      return node.outputs.some(p => p.id === portId)
    case 'bottom':
      return node.bottomPorts?.some(p => p.id === portId) || false
    default:
      return false
  }
}

/**
 * Determines if a port is a bottom port
 */
export function isBottomPort(node: WorkflowNode, portId: string): boolean {
  return node.bottomPorts?.some(p => p.id === portId) || false
}

/**
 * Gets the appropriate port type for a given port ID
 */
export function getPortType(node: WorkflowNode, portId: string): PortKind | null {
  if (node.inputs.some(p => p.id === portId)) {
    return 'input'
  }
  if (node.outputs.some(p => p.id === portId)) {
    return 'output'
  }
  if (node.bottomPorts?.some(p => p.id === portId)) {
    return 'bottom'
  }
  return null
}

/**
 * Computes port positions for rectangular and square shapes
 * For squares, the rendered path uses an inner 0.8 scale, so use the inner edge for port centers
 */
export function computeRectPortPositions(
  dimensions: { width: number; height: number },
  portCount: number,
  portType: 'input' | 'output',
  shape: 'rectangle' | 'square'
): Array<{ x: number; y: number }> {
  const spacing = dimensions.height / (portCount + 1)
  const positions: Array<{ x: number; y: number }> = []

  for (let i = 0; i < portCount; i++) {
    const y = -dimensions.height / 2 + spacing * (i + 1)
    // For squares, the path inner half-size is width/2 * 0.8; for rectangles it's width/2
    const half = shape === 'square' ? (dimensions.width / 2) * 0.8 : dimensions.width / 2
    const x = portType === 'input' ? -half : half
    positions.push({ x, y })
  }

  return positions
}

/**
 * Computes port positions for circular shapes
 */
export function computeCirclePortPositions(
  dimensions: { width: number; height: number },
  portCount: number
): Array<{ x: number; y: number }> {
  const angleStep = (Math.PI * 2) / Math.max(1, portCount)
  const radius = Math.min(dimensions.width, dimensions.height) / 2
  const positions: Array<{ x: number; y: number }> = []

  for (let i = 0; i < portCount; i++) {
    const angle = angleStep * i
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    positions.push({ x, y })
  }

  return positions
}

/**
 * Computes port positions for diamond shapes
 */
export function computeDiamondPortPositions(
  dimensions: { width: number; height: number },
  portCount: number,
  portType: 'input' | 'output'
): Array<{ x: number; y: number }> {
  const halfWidth = dimensions.width / 2
  const effectiveHalfHeight = (dimensions.height / 2) * 0.75
  const effectiveHeight = effectiveHalfHeight * 2
  const spacing = Math.min(25, effectiveHeight / (portCount + 1))
  const startY = -((portCount - 1) * spacing) / 2
  const positions: Array<{ x: number; y: number }> = []

  for (let i = 0; i < portCount; i++) {
    const y = startY + i * spacing
    const widthAtY = Math.max(
      0,
      halfWidth * (1 - Math.min(1, Math.abs(y) / Math.max(1e-6, effectiveHalfHeight)))
    )
    const x = (portType === 'input' ? -1 : 1) * widthAtY
    positions.push({ x, y })
  }

  return positions
}