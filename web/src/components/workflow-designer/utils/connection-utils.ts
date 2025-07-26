import type { WorkflowNode, PortPosition, NodeVariant } from '../types'
import { getNodeDimensions } from '../components/nodes/NodeRenderer'

export type { PortPosition } from '../types'

/**
 * Calculate port position based on node variant, size, and port configuration
 */
export function calculatePortPosition(
  node: WorkflowNode,
  portId: string,
  portType: 'input' | 'output',
  variant: NodeVariant = 'standard'
): PortPosition {
  const dimensions = getNodeDimensions(node)
  const nodeX = node.x
  const nodeY = node.y

  // Find port index
  const ports = portType === 'input' ? node.inputs : node.outputs
  const port = ports.find(p => p.id === portId)
  const portIndex = port ? ports.indexOf(port) : 0

  let portX: number
  let portY: number

  switch (variant) {
    case 'compact': {
      // Compact variant - ports aligned towards bottom/top
      if (portType === 'input') {
        portX = nodeX - dimensions.width / 2
        const inputPortY = dimensions.height / 2
        portY = nodeY + inputPortY - (node.inputs.length - 1) * 15 + portIndex * 30
      } else {
        portX = nodeX + dimensions.width / 2
        const outputPortY = dimensions.height / 2
        portY = nodeY + outputPortY - (node.outputs.length - 1) * 15 + portIndex * 30
      }
      break
    }

    case 'standard': {
      // Standard variant - ports in content area
      if (portType === 'input') {
        portX = nodeX - dimensions.width / 2
        const contentStartY = 10
        portY = nodeY + contentStartY + portIndex * 25
      } else {
        portX = nodeX + dimensions.width / 2
        const contentStartY = 10
        portY = nodeY + contentStartY + portIndex * 25
      }
      break
    }

    default: {
      // Fallback to standard
      if (portType === 'input') {
        portX = nodeX - dimensions.width / 2
        portY = nodeY + 40 + portIndex * 30
      } else {
        portX = nodeX + dimensions.width / 2
        portY = nodeY + 40 + portIndex * 30
      }
    }
  }

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
  const sourcePos = calculatePortPosition(sourceNode, sourcePortId, 'output', variant)
  const targetPos = calculatePortPosition(targetNode, targetPortId, 'input', variant)

  const dx = targetPos.x - sourcePos.x
  const dy = targetPos.y - sourcePos.y
  
  // Calculate control points for smooth curve
  const controlOffset = Math.max(Math.abs(dx) / 2.5, 60)
  
  const cp1x = sourcePos.x + controlOffset
  const cp1y = sourcePos.y + dy * 0.1
  const cp2x = targetPos.x - controlOffset  
  const cp2y = targetPos.y - dy * 0.1

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
  const sourcePos = calculatePortPosition(sourceNode, sourcePortId, 'output', variant)
  
  const dx = previewPosition.x - sourcePos.x
  const dy = previewPosition.y - sourcePos.y
  const controlOffset = Math.max(Math.abs(dx) / 2.5, 60)
  
  const cp1x = sourcePos.x + controlOffset
  const cp1y = sourcePos.y + dy * 0.1
  const cp2x = previewPosition.x - controlOffset  
  const cp2y = previewPosition.y - dy * 0.1

  return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${previewPosition.x} ${previewPosition.y}`
}
