import type { WorkflowNode, PortPosition, NodeVariant } from '../types'
import { getPortPositions, getShapeAwareDimensions } from './node-utils'

export type { PortPosition } from '../types'

/**
 * Calculate port position based on node shape, variant, and port configuration
 */
export function calculatePortPosition(
  node: WorkflowNode,
  portId: string,
  portType: 'input' | 'output' | 'bottom',
  variant: NodeVariant = 'standard'
): PortPosition {
  const nodeX = node.x
  const nodeY = node.y

  // Check if this is a bottom port
  if (node.bottomPorts) {
    const bottomPort = node.bottomPorts.find(p => p.id === portId)
    if (bottomPort) {
      const bottomPortIndex = node.bottomPorts.indexOf(bottomPort)
      const dimensions = getShapeAwareDimensions(node)
      const nodeWidth = dimensions.width || 200
      const nodeHeight = dimensions.height || 80
      const portCount = node.bottomPorts.length
      
      // Adjust for variant scaling
      let scale = 1
      if (variant === 'compact') {
        scale = 0.8
      }
      
      // Use the same sophisticated layout algorithm as WorkflowCanvas
      // Use the smaller of: 80% width OR (width - 70px)
      const usableWidth = Math.min(nodeWidth * 0.8, nodeWidth - 70)
      
      let relativeX = 0
      
      if (portCount === 1) {
        // Single port: center it
        relativeX = 0
      } else if (portCount === 2) {
        // Two ports: optimized positioning for visual balance
        const spacing = usableWidth / 3 // Divide available space into thirds
        const positions = [-spacing, spacing] // Place at 1/3 and 2/3 positions
        relativeX = positions[bottomPortIndex] || 0
      } else if (portCount === 3) {
        // Three ports: center one, balance others
        const halfWidth = usableWidth / 2
        const positions = [-halfWidth, 0, halfWidth]
        relativeX = positions[bottomPortIndex] || 0
      } else {
        // Multiple ports (4+): distribute evenly with optimal spacing
        const spacing = usableWidth / (portCount - 1)
        relativeX = -usableWidth / 2 + spacing * bottomPortIndex
      }
      
      const portX = nodeX + (relativeX * scale)
      const portY = nodeY + ((nodeHeight/2) * scale) // Position at diamond location (bottom edge of node)
      
      return { x: portX, y: portY }
    }
  }

  // Find port index in regular ports
  const ports = portType === 'input' ? node.inputs : node.outputs
  const port = ports.find(p => p.id === portId)
  const portIndex = port ? ports.indexOf(port) : 0

  // Get shape-aware port positions - only for input/output ports
  const normalizedPortType = portType === 'bottom' ? 'output' : portType
  const portPositions = getPortPositions(node, normalizedPortType)
  const portPosition = portPositions[portIndex] || { x: 0, y: 0 }

  // Adjust for variant scaling
  let scale = 1
  if (variant === 'compact') {
    scale = 0.8
  }

  const portX = nodeX + (portPosition.x * scale)
  const portY = nodeY + (portPosition.y * scale)

  return { x: portX, y: portY }
}

/**
 * Generate connection path with proper port positioning based on node variants
 */
export function generateVariantAwareConnectionPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string,
  variant: NodeVariant = 'standard'
): string {
  // Determine port types
  const isSourceBottomPort = sourceNode.bottomPorts?.some(p => p.id === sourcePortId)
  const isTargetBottomPort = targetNode.bottomPorts?.some(p => p.id === targetPortId)
  
  const sourcePortType = isSourceBottomPort ? 'bottom' : 'output'
  const targetPortType = isTargetBottomPort ? 'bottom' : 'input'
  
  const sourcePos = calculatePortPosition(sourceNode, sourcePortId, sourcePortType, variant)
  const targetPos = calculatePortPosition(targetNode, targetPortId, targetPortType, variant)

  // Calculate arrow marker offset to align line with arrow center
  // Arrow markers have refX positioning that determines where the line ends
  // Default arrow size is ~14px with refX at size-1 (13px)
  // We need to shorten the line by approximately half the arrow width (7px)
  const arrowOffset = 7
  
  const dx = targetPos.x - sourcePos.x
  const dy = targetPos.y - sourcePos.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Calculate adjusted target position (shortened by arrow offset)
  let adjustedTargetX = targetPos.x
  let adjustedTargetY = targetPos.y
  
  if (distance > 0) {
    const offsetRatio = arrowOffset / distance
    adjustedTargetX = targetPos.x - (dx * offsetRatio)
    adjustedTargetY = targetPos.y - (dy * offsetRatio)
  }
  
  const adjustedDx = adjustedTargetX - sourcePos.x
  const adjustedDy = adjustedTargetY - sourcePos.y
  
  let cp1x, cp1y, cp2x, cp2y
  
  if (isSourceBottomPort) {
    // For bottom ports: first control point goes straight down, second goes to target
    const controlOffset = Math.max(Math.abs(adjustedDy) / 2.5, 60)
    cp1x = sourcePos.x // Keep same x position (straight down)
    cp1y = sourcePos.y + controlOffset // Go down from source
    cp2x = adjustedTargetX // Go to adjusted target x position
    cp2y = adjustedTargetY - Math.max(Math.abs(adjustedDx) / 2.5, 40) // Approach target from above/side
  } else {
    // Regular horizontal flow for normal output ports
    const controlOffset = Math.max(Math.abs(adjustedDx) / 2.5, 60)
    cp1x = sourcePos.x + controlOffset
    cp1y = sourcePos.y + adjustedDy * 0.1
    cp2x = adjustedTargetX - controlOffset  
    cp2y = adjustedTargetY - adjustedDy * 0.1
  }

  return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${adjustedTargetX} ${adjustedTargetY}`
}

/**
 * Calculate port position during connection preview
 */
export function calculateConnectionPreviewPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  previewPosition: { x: number; y: number },
  variant: NodeVariant = 'standard'
): string {
  // Determine if this is a bottom port
  const isBottomPort = sourceNode.bottomPorts?.some(p => p.id === sourcePortId)
  const portType = isBottomPort ? 'bottom' : 'output'
  
  const sourcePos = calculatePortPosition(sourceNode, sourcePortId, portType, variant)
  
  // Apply arrow marker offset for preview path as well
  const arrowOffset = 7
  const dx = previewPosition.x - sourcePos.x
  const dy = previewPosition.y - sourcePos.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Calculate adjusted preview position (shortened by arrow offset)
  let adjustedPreviewX = previewPosition.x
  let adjustedPreviewY = previewPosition.y
  
  if (distance > 0) {
    const offsetRatio = arrowOffset / distance
    adjustedPreviewX = previewPosition.x - (dx * offsetRatio)
    adjustedPreviewY = previewPosition.y - (dy * offsetRatio)
  }
  
  const adjustedDx = adjustedPreviewX - sourcePos.x
  const adjustedDy = adjustedPreviewY - sourcePos.y
  
  let cp1x, cp1y, cp2x, cp2y
  
  if (isBottomPort) {
    // For bottom ports: first control point goes straight down, second goes to preview position
    const controlOffset = Math.max(Math.abs(adjustedDy) / 2.5, 60)
    cp1x = sourcePos.x // Keep same x position (straight down)
    cp1y = sourcePos.y + controlOffset // Go down from source
    cp2x = adjustedPreviewX // Go to adjusted preview x position
    cp2y = adjustedPreviewY - Math.max(Math.abs(adjustedDx) / 2.5, 40) // Approach preview from above/side
  } else {
    // Regular horizontal flow for normal output ports
    const controlOffset = Math.max(Math.abs(adjustedDx) / 2.5, 60)
    cp1x = sourcePos.x + controlOffset
    cp1y = sourcePos.y + adjustedDy * 0.1
    cp2x = adjustedPreviewX - controlOffset  
    cp2y = adjustedPreviewY - adjustedDy * 0.1
  }

  return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${adjustedPreviewX} ${adjustedPreviewY}`
}

/**
 * Generate connection path with offset for multiple connections between same nodes
 */
export function generateMultipleConnectionPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string,
  connectionIndex: number = 0,
  totalConnections: number = 1,
  variant: NodeVariant = 'standard'
): string {
  console.log('🔧 generateMultipleConnectionPath called:', {
    sourceNode: sourceNode.id,
    targetNode: targetNode.id,
    connectionIndex,
    totalConnections,
    sourceX: sourceNode.x,
    sourceY: sourceNode.y,
    targetX: targetNode.x,
    targetY: targetNode.y,
    sourcePortId,
    targetPortId
  })
  
  // If only one connection, use base path
  if (totalConnections <= 1) {
    return generateVariantAwareConnectionPath(sourceNode, sourcePortId, targetNode, targetPortId, variant)
  }
  
  // Validate input nodes have valid positions
  if (!isFinite(sourceNode.x) || !isFinite(sourceNode.y) || 
      !isFinite(targetNode.x) || !isFinite(targetNode.y)) {
    console.warn('Invalid node positions, using fallback')
    return generateVariantAwareConnectionPath(sourceNode, sourcePortId, targetNode, targetPortId, variant)
  }
  
  // Simple fixed approach with debugging
  const sourceX = sourceNode.x + 100 // Right side of source node
  const sourceY = sourceNode.y
  const targetX = targetNode.x - 100 // Left side of target node  
  const targetY = targetNode.y
  
  // Calculate offset for multiple connections
  const spacing = 20 // Pixels between connections
  let yOffset = 0
  
  if (totalConnections === 2) {
    // For 2 connections: one above center, one below center
    yOffset = connectionIndex === 0 ? -spacing/2 : spacing/2
  } else if (totalConnections > 2) {
    // For 3+ connections: spread them out evenly
    const totalSpacing = spacing * (totalConnections - 1)
    yOffset = (connectionIndex * spacing) - (totalSpacing / 2)
  }
  
  // Apply offset to start and end points
  const startX = sourceX
  const startY = sourceY + yOffset
  const endX = targetX  
  const endY = targetY + yOffset
  
  // Calculate control points for smooth curve
  const dx = endX - startX
  const controlOffset = Math.abs(dx) / 2
  
  const cp1x = startX + controlOffset
  const cp1y = startY
  const cp2x = endX - controlOffset
  const cp2y = endY
  
  // Debug all calculated values
  console.log('🔧 Calculated values:', {
    startX, startY, endX, endY,
    cp1x, cp1y, cp2x, cp2y,
    yOffset, spacing, dx, controlOffset
  })
  
  // Validate all values are finite numbers
  const values = [startX, startY, cp1x, cp1y, cp2x, cp2y, endX, endY]
  if (values.some(val => !isFinite(val))) {
    console.warn('❌ Invalid values detected:', values)
    // Return a simple straight line as ultimate fallback
    return `M ${sourceNode.x + 100} ${sourceNode.y} L ${targetNode.x - 100} ${targetNode.y}`
  }
  
  const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`
  console.log('✅ Generated path:', path)
  
  return path
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
  const connectionGroups = new Map<string, Array<any>>()
  
  // Group connections by node pair
  connections.forEach(connection => {
    const groupKey = `${connection.sourceNodeId}->${connection.targetNodeId}`
    
    if (!connectionGroups.has(groupKey)) {
      connectionGroups.set(groupKey, [])
    }
    
    connectionGroups.get(groupKey)!.push(connection)
  })
  
  // Add index and total count to each connection
  const enrichedGroups = new Map<string, Array<any>>()
  
  connectionGroups.forEach((group, groupKey) => {
    const enrichedGroup = group.map((connection, index) => ({
      ...connection,
      index,
      total: group.length
    }))
    
    enrichedGroups.set(groupKey, enrichedGroup)
  })
  
  return enrichedGroups
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
  const connection = connections.find(c => c.id === connectionId)
  if (!connection) {
    return { index: 0, total: 1, isMultiple: false }
  }
  
  // Find all connections between the same node pair
  const sameNodeConnections = connections.filter(c => 
    c.sourceNodeId === connection.sourceNodeId && 
    c.targetNodeId === connection.targetNodeId
  )
  
  const index = sameNodeConnections.findIndex(c => c.id === connectionId)
  const total = sameNodeConnections.length
  
  return {
    index: index >= 0 ? index : 0,
    total,
    isMultiple: total > 1
  }
}

/**
 * Check if a node is a legacy endpoint based on various criteria
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
