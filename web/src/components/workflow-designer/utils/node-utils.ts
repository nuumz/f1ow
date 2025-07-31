/**
 * Node utility functions
 * Helper functions for working with workflow nodes using centralized types
 */

import type { WorkflowNode, NodeDefinition, Position, SelectionArea, NodeShape } from '../types'
import { 
  NodeTypes, 
  getNodeColor as getCentralizedNodeColor,
  getNodeIcon as getCentralizedNodeIcon, 
  getPortColor as getCentralizedPortColor,
  getNodeDefinition as getCentralizedNodeDefinition
} from '../types/nodes'
import { 
  getShapeDimensions, 
  getShapePath, 
  getNodeShape as getShapeFromType,
  getPortPositions as getShapePortPositions,
  isPointInShape
} from './shape-utils'

// Constants
export const NODE_WIDTH = 200
export const NODE_MIN_HEIGHT = 80
export const PORT_RADIUS = 6

// Re-export centralized functions with same names for backward compatibility
export const getNodeColor = getCentralizedNodeColor
export const getNodeIcon = getCentralizedNodeIcon
export const getPortColor = getCentralizedPortColor

/**
 * Get node shape based on type
 */
export function getNodeShape(nodeType: string): NodeShape {
  const nodeInfo = NodeTypes[nodeType]
  return getShapeFromType(nodeType, nodeInfo)
}

/**
 * Get shape-aware dimensions for a node
 */
export function getShapeAwareDimensions(node: WorkflowNode) {
  const shape = getNodeShape(node.type)
  const baseWidth = getNodeWidth(node)
  const baseHeight = getNodeHeight(node)
  
  return getShapeDimensions(shape, baseWidth, baseHeight)
}

/**
 * Get SVG path for node shape
 */
export function getNodeShapePath(node: WorkflowNode, borderRadius: number | { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number } = 8) {
  const shape = getNodeShape(node.type)
  const dimensions = getShapeAwareDimensions(node)
  
  return getShapePath(shape, dimensions.width, dimensions.height, borderRadius)
}

/**
 * Get port positions for a node based on its shape
 */
export function getPortPositions(node: WorkflowNode, portType: 'input' | 'output') {
  const shape = getNodeShape(node.type)
  const dimensions = getShapeAwareDimensions(node)
  const portCount = portType === 'input' ? node.inputs.length : node.outputs.length
  
  return getShapePortPositions(shape, dimensions, portCount, portType)
}

/**
 * Get node definition (backward compatibility wrapper)
 */
export function getNodeDefinition(type: string): NodeDefinition {
  return getCentralizedNodeDefinition(type)
}

/**
 * Calculate node height based on port count
 */
export function getNodeHeight(node: WorkflowNode): number {
  const portCount = Math.max(node.inputs.length, node.outputs.length)
  const baseHeight = Math.max(NODE_MIN_HEIGHT, portCount * 30 + 60)
  // Bottom ports don't need extra height - they're positioned at the edge
  const bottomPortsHeight = 0
  return baseHeight + bottomPortsHeight
}

/**
 * Calculate node width based on label length and type
 */
export function getNodeWidth(node: WorkflowNode): number {
  // Base width
  let width = NODE_WIDTH
  
  // Adjust for label length
  const labelLength = node.label.length
  if (labelLength > 15) {
    width = Math.max(width, labelLength * 8)
  }
  
  // Adjust for port count
  const maxPorts = Math.max(node.inputs.length, node.outputs.length)
  if (maxPorts > 3) {
    width = Math.max(width, NODE_WIDTH + 20)
  }
  
  return Math.min(width, 300) // Cap at 300px
}

/**
 * Create a new workflow node
 */
export function createNode(type: string, position: Position): WorkflowNode {
  const definition = getNodeDefinition(type)
  const nodeInfo = NodeTypes[type]
  
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    type,
    label: nodeInfo?.label || 'New Node',
    x: position.x,
    y: position.y,
    config: definition.defaultConfig || {},
    inputs: definition.inputs,
    outputs: definition.outputs,
    bottomPorts: definition.bottomPorts,
    status: 'idle'
  }
}

/**
 * Validate if two nodes can be connected
 */
export function canConnect(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string
): boolean {
  // Cannot connect to self
  if (sourceNode.id === targetNode.id) {
    return false
  }
  
  // Find ports
  const sourcePort = sourceNode.outputs.find(p => p.id === sourcePortId)
  let targetPort = targetNode.inputs.find(p => p.id === targetPortId)
  
  // If not found in regular inputs, check bottom ports
  if (!targetPort && targetNode.bottomPorts) {
    targetPort = targetNode.bottomPorts.find(p => p.id === targetPortId)
  }
  
  if (!sourcePort || !targetPort) {
    return false
  }
  
  // Check data type compatibility
  if (sourcePort.dataType !== 'any' && targetPort.dataType !== 'any') {
    if (sourcePort.dataType !== targetPort.dataType) {
      return false
    }
  }
  
  return true
}

/**
 * Get all nodes in a rectangular selection area
 */
export function getNodesInArea(
  nodes: WorkflowNode[],
  area: SelectionArea
): WorkflowNode[] {
  return nodes.filter(node => {
    const nodeRight = node.x + (node.width || NODE_WIDTH)
    const nodeBottom = node.y + (node.height || getNodeHeight(node))
    const areaRight = area.x + area.width
    const areaBottom = area.y + area.height
    
    return (
      node.x < areaRight &&
      nodeRight > area.x &&
      node.y < areaBottom &&
      nodeBottom > area.y
    )
  })
}

/**
 * Calculate distance between two nodes
 */
export function getNodeDistance(node1: WorkflowNode, node2: WorkflowNode): number {
  const dx = node1.x - node2.x
  const dy = node1.y - node2.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Find the closest node to a given position
 */
export function findClosestNode(
  nodes: WorkflowNode[],
  position: Position,
  excludeNodeId?: string
): WorkflowNode | null {
  let closest: WorkflowNode | null = null
  let minDistance = Infinity
  
  for (const node of nodes) {
    if (excludeNodeId && node.id === excludeNodeId) {
      continue
    }
    
    const distance = Math.sqrt(
      Math.pow(node.x - position.x, 2) + Math.pow(node.y - position.y, 2)
    )
    
    if (distance < minDistance) {
      minDistance = distance
      closest = node
    }
  }
  
  return closest
}

/**
 * Check if a position is within a node's bounds (shape-aware)
 */
export function isPositionInNode(position: Position, node: WorkflowNode): boolean {
  const dimensions = getShapeAwareDimensions(node)
  const shape = getNodeShape(node.type)
  const nodeCenter = { x: node.x, y: node.y }
  
  // Use shape-aware hit testing
  return isPointInShape(shape, position, dimensions, nodeCenter)
}

/**
 * Get node bounds
 */
export function getNodeBounds(node: WorkflowNode) {
  const width = node.width || getNodeWidth(node)
  const height = node.height || getNodeHeight(node)
  
  return {
    x: node.x,
    y: node.y,
    width,
    height,
    centerX: node.x + width / 2,
    centerY: node.y + height / 2,
    right: node.x + width,
    bottom: node.y + height
  }
}

/**
 * Calculate optimal position for a new node to avoid overlaps
 */
export function findOptimalNodePosition(
  existingNodes: WorkflowNode[],
  preferredPosition?: Position
): Position {
  const baseX = preferredPosition?.x || 100
  const baseY = preferredPosition?.y || 100
  const spacing = 50
  
  // Try the preferred position first
  let testPosition = { x: baseX, y: baseY }
  
  for (let attempt = 0; attempt < 20; attempt++) {
    const hasOverlap = existingNodes.some(node => {
      const distance = Math.sqrt(
        Math.pow(node.x - testPosition.x, 2) + Math.pow(node.y - testPosition.y, 2)
      )
      return distance < NODE_WIDTH + spacing
    })
    
    if (!hasOverlap) {
      return testPosition
    }
    
    // Try next position in a spiral pattern
    const angle = (attempt * 137.5) * (Math.PI / 180) // Golden angle
    const radius = Math.sqrt(attempt + 1) * spacing
    testPosition = {
      x: baseX + Math.cos(angle) * radius,
      y: baseY + Math.sin(angle) * radius
    }
  }
  
  return testPosition
}

/**
 * Get all nodes of a specific type
 */
export function getNodesByType(nodes: WorkflowNode[], type: string): WorkflowNode[] {
  return nodes.filter(node => node.type === type)
}

/**
 * Get all connected nodes for a given node
 */
export function getConnectedNodes(
  node: WorkflowNode, 
  allNodes: WorkflowNode[], 
  connections: Array<{ sourceNodeId: string; targetNodeId: string }>
): WorkflowNode[] {
  const connectedNodeIds = new Set<string>()
  
  connections.forEach(conn => {
    if (conn.sourceNodeId === node.id) {
      connectedNodeIds.add(conn.targetNodeId)
    }
    if (conn.targetNodeId === node.id) {
      connectedNodeIds.add(conn.sourceNodeId)
    }
  })
  
  return allNodes.filter(n => connectedNodeIds.has(n.id))
}

/**
 * Calculate workflow bounds (bounding box of all nodes)
 */
export function getWorkflowBounds(nodes: WorkflowNode[]) {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  
  nodes.forEach(node => {
    const bounds = getNodeBounds(node)
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.right)
    maxY = Math.max(maxY, bounds.bottom)
  })
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

// Re-export types for backward compatibility
export type { WorkflowNode, NodeDefinition } from '../types'
export { NodeTypes } from '../types/nodes'
