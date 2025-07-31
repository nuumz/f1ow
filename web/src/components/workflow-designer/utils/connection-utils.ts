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
      const spacing = nodeWidth / (node.bottomPorts.length + 1)
      
      // Adjust for variant scaling
      let scale = 1
      if (variant === 'compact') {
        scale = 0.8
      }
      
      const portX = nodeX + ((-nodeWidth/2 + spacing * (bottomPortIndex + 1)) * scale)
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

  const dx = targetPos.x - sourcePos.x
  const dy = targetPos.y - sourcePos.y
  
  let cp1x, cp1y, cp2x, cp2y
  
  if (isSourceBottomPort) {
    // For bottom ports: first control point goes straight down, second goes to target
    const controlOffset = Math.max(Math.abs(dy) / 2.5, 60)
    cp1x = sourcePos.x // Keep same x position (straight down)
    cp1y = sourcePos.y + controlOffset // Go down from source
    cp2x = targetPos.x // Go to target x position
    cp2y = targetPos.y - Math.max(Math.abs(dx) / 2.5, 40) // Approach target from above/side
  } else {
    // Regular horizontal flow for normal output ports
    const controlOffset = Math.max(Math.abs(dx) / 2.5, 60)
    cp1x = sourcePos.x + controlOffset
    cp1y = sourcePos.y + dy * 0.1
    cp2x = targetPos.x - controlOffset  
    cp2y = targetPos.y - dy * 0.1
  }

  return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${targetPos.x} ${targetPos.y}`
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
  
  const dx = previewPosition.x - sourcePos.x
  const dy = previewPosition.y - sourcePos.y
  
  let cp1x, cp1y, cp2x, cp2y
  
  if (isBottomPort) {
    // For bottom ports: first control point goes straight down, second goes to preview position
    const controlOffset = Math.max(Math.abs(dy) / 2.5, 60)
    cp1x = sourcePos.x // Keep same x position (straight down)
    cp1y = sourcePos.y + controlOffset // Go down from source
    cp2x = previewPosition.x // Go to preview x position
    cp2y = previewPosition.y - Math.max(Math.abs(dx) / 2.5, 40) // Approach preview from above/side
  } else {
    // Regular horizontal flow for normal output ports
    const controlOffset = Math.max(Math.abs(dx) / 2.5, 60)
    cp1x = sourcePos.x + controlOffset
    cp1y = sourcePos.y + dy * 0.1
    cp2x = previewPosition.x - controlOffset  
    cp2y = previewPosition.y - dy * 0.1
  }

  return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${previewPosition.x} ${previewPosition.y}`
}
