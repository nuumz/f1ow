/**
 * Connection Utilities - Main API
 * Provides high-level functions for connection path generation and management
 * Uses modular architecture with focused utility modules
 */

import type { WorkflowNode, PortPosition, NodeVariant } from '../types'

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
  type PathConfig,
  type ConnectionFlow
} from './path-generation'
import {
  getConnectionGroupInfo as getConnectionGroupInfoCore,
  analyzeConnectionGroups as analyzeConnectionGroupsCore,
  type AnalyzableConnection,
  type GroupedConnection,
  type ConnectionGroupInfo
} from './connection-analysis'
import { validatePositions } from './geometry-utils'

// Re-export types for backward compatibility
export type { PortPosition } from '../types'
export type { PathConfig, ConnectionFlow } from './path-generation'
export type { AnalyzableConnection, GroupedConnection, ConnectionGroupInfo } from './connection-analysis'

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
  // Determine port types
  const isSourceBottomPort = isBottomPort(sourceNode, sourcePortId)
  const isTargetBottomPort = isBottomPort(targetNode, targetPortId)
  
  const sourcePortType = isSourceBottomPort ? 'bottom' : 'output'
  const targetPortType = isTargetBottomPort ? 'bottom' : 'input'
  
  // Calculate port positions
  const sourcePos = calculatePortPositionCore(sourceNode, sourcePortId, sourcePortType, variant)
  const targetPos = calculatePortPositionCore(targetNode, targetPortId, targetPortType, variant)

  // Validate positions
  if (!validatePathInputs(sourcePos, targetPos)) {
    console.warn('Invalid port positions detected, using fallback')
    return `M ${sourceNode.x + 100} ${sourceNode.y} L ${targetNode.x - 100} ${targetNode.y}`
  }

  // Determine connection flow
  const flow = getConnectionFlow(isSourceBottomPort, isTargetBottomPort)
  
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
  config?: PathConfig
): string {
  // Determine if this is a bottom port
  const isSourceBottomPort = isBottomPort(sourceNode, sourcePortId)
  const portType = isSourceBottomPort ? 'bottom' : 'output'
  
  const sourcePos = calculatePortPositionCore(sourceNode, sourcePortId, portType, variant)
  
  // Validate positions
  if (!validatePathInputs(sourcePos, previewPosition)) {
    console.warn('Invalid preview positions detected, using fallback')
    return `M ${sourcePos.x} ${sourcePos.y} L ${previewPosition.x} ${previewPosition.y}`
  }

  // Determine connection flow
  const flow = getConnectionFlow(isSourceBottomPort, false) // Preview is never to a bottom port
  
  // Generate preview path
  return generatePreviewPath(sourcePos, previewPosition, flow, config)
}

/**
 * Generate connection path with offset for multiple connections between same nodes
 * Architecture mode uses bundled representation while workflow mode shows individual lines
 */
export function generateMultipleConnectionPath(
  sourceNode: WorkflowNode,
  sourcePortId: string,
  targetNode: WorkflowNode,
  targetPortId: string,
  connectionIndex: number = 0,
  totalConnections: number = 1,
  variant: NodeVariant = 'standard',
  mode: 'workflow' | 'architecture' = 'workflow',
  config?: PathConfig
): string {
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
