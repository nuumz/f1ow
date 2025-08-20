/**
 * Connection Utilities - Main API
 * Provides high-level functions for connection path generation and management
 * Uses modular architecture with focused utility modules
 */

import type { WorkflowNode, PortPosition, NodeVariant } from '../types'
import { getShapeAwareDimensions } from './node-utils'

// Shared helpers for virtual side ports (architecture omni-ports)
const isVirtualSidePortId = (id: string) => id.startsWith('__side-')

// Architecture mode fixed sizing (must match WorkflowCanvas getConfigurableDimensions)
const ARCH_SIZE = 56

// Mode-aware dimensions helper
function getModeAwareDimensions(node: WorkflowNode, modeId?: string) {
  if (modeId === 'architecture') {
    return { width: ARCH_SIZE, height: ARCH_SIZE }
  }
  const dims = getShapeAwareDimensions(node)
  return { width: dims.width || 200, height: dims.height || 80 }
}

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

// Mode-aware virtual side port position
function getVirtualSidePortPositionForMode(node: WorkflowNode, portId: string, modeId?: string): PortPosition {
  const dims = getModeAwareDimensions(node, modeId)
  const halfW = (dims.width) / 2
  const halfH = (dims.height) / 2
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
  type PathConfig,
  buildRoundedPathFromPoints
} from './path-generation'
import {
  getConnectionGroupInfo as getConnectionGroupInfoCore,
  analyzeConnectionGroups as analyzeConnectionGroupsCore
} from './connection-analysis'

// Façade exports for connection logic (single import point)
export type { PortPosition } from '../types'
export type { PathConfig, ConnectionFlow } from './path-generation'
export {
  generateOrthogonalRoundedPath,
  generateAdaptiveOrthogonalRoundedPath,
  generateAdaptiveOrthogonalRoundedPathSmart,
  FIXED_LEAD_LENGTH,
} from './path-generation'
export type {
  AnalyzableConnection,
  GroupedConnection,
  ConnectionGroupInfo,
  ConnectionGroupStats,
} from './connection-analysis'
export {
  getConnectionGroupInfo as getConnectionGroupInfoFromList,
  findConnectionsBetweenNodes,
  findConnectionsForNode,
} from './connection-analysis'

// Local helpers -------------------------------------------------------------
type PortSide = 'top' | 'bottom' | 'left' | 'right' | 'unknown'
// Shared alias for architecture virtual side-ports
type SidePortId = '__side-left' | '__side-right' | '__side-top' | '__side-bottom'
function buildNodeBox(node: WorkflowNode) {
  const dims = getShapeAwareDimensions(node)
  const width = dims.width || 200
  const height = dims.height || 80
  return { x: node.x - width / 2, y: node.y - height / 2, width, height }
}

function buildNodeBoxModeAware(node: WorkflowNode, modeId?: string) {
  const dims = getModeAwareDimensions(node, modeId)
  const width = dims.width
  const height = dims.height
  return { x: node.x - width / 2, y: node.y - height / 2, width, height }
}

// Detect which side of the node a port position lies on to infer segment orientation
// NOTE: legacy detectPortSide removed; use detectPortSideModeAware instead

function detectPortSideModeAware(
  node: WorkflowNode,
  portId: string,
  pos: PortPosition,
  modeId?: string
): PortSide {
  if (portId === '__side-top') { return 'top' }
  if (portId === '__side-right') { return 'right' }
  if (portId === '__side-bottom') { return 'bottom' }
  if (portId === '__side-left') { return 'left' }

  const dims = getModeAwareDimensions(node, modeId)
  const halfW = dims.width / 2
  const halfH = dims.height / 2
  const leftX = node.x - halfW
  const rightX = node.x + halfW
  const topY = node.y - halfH
  const bottomY = node.y + halfH
  const eps = 0.5

  if (Math.abs(pos.x - rightX) <= eps) { return 'right' }
  if (Math.abs(pos.x - leftX) <= eps) { return 'left' }
  if (Math.abs(pos.y - topY) <= eps) { return 'top' }
  if (Math.abs(pos.y - bottomY) <= eps) { return 'bottom' }

  // Fallback: choose nearest side
  const dxLeft = Math.abs(pos.x - leftX)
  const dxRight = Math.abs(pos.x - rightX)
  const dyTop = Math.abs(pos.y - topY)
  const dyBottom = Math.abs(pos.y - bottomY)
  const minX = Math.min(dxLeft, dxRight)
  const minY = Math.min(dyTop, dyBottom)
  if (minX < minY) { return dxLeft < dxRight ? 'left' : 'right' }
  return dyTop < dyBottom ? 'top' : 'bottom'
}

function sideToOrientation(side: 'top' | 'bottom' | 'left' | 'right' | 'unknown'): 'vertical' | 'horizontal' {
  if (side === 'top' || side === 'bottom') { return 'vertical' }
  return 'horizontal'
}

// Choose best target side based on approach vector (leadPoint -> target center)
function chooseAutoTargetSide(
  approachFrom: PortPosition,
  targetNode: WorkflowNode
): SidePortId {
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

// chooseEndOrientationFromBox removed (unused after refactor)

// Helper: compute source port position for preview, mode-aware
function computeSourcePosForPreview(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  portType: 'bottom' | 'output',
  variant: NodeVariant,
  modeId: string
): PortPosition {
  if (modeId !== 'architecture') {
    return isVirtualSidePortId(sourcePortId)
      ? getVirtualSidePortPosition(sourceNode, sourcePortId)
      : calculatePortPositionCore(sourceNode, sourcePortId, portType, variant)
  }
  if (isVirtualSidePortId(sourcePortId)) {
    return getVirtualSidePortPositionForMode(sourceNode, sourcePortId, modeId)
  }
  const dims = getModeAwareDimensions(sourceNode, modeId)
  if (portType === 'bottom') {
    const ports = sourceNode.bottomPorts || []
    const idx = Math.max(0, ports.findIndex(p => p.id === sourcePortId))
    const portCount = ports.length
    const usableWidth = Math.min(dims.width * 0.8, dims.width - 70)
    if (portCount === 2) {
      const spacing = usableWidth / 3
      const positions = [-spacing, spacing]
      return { x: sourceNode.x + (positions[idx] || 0), y: sourceNode.y + dims.height / 2 }
    }
    if (portCount === 3) {
      const halfWidth = usableWidth / 2
      const positions = [-halfWidth, 0, halfWidth]
      return { x: sourceNode.x + (positions[idx] || 0), y: sourceNode.y + dims.height / 2 }
    }
    if (portCount >= 4) {
      const spacing = usableWidth / (portCount - 1)
      const x = -usableWidth / 2 + spacing * idx
      return { x: sourceNode.x + x, y: sourceNode.y + dims.height / 2 }
    }
    return { x: sourceNode.x, y: sourceNode.y + dims.height / 2 }
  }
  const ports = sourceNode.outputs
  const idx = Math.max(0, ports.findIndex(p => p.id === sourcePortId))
  const count = ports.length || 1
  const spacing = dims.height / (count + 1)
  const y = -dims.height / 2 + spacing * (idx + 1)
  const x = dims.width / 2
  return { x: sourceNode.x + x, y: sourceNode.y + y }
}

// Helper: trim a point outward by side (architecture marker)
function trimPointBySide(pt: { x: number; y: number }, side: SidePortId | undefined, sourcePos: PortPosition, HALF_MARKER = 5.5) {
  // Prefer explicit outward trim based on side to avoid arrowheads entering nodes.
  if (side === '__side-left') { return { x: pt.x - HALF_MARKER, y: pt.y } }
  if (side === '__side-right') { return { x: pt.x + HALF_MARKER, y: pt.y } }
  if (side === '__side-top') { return { x: pt.x, y: pt.y - HALF_MARKER } }
  if (side === '__side-bottom') { return { x: pt.x, y: pt.y + HALF_MARKER } }

  // Fallback when side is undefined: infer direction from the approach vector
  const dx = pt.x - sourcePos.x
  const dy = pt.y - sourcePos.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    const dirX = Math.sign(dx) || 1
    return { x: pt.x + dirX * HALF_MARKER, y: pt.y }
  }
  const dirY = Math.sign(dy) || 1
  return { x: pt.x, y: pt.y + dirY * HALF_MARKER }
}

// Helper: compute snap end for architecture preview
type SnapResult = { previewEnd: { x: number; y: number }; chosenSide?: SidePortId; endOrientation?: 'vertical' | 'horizontal' }

function snapToHoverTargetBox(args: {
  hoverTargetBox: { x: number; y: number; width: number; height: number }
  startSide: PortSide
  isSourceBottomPort: boolean
  sourcePos: PortPosition
}): SnapResult | null {
  const { hoverTargetBox, startSide: _startSide, isSourceBottomPort, sourcePos } = args
  const centerX = hoverTargetBox.x + hoverTargetBox.width / 2
  const centerY = hoverTargetBox.y + hoverTargetBox.height / 2
  const SNAP_THRESHOLD = FIXED_LEAD_LENGTH * 2
  if (isSourceBottomPort) {
    const topY = hoverTargetBox.y
    const bottomY = hoverTargetBox.y + hoverTargetBox.height
    const useBottom = (topY - sourcePos.y) < SNAP_THRESHOLD
    return { previewEnd: { x: centerX, y: useBottom ? bottomY : topY }, chosenSide: useBottom ? '__side-bottom' : '__side-top', endOrientation: 'vertical' }
  }
  // For non-bottom starts (left, right, top), choose optimal side based on geometry
  const mockTarget: WorkflowNode = { id: 'mock-target', label: 'Mock Target', x: centerX, y: centerY, type: 'mock', inputs: [], outputs: [], config: {} }
  const optimalSide = chooseAutoTargetSide(sourcePos, mockTarget)
  let posBySide: { x: number; y: number }
  switch (optimalSide) {
    case '__side-left': posBySide = { x: hoverTargetBox.x, y: centerY }; break
    case '__side-right': posBySide = { x: hoverTargetBox.x + hoverTargetBox.width, y: centerY }; break
    case '__side-top': posBySide = { x: centerX, y: hoverTargetBox.y }; break
    default: posBySide = { x: centerX, y: hoverTargetBox.y + hoverTargetBox.height }
  }
  return { previewEnd: posBySide, chosenSide: optimalSide, endOrientation: (optimalSide === '__side-left' || optimalSide === '__side-right') ? 'horizontal' : 'vertical' }
}

function snapToAvailableNodes(args: {
  availableNodes?: WorkflowNode[]
  previewPosition: { x: number; y: number }
  sourceNode: WorkflowNode
  sourcePos: PortPosition
}): SnapResult | null {
  const { availableNodes, previewPosition, sourceNode, sourcePos } = args
  if (!availableNodes || availableNodes.length === 0) { return null }
  const snapTarget = findNearbySnapTargets(previewPosition, availableNodes, sourceNode, sourcePos, 50)
  if (!snapTarget) { return null }
  return {
    previewEnd: { x: snapTarget.x, y: snapTarget.y },
    chosenSide: snapTarget.targetSide,
    endOrientation: (snapTarget.targetSide === '__side-left' || snapTarget.targetSide === '__side-right') ? 'horizontal' : 'vertical'
  }
}

function computeArchitecturePreviewSnapEnd(params: {
  hoverTargetBox?: { x: number; y: number; width: number; height: number }
  availableNodes?: WorkflowNode[]
  previewPosition: { x: number; y: number }
  startSide: PortSide
  isSourceBottomPort: boolean
  sourcePos: PortPosition
  sourceNode: WorkflowNode
}): SnapResult {
  const { hoverTargetBox, availableNodes, previewPosition, startSide, isSourceBottomPort, sourcePos, sourceNode } = params
  const hoverSnap = hoverTargetBox
    ? snapToHoverTargetBox({ hoverTargetBox, startSide, isSourceBottomPort, sourcePos })
    : null
  if (hoverSnap) { return hoverSnap }
  const nodeSnap = snapToAvailableNodes({ availableNodes, previewPosition, sourceNode, sourcePos })
  if (nodeSnap) { return nodeSnap }
  const gridSize = 20
  return { previewEnd: { x: Math.round(previewPosition.x / gridSize) * gridSize, y: Math.round(previewPosition.y / gridSize) * gridSize } }
}

// Helper: bottom U route for preview
function maybeBottomUPathForPreview(args: {
  isSourceBottomPort: boolean
  hoverTargetBox?: { x: number; y: number; width: number; height: number }
  previewEnd: { x: number; y: number }
  sourceNode: WorkflowNode
  sourcePos: PortPosition
  HALF_MARKER: number
}): string | null {
  const { isSourceBottomPort, hoverTargetBox, previewEnd, sourceNode, sourcePos, HALF_MARKER } = args
  if (!(isSourceBottomPort && hoverTargetBox && previewEnd.y === hoverTargetBox.y + hoverTargetBox.height)) { return null }
  const srcBox = buildNodeBox(sourceNode)
  const targetBottomY = hoverTargetBox.y + hoverTargetBox.height
  const boxesBottom = Math.max(srcBox.y + srcBox.height, targetBottomY)
  const safeClear = 16
  const minBelow = Math.max(sourcePos.y, targetBottomY) + FIXED_LEAD_LENGTH
  const midY = Math.max(boxesBottom + safeClear, minBelow)
  // Trim end by marker size using shared helper to align arrow tip with bottom edge
  const bottomUTrimmedEndCorrected = trimPointBySide({ x: previewEnd.x, y: previewEnd.y }, '__side-bottom', sourcePos, HALF_MARKER)
  return [
    `M ${sourcePos.x} ${sourcePos.y}`,
    `L ${sourcePos.x} ${midY}`,
    `L ${bottomUTrimmedEndCorrected.x} ${midY}`,
    `L ${bottomUTrimmedEndCorrected.x} ${bottomUTrimmedEndCorrected.y}`
  ].join(' ')
}

// Helper: horizontal U route for preview
function maybeHorizontalUPathForPreview(args: {
  hoverTargetBox?: { x: number; y: number; width: number; height: number }
  sourceNode: WorkflowNode
  sourcePortId: string
  sourcePos: PortPosition
  modeId: string
}): string | null {
  const { hoverTargetBox, sourceNode, sourcePortId, sourcePos, modeId } = args
  if (!hoverTargetBox) { return null }
  const startSidePrev = detectPortSideModeAware(sourceNode, sourcePortId, sourcePos, modeId)
  const srcBox = buildNodeBox(sourceNode)
  const centerY = hoverTargetBox.y + hoverTargetBox.height / 2
  const centerX = hoverTargetBox.x + hoverTargetBox.width / 2
  const safeClear = 16
  if (startSidePrev === 'right') {
    const isCloseHorizontally = (centerX - sourcePos.x) < FIXED_LEAD_LENGTH
    if (isCloseHorizontally) {
      const rightEdgeCenter = { x: hoverTargetBox.x + hoverTargetBox.width, y: centerY }
      const boxesRight = Math.max(srcBox.x + srcBox.width, hoverTargetBox.x + hoverTargetBox.width)
      const minRight = Math.max(sourcePos.x, rightEdgeCenter.x) + FIXED_LEAD_LENGTH
      const midX = Math.max(boxesRight + safeClear, minRight)
      return [
        `M ${sourcePos.x} ${sourcePos.y}`,
        `L ${midX} ${sourcePos.y}`,
        `L ${midX} ${rightEdgeCenter.y}`,
        `L ${rightEdgeCenter.x} ${rightEdgeCenter.y}`
      ].join(' ')
    }
  }
  if (startSidePrev === 'left') {
    const isCloseHorizontally = (sourcePos.x - centerX) < FIXED_LEAD_LENGTH
    if (isCloseHorizontally) {
      const leftEdgeCenter = { x: hoverTargetBox.x, y: centerY }
      const boxesLeft = Math.min(srcBox.x, hoverTargetBox.x)
      const minLeft = Math.min(sourcePos.x, leftEdgeCenter.x) - FIXED_LEAD_LENGTH
      const midX = Math.min(boxesLeft - safeClear, minLeft)
      return [
        `M ${sourcePos.x} ${sourcePos.y}`,
        `L ${midX} ${sourcePos.y}`,
        `L ${midX} ${leftEdgeCenter.y}`,
        `L ${leftEdgeCenter.x} ${leftEdgeCenter.y}`
      ].join(' ')
    }
  }
  return null
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
 * Find nearby snap targets using same logic as final connection path
 * This ensures preview path matches final path behavior
 */
function findNearbySnapTargets(
  mousePos: { x: number; y: number },
  availableNodes: WorkflowNode[],
  sourceNode: WorkflowNode,
  sourcePos: PortPosition,
  snapDistance: number = 50
): { x: number; y: number; type: 'port' | 'edge'; targetNode: WorkflowNode; targetSide: SidePortId } | null {
  const candidates: Array<{
    x: number;
    y: number;
    type: 'port' | 'edge';
    distance: number;
    targetNode: WorkflowNode;
    targetSide: SidePortId;
  }> = []

  for (const node of availableNodes) {
    if (node.id === sourceNode.id) { continue } // Skip source node

    const nodeDistance = Math.sqrt(
      Math.pow(mousePos.x - node.x, 2) + Math.pow(mousePos.y - node.y, 2)
    )
    if (nodeDistance > snapDistance * 2) { continue } // Skip distant nodes for performance

    // Use same target side selection logic as final connection
    const optimalTargetSide = chooseAutoTargetSide(sourcePos, node)
    const optimalTargetPos = getVirtualSidePortPositionForMode(node, optimalTargetSide, 'architecture')

    const targetDistance = Math.sqrt(
      Math.pow(mousePos.x - optimalTargetPos.x, 2) + Math.pow(mousePos.y - optimalTargetPos.y, 2)
    )

    if (targetDistance <= snapDistance) {
      candidates.push({
        x: optimalTargetPos.x,
        y: optimalTargetPos.y,
        type: 'edge',
        distance: targetDistance,
        targetNode: node,
        targetSide: optimalTargetSide
      })
    }
  }

  // Return the closest candidate using optimal target side selection
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.distance - b.distance)
    return candidates[0]
  }

  return null
}

/**
 * Calculate port position during connection preview
 */
export function calculateConnectionPreviewPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  previewPosition: { x: number; y: number },
  opts?: {
    variant?: NodeVariant
    config?: PathConfig
    modeId?: string
    hoverTargetBox?: { x: number; y: number; width: number; height: number }
    availableNodes?: WorkflowNode[]
  }
): string { // NOSONAR: readability prioritized over cognitive complexity metric here
  // Helpers extracted to reduce complexity
  // Architecture markers use size=10 (see marker-utils); half is 5px
  const HALF_MARKER = 5

  const variant: NodeVariant = opts?.variant ?? 'standard'
  const config: PathConfig | undefined = opts?.config
  const modeId: string = opts?.modeId ?? 'workflow'
  const hoverTargetBox = opts?.hoverTargetBox
  const availableNodes = opts?.availableNodes

  const isSourceBottomPort = isBottomPort(sourceNode, sourcePortId) || sourcePortId === '__side-bottom'
  const portType = isSourceBottomPort ? 'bottom' : 'output'

  // Mode-aware port position for accurate endpoint alignment
  const sourcePos: PortPosition = computeSourcePosForPreview(sourceNode, sourcePortId, portType, variant, modeId)

  // Validate positions
  if (!validatePathInputs(sourcePos, previewPosition)) {
    console.warn('Invalid preview positions detected, using fallback')
    return `M ${sourcePos.x} ${sourcePos.y} L ${previewPosition.x} ${previewPosition.y}`
  }

  // Determine connection flow
  const flow = getConnectionFlow(isSourceBottomPort) // Preview is never to a bottom port

  // Architecture mode should preview orthogonal (right‑angle) path with radius to match final rendering
  if (modeId === 'architecture') {
    const startSide = detectPortSideModeAware(sourceNode, sourcePortId, sourcePos, modeId)
    const startOrientation = sideToOrientation(startSide)
    const { previewEnd, chosenSide, endOrientation } = computeArchitecturePreviewSnapEnd({
      hoverTargetBox,
      availableNodes,
      previewPosition,
      startSide,
      isSourceBottomPort,
      sourcePos,
      sourceNode
    })

    const bottomU = maybeBottomUPathForPreview({ isSourceBottomPort, hoverTargetBox, previewEnd, sourceNode, sourcePos, HALF_MARKER })
    if (bottomU) { return bottomU }

    const horizontalU = maybeHorizontalUPathForPreview({ hoverTargetBox, sourceNode, sourcePortId, sourcePos, modeId })
    if (horizontalU) { return horizontalU }

    const trimmedEndPreview = trimPointBySide(previewEnd, chosenSide, sourcePos, HALF_MARKER)
    return generateAdaptiveOrthogonalRoundedPathSmart(sourcePos, trimmedEndPreview, 16, {
      clearance: 10,
      targetBox: hoverTargetBox,
      startOrientationOverride: startOrientation,
      endOrientationOverride: endOrientation
    })
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
  options: {
    modeId: string
    variant?: NodeVariant
    config?: PathConfig
    hoverTargetBox?: { x: number; y: number; width: number; height: number }
    availableNodes?: WorkflowNode[]
  }
): string {
  const { modeId, variant = 'standard', config, hoverTargetBox, availableNodes } = options
  return calculateConnectionPreviewPath(sourceNode, sourcePortId, previewPosition, { variant, config, modeId, hoverTargetBox, availableNodes })
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
    // For architecture mode, use the orthogonal path generator with fixed sizing so endpoints align with ports
    return generateArchitectureModeConnectionPath(
      sourceNode,
      targetNode,
      { sourceNodeId: sourceNode.id, sourcePortId, targetNodeId: targetNode.id, targetPortId }
    )
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
  if (!sourceNode || !targetNode) { return '' }

  if (modeId === 'architecture') {
    return generateArchitectureModeConnectionPath(sourceNode, targetNode, connection)
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
  connection: { sourceNodeId: string; sourcePortId: string; targetNodeId: string; targetPortId: string }
): string {
  // Lightweight caches
  const boxCache = new Map<WorkflowNode, { x: number; y: number; width: number; height: number }>()
  const portPosCache = new WeakMap<WorkflowNode, Map<string, { x: number; y: number }>>()
  const cachedBuildNodeBoxModeAware = (node: WorkflowNode) => {
    const hit = boxCache.get(node)
    if (hit) { return hit }
    const box = buildNodeBoxModeAware(node, 'architecture')
    boxCache.set(node, box)
    return box
  }
  const cachedSidePort = (node: WorkflowNode, side: SidePortId) => {
    let inner = portPosCache.get(node)
    if (!inner) { inner = new Map<string, { x: number; y: number }>(); portPosCache.set(node, inner) }
    const key = `${side}|architecture`
    const hit = inner.get(key)
    if (hit) { return hit }
    const pos = getVirtualSidePortPositionForMode(node, side, 'architecture')
    inner.set(key, pos)
    return pos
  }

  const isSourceBottom = isBottomPort(sourceNode, connection.sourcePortId) || connection.sourcePortId === '__side-bottom'
  const isTargetBottom = isBottomPort(targetNode, connection.targetPortId) || connection.targetPortId === '__side-bottom'
  const sourceType = isSourceBottom ? 'bottom' : 'output'
  const targetType = isTargetBottom ? 'bottom' : 'input'
  const sourceDims = getModeAwareDimensions(sourceNode, 'architecture')
  const targetDims = getModeAwareDimensions(targetNode, 'architecture')

  const computeArchPortPos = (node: WorkflowNode, portId: string, portType: 'bottom' | 'input' | 'output', dims: { width: number; height: number }): PortPosition => {
    if (isVirtualSidePortId(portId)) { return getVirtualSidePortPositionForMode(node, portId, 'architecture') }
    if (portType === 'bottom') {
      const ports = node.bottomPorts || []
      const idx = Math.max(0, ports.findIndex(p => p.id === portId))
      const count = ports.length
      const usableWidth = Math.min(dims.width * 0.8, dims.width - 70)
      if (count === 2) {
        const spacing = usableWidth / 3; const positions = [-spacing, spacing]
        return { x: node.x + (positions[idx] || 0), y: node.y + dims.height / 2 }
      }
      if (count === 3) {
        const half = usableWidth / 2; const positions = [-half, 0, half]
        return { x: node.x + (positions[idx] || 0), y: node.y + dims.height / 2 }
      }
      if (count >= 4) {
        const spacing = usableWidth / (count - 1)
        const relX = -usableWidth / 2 + spacing * idx
        return { x: node.x + relX, y: node.y + dims.height / 2 }
      }
      return { x: node.x, y: node.y + dims.height / 2 }
    }
    const ports = portType === 'input' ? node.inputs : node.outputs
    const idx = Math.max(0, ports.findIndex(p => p.id === portId))
    const count = ports.length || 1
    const spacing = dims.height / (count + 1)
    const y = -dims.height / 2 + spacing * (idx + 1)
    const x = portType === 'input' ? -dims.width / 2 : dims.width / 2
    return { x: node.x + x, y: node.y + y }
  }

  const sourcePos = computeArchPortPos(sourceNode, connection.sourcePortId, sourceType, sourceDims)
  const targetPos = computeArchPortPos(targetNode, connection.targetPortId, targetType, targetDims)
  if (!validatePathInputs(sourcePos, targetPos)) { return '' }

  const startSide = detectPortSideModeAware(sourceNode, connection.sourcePortId, sourcePos, 'architecture')
  const startOrientation = sideToOrientation(startSide)

  const chooseTargetSide = (): SidePortId => {
    if (isSourceBottom) {
      const SNAP_THRESHOLD = FIXED_LEAD_LENGTH * 2
      const tBox = cachedBuildNodeBoxModeAware(targetNode)
      const useBottom = (tBox.y - sourcePos.y) < SNAP_THRESHOLD
      return useBottom ? '__side-bottom' : '__side-top'
    }
    if (isVirtualSidePortId(connection.targetPortId)) {
      const tp = connection.targetPortId
      return (tp === '__side-left' || tp === '__side-right' || tp === '__side-top' || tp === '__side-bottom')
        ? tp
        : chooseAutoTargetSide(sourcePos, targetNode)
    }
    return chooseAutoTargetSide(sourcePos, targetNode)
  }

  const targetSidePortId = chooseTargetSide()
  // Align end point to the exact target port position, not just the side midpoint
  // Use the selected side's axis for X/Y while preserving the port's orthogonal coordinate
  const sideAnchor = getVirtualSidePortPositionForMode(targetNode, targetSidePortId, 'architecture')
  const preciseEnd: { x: number; y: number } = ((): { x: number; y: number } => {
    switch (targetSidePortId) {
      case '__side-left':
      case '__side-right':
        return { x: sideAnchor.x, y: targetPos.y } // lock to side X, keep exact port Y
      case '__side-top':
      case '__side-bottom':
      default: {
        // For top/bottom termination:
        // - If the actual target is a bottom port (or virtual bottom side), keep its exact X
        // - Otherwise, use the side center X to keep arrowhead centered on the edge
        const isActualBottomTarget = isTargetBottom
        const endX = isActualBottomTarget ? targetPos.x : sideAnchor.x
        return { x: endX, y: sideAnchor.y }
      }
    }
  })()
  const endOrientation = sideToOrientation(detectPortSideModeAware(targetNode, targetSidePortId, preciseEnd, 'architecture'))

  // Architecture markers use size=10; half is 5px for accurate trim
  const HALF_MARKER = 5
  // Use shared direction-aware trimming to offset the end point by half the marker size
  const trimmedEnd = trimPointBySide(preciseEnd, targetSidePortId, sourcePos, HALF_MARKER)

  // Bottom U-shape special-case
  if (isSourceBottom && targetSidePortId === '__side-bottom') {
    const srcBox = cachedBuildNodeBoxModeAware(sourceNode)
    const tgtBox = cachedBuildNodeBoxModeAware(targetNode)
    const safeClear = 16
    const boxesBottom = Math.max(srcBox.y + srcBox.height, tgtBox.y + tgtBox.height)
    const minBelow = Math.max(sourcePos.y, preciseEnd.y) + FIXED_LEAD_LENGTH
    const midY = Math.max(boxesBottom + safeClear, minBelow)
    // Build rounded U path via explicit waypoints
    const bottomUTrimmedEnd = trimPointBySide(preciseEnd, '__side-bottom', sourcePos, HALF_MARKER)
    const points = [
      { x: sourcePos.x, y: sourcePos.y },
      { x: sourcePos.x, y: midY },
      { x: bottomUTrimmedEnd.x, y: midY },
      { x: bottomUTrimmedEnd.x, y: bottomUTrimmedEnd.y }
    ]
    return buildRoundedPathFromPoints(points, 12)
  }

  // Horizontal U-shapes for close proximity
  const maybeRightU = (): string | null => {
    if (startSide !== 'right') { return null }
    const forcedRightPos = cachedSidePort(targetNode, '__side-right')
    const isCloseHorizontally = (targetNode.x - sourcePos.x) < FIXED_LEAD_LENGTH
    if (!isCloseHorizontally) { return null }
    const srcBox = cachedBuildNodeBoxModeAware(sourceNode)
    const tgtBox = cachedBuildNodeBoxModeAware(targetNode)
    const safeClear = 16
    const boxesRight = Math.max(srcBox.x + srcBox.width, tgtBox.x + tgtBox.width)
    const minRight = Math.max(sourcePos.x, forcedRightPos.x) + FIXED_LEAD_LENGTH
    const midX = Math.max(boxesRight + safeClear, minRight)
    // Align end to the exact target port Y then trim using shared helper and round corners
    const rightAligned = { x: forcedRightPos.x, y: targetPos.y }
    const rightUTrimmedEnd = trimPointBySide(rightAligned, '__side-right', sourcePos, HALF_MARKER)
    const points = [
      { x: sourcePos.x, y: sourcePos.y },
      { x: midX, y: sourcePos.y },
      { x: midX, y: rightUTrimmedEnd.y },
      { x: rightUTrimmedEnd.x, y: rightUTrimmedEnd.y }
    ]
    return buildRoundedPathFromPoints(points, 12)
  }
  const rightU = maybeRightU(); if (rightU) { return rightU }

  const maybeLeftU = (): string | null => {
    if (startSide !== 'left') { return null }
    const forcedLeftPos = cachedSidePort(targetNode, '__side-left')
    const isCloseHorizontally = (sourcePos.x - targetNode.x) < FIXED_LEAD_LENGTH
    if (!isCloseHorizontally) { return null }
    const srcBox = cachedBuildNodeBoxModeAware(sourceNode)
    const tgtBox = cachedBuildNodeBoxModeAware(targetNode)
    const safeClear = 16
    const boxesLeft = Math.min(srcBox.x, tgtBox.x)
    const minLeft = Math.min(sourcePos.x, forcedLeftPos.x) - FIXED_LEAD_LENGTH
    const midX = Math.min(boxesLeft - safeClear, minLeft)
    // Align end to the exact target port Y then trim using shared helper and round corners
    const leftAligned = { x: forcedLeftPos.x, y: targetPos.y }
    const leftUTrimmedEnd = trimPointBySide(leftAligned, '__side-left', sourcePos, HALF_MARKER)
    const points = [
      { x: sourcePos.x, y: sourcePos.y },
      { x: midX, y: sourcePos.y },
      { x: midX, y: leftUTrimmedEnd.y },
      { x: leftUTrimmedEnd.x, y: leftUTrimmedEnd.y }
    ]
    return buildRoundedPathFromPoints(points, 12)
  }
  const leftU = maybeLeftU(); if (leftU) { return leftU }

  return generateAdaptiveOrthogonalRoundedPathSmart(sourcePos, trimmedEnd, 16, {
    clearance: 10,
    targetBox: cachedBuildNodeBoxModeAware(targetNode),
    startOrientationOverride: startOrientation,
    endOrientationOverride: endOrientation
  })
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
