/**
 * Connection Utilities - Main API
 * Provides high-level functions for connection path generation and management
 * Uses modular architecture with focused utility modules
 */

import type { WorkflowNode, PortPosition, NodeVariant } from '../types'
import { getShapeAwareDimensions } from './node-utils'

// Shared helpers for virtual side ports (architecture omni-ports)
const isVirtualSidePortId = (id: string) => id.startsWith('__side-')
const getVirtualSidePortPosition = (node: WorkflowNode, portId: string): PortPosition => {
  const dims = getShapeAwareDimensions(node)
  const halfW = (dims.width || 200) / 2
  const halfH = (dims.height || 80) / 2
  switch (portId) {
    case '__side-top':
      return { x: node.x, y: node.y - halfH }
    case '__side-right':
      return { x: node.x + halfW, y: node.y }
    case '__side-bottom':
      return { x: node.x, y: node.y + halfH }
    case '__side-left':
      return { x: node.x - halfW, y: node.y }
    default:
      return { x: node.x, y: node.y }
  }
}

// Import modular utilities
import {
  calculatePortPosition as calculatePortPositionCore,
  getPortType,
  isBottomPort,
  validatePortExists
} from './port-positioning'
import {
  generateConnectionPath,
  generatePreviewPath,
  generateOffsetPath,
  calculateConnectionOffset,
  getConnectionFlow,
  validatePathInputs,
  generateAdaptiveOrthogonalRoundedPathSmart,
  FIXED_LEAD_LENGTH,
  type PathConfig} from './path-generation'
import {
  getConnectionGroupInfo as getConnectionGroupInfoCore,
  analyzeConnectionGroups as analyzeConnectionGroupsCore} from './connection-analysis'

// Re-export types for backward compatibility
export type { PortPosition } from '../types'
export type { PathConfig, ConnectionFlow } from './path-generation'
export { generateOrthogonalRoundedPath, generateAdaptiveOrthogonalRoundedPath } from './path-generation'
export type { AnalyzableConnection, GroupedConnection, ConnectionGroupInfo } from './connection-analysis'

// Local helpers -------------------------------------------------------------
function buildNodeBox(node: WorkflowNode) {
  const dims = getShapeAwareDimensions(node)
  const width = dims.width || 200
  const height = dims.height || 80
  return { x: node.x - width / 2, y: node.y - height / 2, width, height }
}

// Detect which side of the node a port position lies on to infer segment orientation
function detectPortSide(
  node: WorkflowNode,
  portId: string,
  pos: PortPosition
): 'top' | 'bottom' | 'left' | 'right' | 'unknown' {
  // Virtual side ports are explicit
  if (portId === '__side-top') return 'top'
  if (portId === '__side-right') return 'right'
  if (portId === '__side-bottom') return 'bottom'
  if (portId === '__side-left') return 'left'

  const dims = getShapeAwareDimensions(node)
  const halfW = (dims.width || 200) / 2
  const halfH = (dims.height || 80) / 2
  const leftX = node.x - halfW
  const rightX = node.x + halfW
  const topY = node.y - halfH
  const bottomY = node.y + halfH
  const eps = 0.5

  if (Math.abs(pos.x - rightX) <= eps) return 'right'
  if (Math.abs(pos.x - leftX) <= eps) return 'left'
  if (Math.abs(pos.y - topY) <= eps) return 'top'
  if (Math.abs(pos.y - bottomY) <= eps) return 'bottom'

  // Fallback: choose nearest side
  const dxLeft = Math.abs(pos.x - leftX)
  const dxRight = Math.abs(pos.x - rightX)
  const dyTop = Math.abs(pos.y - topY)
  const dyBottom = Math.abs(pos.y - bottomY)
  const minX = Math.min(dxLeft, dxRight)
  const minY = Math.min(dyTop, dyBottom)
  if (minX < minY) return dxLeft < dxRight ? 'left' : 'right'
  return dyTop < dyBottom ? 'top' : 'bottom'
}

function sideToOrientation(side: 'top' | 'bottom' | 'left' | 'right' | 'unknown'): 'vertical' | 'horizontal' {
  if (side === 'top' || side === 'bottom') return 'vertical'
  return 'horizontal'
}

// Choose best target side based on approach vector (leadPoint -> target center)
function chooseAutoTargetSide(
  approachFrom: PortPosition,
  targetNode: WorkflowNode
): '__side-left' | '__side-right' | '__side-top' | '__side-bottom' {
  const cx = targetNode.x
  const cy = targetNode.y
  const dx = cx - approachFrom.x
  const dy = cy - approachFrom.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal approach dominates
    return dx > 0 ? '__side-left' : '__side-right'
  }
  // Vertical approach dominates
  return dy > 0 ? '__side-top' : '__side-bottom'
}

function chooseEndOrientationFromBox(
  approachFrom: PortPosition,
  box?: { x: number; y: number; width: number; height: number }
): 'vertical' | 'horizontal' | undefined {
  if (!box) return undefined
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const dx = cx - approachFrom.x
  const dy = cy - approachFrom.y
  if (Math.abs(dx) >= Math.abs(dy)) return 'horizontal'
  return 'vertical'
}

/**
 * Calculate port position - main API function
 * @deprecated Use calculatePortPositionCore from port-positioning module directly
 */
export function calculatePortPosition(
  node: WorkflowNode,
  portId: string,
  portType: 'input' | 'output' | 'bottom',
  variant: NodeVariant = 'standard'
): PortPosition {
  return calculatePortPositionCore(node, portId, portType, variant)
}

/**
 * Generate connection path with proper port positioning based on node variants
 */
export function generateVariantAwareConnectionPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string,
  variant: NodeVariant = 'standard',
  config?: PathConfig
): string {
  // Determine port types including virtual side-ports
  const isSourceBottomPort = isBottomPort(sourceNode, sourcePortId) || sourcePortId === '__side-bottom'
  const isTargetBottomPort = isBottomPort(targetNode, targetPortId) || targetPortId === '__side-bottom'
  const sourcePortType = isSourceBottomPort ? 'bottom' : 'output'
  const targetPortType = isTargetBottomPort ? 'bottom' : 'input'
  
  // Calculate port positions (use side-port anchors when applicable)
  const sourcePos = isVirtualSidePortId(sourcePortId)
    ? getVirtualSidePortPosition(sourceNode, sourcePortId)
    : calculatePortPositionCore(sourceNode, sourcePortId, sourcePortType, variant)
  const targetPos = isVirtualSidePortId(targetPortId)
    ? getVirtualSidePortPosition(targetNode, targetPortId)
    : calculatePortPositionCore(targetNode, targetPortId, targetPortType, variant)

  // Validate positions
  if (!validatePathInputs(sourcePos, targetPos)) {
    console.warn('Invalid port positions detected, using fallback')
    return `M ${sourceNode.x + 100} ${sourceNode.y} L ${targetNode.x - 100} ${targetNode.y}`
  }

  // Determine connection flow
  const flow = getConnectionFlow(isSourceBottomPort)
  
  // Generate optimized path
  return generateConnectionPath(sourcePos, targetPos, flow, config)
}

/**
 * Calculate port position during connection preview
 */
export function calculateConnectionPreviewPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  previewPosition: { x: number; y: number },
  variant: NodeVariant = 'standard',
  config?: PathConfig,
  modeId: string = 'workflow',
  hoverTargetBox?: { x: number; y: number; width: number; height: number }
): string {
  // Determine if this is a bottom port (include side-bottom)
  const isSourceBottomPort = isBottomPort(sourceNode, sourcePortId) || sourcePortId === '__side-bottom'
  const portType = isSourceBottomPort ? 'bottom' : 'output'
  
  const sourcePos = isVirtualSidePortId(sourcePortId)
    ? getVirtualSidePortPosition(sourceNode, sourcePortId)
    : calculatePortPositionCore(sourceNode, sourcePortId, portType, variant)
  
  // Validate positions
  if (!validatePathInputs(sourcePos, previewPosition)) {
    console.warn('Invalid preview positions detected, using fallback')
    return `M ${sourcePos.x} ${sourcePos.y} L ${previewPosition.x} ${previewPosition.y}`
  }

  // Determine connection flow
  const flow = getConnectionFlow(isSourceBottomPort) // Preview is never to a bottom port
  
  // Architecture mode should preview orthogonal (right‑angle) path with radius to match final rendering
  if (modeId === 'architecture') {
    // Prefer adaptive path to better match final routing around obstacles
    const startSide = detectPortSide(sourceNode, sourcePortId, sourcePos)
    const startOrientation = sideToOrientation(startSide)
    // When starting from a bottom port, snap to target's top/bottom edge center depending on proximity if a hover target box is known
    // Rule: if (topPortTargetY - sourceY) <= 50px => use target bottom port; else use target top port
  const SNAP_THRESHOLD = FIXED_LEAD_LENGTH * 2
    const previewEnd = (isSourceBottomPort && hoverTargetBox)
      ? (() => {
          const sourceY = sourcePos.y
          const topY = hoverTargetBox.y
          const bottomY = hoverTargetBox.y + hoverTargetBox.height
      const useBottom = (topY - sourceY) < SNAP_THRESHOLD
          return { x: hoverTargetBox.x + hoverTargetBox.width / 2, y: useBottom ? bottomY : topY }
        })()
      : previewPosition
    const endOrientation = (isSourceBottomPort && hoverTargetBox)
      ? 'vertical'
      : chooseEndOrientationFromBox(sourcePos, hoverTargetBox)

    // If snapping to bottom in close range, draw a U-shape to avoid overlapping nodes:
    // Down from source, across under both nodes, then up into target bottom.
    if (
      isSourceBottomPort && hoverTargetBox && previewEnd.y === hoverTargetBox.y + hoverTargetBox.height
    ) {
      const srcBox = buildNodeBox(sourceNode)
      const targetBottomY = hoverTargetBox.y + hoverTargetBox.height
      const boxesBottom = Math.max(srcBox.y + srcBox.height, targetBottomY)
      const safeClear = 50
      // Enforce vertical leg min length of FIXED_LEAD_LENGTH for both sides
      const minBelow = Math.max(sourcePos.y, targetBottomY) + FIXED_LEAD_LENGTH
      const midY = Math.max(boxesBottom + safeClear, minBelow)
      return [
        `M ${sourcePos.x} ${sourcePos.y}`,
        `L ${sourcePos.x} ${midY}`,
        `L ${previewEnd.x} ${midY}`,
        `L ${previewEnd.x} ${previewEnd.y}`
      ].join(' ')
    }

    const routed = generateAdaptiveOrthogonalRoundedPathSmart(sourcePos, previewEnd, 16, {
      clearance: 10, // Minimal clearance for tight arrow positioning
      targetBox: hoverTargetBox,
      startOrientationOverride: startOrientation,
      endOrientationOverride: endOrientation
    })
    return routed
  }

  // Generate curved preview path (default)
  return generatePreviewPath(sourcePos, previewPosition, flow, config)
}

/**
 * Mode-aware convenience preview path (wrapper) for callers that know only connectionStart + mouse position.
 */
export function generateModeAwarePreviewPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  previewPosition: { x: number; y: number },
  modeId: string,
  variant: NodeVariant = 'standard',
  config?: PathConfig,
  hoverTargetBox?: { x: number; y: number; width: number; height: number }
): string {
  return calculateConnectionPreviewPath(sourceNode, sourcePortId, previewPosition, variant, config, modeId, hoverTargetBox)
}

/**
 * Generate connection path with offset for multiple connections between same nodes
 * Architecture mode uses bundled representation while workflow mode shows individual lines
 */
export function generateMultipleConnectionPath(opts: {
  sourceNode: WorkflowNode
  sourcePortId: string
  targetNode: WorkflowNode
  targetPortId: string
  connectionIndex?: number
  totalConnections?: number
  variant?: NodeVariant
  mode?: 'workflow' | 'architecture'
  config?: PathConfig
}): string {
  const {
    sourceNode,
    sourcePortId,
    targetNode,
    targetPortId,
    connectionIndex = 0,
    totalConnections = 1,
    variant = 'standard',
    mode = 'workflow',
    config
  } = opts
  // If only one connection, use base path
  if (totalConnections <= 1) {
    return generateVariantAwareConnectionPath(sourceNode, sourcePortId, targetNode, targetPortId, variant, config)
  }
  
  // Validate node positions
  if (!isFinite(sourceNode.x) || !isFinite(sourceNode.y) || 
      !isFinite(targetNode.x) || !isFinite(targetNode.y)) {
    console.warn('Invalid node positions, using fallback')
    return generateVariantAwareConnectionPath(sourceNode, sourcePortId, targetNode, targetPortId, variant, config)
  }
  
  // Architecture mode: Use bundled connection approach
  if (mode === 'architecture') {
    // For architecture mode, all connections follow the same path but have different styles
    return generateVariantAwareConnectionPath(sourceNode, sourcePortId, targetNode, targetPortId, variant, config)
  }
  
  // Workflow mode: Show individual offset lines
  // Use simplified node-edge positioning for multiple connections
  const sourcePos: PortPosition = { x: sourceNode.x + 100, y: sourceNode.y }
  const targetPos: PortPosition = { x: targetNode.x - 100, y: targetNode.y }
  
  // Calculate Y offset for this connection
  const yOffset = calculateConnectionOffset(connectionIndex, totalConnections)
  
  // Validate positions
  if (!validatePathInputs(sourcePos, targetPos)) {
    console.warn('Invalid connection positions, using fallback')
    return `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`
  }
  
  // Generate offset path
  return generateOffsetPath(sourcePos, targetPos, yOffset, config)
}

/**
 * Mode-aware high level convenience API.
 * Accepts a Connection object + node list + mode id and returns appropriate path.
 * - workflow/debug/default => existing bezier logic
 * - architecture => orthogonal with rounded corners (Manhattan style)
 */
export function generateModeAwareConnectionPath(
  connection: { sourceNodeId: string; sourcePortId: string; targetNodeId: string; targetPortId: string },
  nodes: WorkflowNode[],
  variant: NodeVariant = 'standard',
  modeId: string = 'workflow',
  config?: PathConfig
): string {
  const sourceNode = nodes.find(n => n.id === connection.sourceNodeId)
  const targetNode = nodes.find(n => n.id === connection.targetNodeId)
  if (!sourceNode || !targetNode) return ''

  if (modeId === 'architecture') {
    return generateArchitectureModeConnectionPath(sourceNode, targetNode, connection, variant)
  }

  // Fallback to existing bezier
  return generateVariantAwareConnectionPath(
    sourceNode,
    connection.sourcePortId,
    targetNode,
    connection.targetPortId,
    variant,
    config
  )
}

// Extracted to reduce cognitive complexity of generateModeAwareConnectionPath
function generateArchitectureModeConnectionPath(
  sourceNode: WorkflowNode,
  targetNode: WorkflowNode,
  connection: { sourceNodeId: string; sourcePortId: string; targetNodeId: string; targetPortId: string },
  variant: NodeVariant
): string {
  // Use port positioning (including virtual side-port anchors) for start/end, then orthogonal path
  const isSourceBottom = isBottomPort(sourceNode, connection.sourcePortId) || connection.sourcePortId === '__side-bottom'
  const isTargetBottom = isBottomPort(targetNode, connection.targetPortId) || connection.targetPortId === '__side-bottom'
  const sourceType = isSourceBottom ? 'bottom' : 'output'
  const targetType = isTargetBottom ? 'bottom' : 'input'
  const sourcePos = isVirtualSidePortId(connection.sourcePortId)
    ? getVirtualSidePortPosition(sourceNode, connection.sourcePortId)
    : calculatePortPositionCore(sourceNode, connection.sourcePortId, sourceType, variant)
  const targetPos = isVirtualSidePortId(connection.targetPortId)
    ? getVirtualSidePortPosition(targetNode, connection.targetPortId)
    : calculatePortPositionCore(targetNode, connection.targetPortId, targetType, variant)
  if (!validatePathInputs(sourcePos, targetPos)) return ''
  // Build boxes and obstacles for adaptive routing
  const startSide = detectPortSide(sourceNode, connection.sourcePortId, sourcePos)
  const startOrientation = sideToOrientation(startSide)
  // Auto-select target side if targetPortId is not an explicit virtual side
  type SidePortId = '__side-left' | '__side-right' | '__side-top' | '__side-bottom'
  let targetSidePortId: SidePortId
  if (isSourceBottom) {
    // Architecture rule: when starting from bottom port, choose target side based on vertical proximity
    // If target top is within 50px below the source Y, use target bottom; else use target top
  const SNAP_THRESHOLD = FIXED_LEAD_LENGTH * 2
    const tBox = buildNodeBox(targetNode)
    const sourceY = sourcePos.y
    const topY = tBox.y
    const useBottom = (topY - sourceY) < SNAP_THRESHOLD
    targetSidePortId = useBottom ? '__side-bottom' : '__side-top'
  } else if (isVirtualSidePortId(connection.targetPortId)) {
    const tp = connection.targetPortId
    // Narrow to side-port union (fallback to auto if unexpected id)
    targetSidePortId = (tp === '__side-left' || tp === '__side-right' || tp === '__side-top' || tp === '__side-bottom')
      ? tp
      : chooseAutoTargetSide(sourcePos, targetNode)
  } else {
    targetSidePortId = chooseAutoTargetSide(sourcePos, targetNode)
  }
  const autoTargetPos = getVirtualSidePortPosition(targetNode, targetSidePortId)
  const endOrientation = sideToOrientation(detectPortSide(targetNode, targetSidePortId, autoTargetPos))

  // If we chose bottom due to close vertical proximity, draw a U-shape under both nodes to avoid overlap
  if (isSourceBottom && targetSidePortId === '__side-bottom') {
    const srcBox = buildNodeBox(sourceNode)
    const tgtBox = buildNodeBox(targetNode)
  const safeClear = 16
  const boxesBottom = Math.max(srcBox.y + srcBox.height, tgtBox.y + tgtBox.height)
  // Enforce vertical leg min length of FIXED_LEAD_LENGTH for both sides
  const minBelow = Math.max(sourcePos.y, autoTargetPos.y) + FIXED_LEAD_LENGTH
  const midY = Math.max(boxesBottom + safeClear, minBelow)
    return [
      `M ${sourcePos.x} ${sourcePos.y}`,
      `L ${sourcePos.x} ${midY}`,
      `L ${autoTargetPos.x} ${midY}`,
      `L ${autoTargetPos.x} ${autoTargetPos.y}`
    ].join(' ')
  }

  const routed = generateAdaptiveOrthogonalRoundedPathSmart(sourcePos, autoTargetPos, 16, {
    clearance: 10, // Minimal clearance for tight arrow positioning
    targetBox: buildNodeBox(targetNode),
    startOrientationOverride: startOrientation,
    endOrientationOverride: endOrientation
  })
  return routed
}

/**
 * Analyze connections to detect multiple connections between same node pairs
 */
export function analyzeConnectionGroups(connections: Array<{
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourcePortId: string
  targetPortId: string
}>): Map<string, Array<{
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourcePortId: string
  targetPortId: string
  index: number
  total: number
}>> {
  return analyzeConnectionGroupsCore(connections)
}

/**
 * Get connection group information for a specific connection
 */
export function getConnectionGroupInfo(
  connectionId: string,
  connections: Array<{
    id: string
    sourceNodeId: string
    targetNodeId: string
    sourcePortId: string
    targetPortId: string
  }>
): { index: number; total: number; isMultiple: boolean } {
  const groupInfo = getConnectionGroupInfoCore(connectionId, connections)
  return {
    index: groupInfo.index,
    total: groupInfo.total,
    isMultiple: groupInfo.isMultiple
  }
}

/**
 * Check if a node is a legacy endpoint based on various criteria
 * @deprecated This function may no longer be needed - consider removing
 */
export function isLegacyEndpoint(node: WorkflowNode): boolean {
  return (
    node.config?.isLegacyEndpoint ||
    node.type?.includes('legacy') ||
    (node.inputs && node.inputs.length > 3) ||
    (node.outputs && node.outputs.length > 3) ||
    node.metadata?.category?.includes('Legacy') ||
    false
  )
}

// Additional utility functions for better API

/**
 * Validates that all required parameters are present for path generation
 */
export function validateConnectionParameters(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string
): { valid: boolean; reason?: string } {
  if (!sourceNode || !targetNode) {
    return { valid: false, reason: 'Missing source or target node' }
  }
  
  if (!sourcePortId || !targetPortId) {
    return { valid: false, reason: 'Missing port IDs' }
  }
  
  if (!validatePortExists(sourceNode, sourcePortId, getPortType(sourceNode, sourcePortId) || 'output')) {
    return { valid: false, reason: `Source port ${sourcePortId} not found` }
  }
  
  if (!validatePortExists(targetNode, targetPortId, getPortType(targetNode, targetPortId) || 'input')) {
    return { valid: false, reason: `Target port ${targetPortId} not found` }
  }
  
  return { valid: true }
}

/**
 * Creates a high-performance path generator with memoization
 */
export function createOptimizedPathGenerator(config?: PathConfig) {
  const cache = new Map<string, string>()
  
  return {
    generatePath(
      sourceNode: WorkflowNode,
      sourcePortId: string,
      targetNode: WorkflowNode,
      targetPortId: string,
      variant: NodeVariant = 'standard'
    ): string {
      const cacheKey = `${sourceNode.id}:${sourcePortId}->${targetNode.id}:${targetPortId}:${variant}`
      
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!
      }
      
      const path = generateVariantAwareConnectionPath(
        sourceNode, sourcePortId, targetNode, targetPortId, variant, config
      )
      
      cache.set(cacheKey, path)
      return path
    },
    
    clearCache() {
      cache.clear()
    },
    
    getCacheSize() {
      return cache.size
    }
  }
}
