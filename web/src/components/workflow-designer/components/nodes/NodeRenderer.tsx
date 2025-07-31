import type { WorkflowNode, NodeTheme, NodeRenderProps } from '../../types'
import { CompactNode } from './variants/CompactNode'
import { StandardNode } from './variants/StandardNode'

export type { NodeVariant, NodeTheme, NodeRenderProps } from '../../types'

/**
 * Main NodeRenderer component that delegates to specific variant components
 */
export function NodeRenderer(props: NodeRenderProps) {
  const { variant = 'standard' } = props

  switch (variant) {
    case 'compact':
      return <CompactNode {...props} />
    case 'standard':
      return <StandardNode {...props} />
    default:
      return <StandardNode {...props} />
  }
}

// Single size configuration
export const NodeSize = {
  width: 200,
  minHeight: 80,
  fontSize: 12,
  iconSize: 18,
  portRadius: 6
}

export function getNodeDimensions(node: WorkflowNode) {
  const portCount = Math.max(node.inputs.length, node.outputs.length)
  const calculatedHeight = Math.max(NodeSize.minHeight, portCount * 30 + 60)
  
  return {
    width: NodeSize.width,
    height: calculatedHeight,
    fontSize: NodeSize.fontSize,
    iconSize: NodeSize.iconSize,
    portRadius: NodeSize.portRadius
  }
}

// Default theme
export const DefaultTheme: NodeTheme = {
  backgroundColor: '#ffffff',
  borderColor: '#ddd',
  textColor: '#333',
  accentColor: '#2196F3',
  shadowColor: 'rgba(0,0,0,0.1)',
  borderRadius: 8,
  borderWidth: 2
}

// Pre-defined themes
export const NodeThemes = {
  default: DefaultTheme,
  dark: {
    backgroundColor: '#2d2d2d',
    borderColor: '#555',
    textColor: '#fff',
    accentColor: '#64B5F6',
    shadowColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    borderWidth: 2
  },
  success: {
    backgroundColor: '#f1f8e9',
    borderColor: '#4caf50',
    textColor: '#2e7d32',
    accentColor: '#4caf50',
    shadowColor: 'rgba(76,175,80,0.2)',
    borderRadius: 8,
    borderWidth: 2
  },
  warning: {
    backgroundColor: '#fff8e1',
    borderColor: '#ff9800',
    textColor: '#ef6c00',
    accentColor: '#ff9800',
    shadowColor: 'rgba(255,152,0,0.2)',
    borderRadius: 8,
    borderWidth: 2
  },
  error: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    textColor: '#c62828',
    accentColor: '#f44336',
    shadowColor: 'rgba(244,67,54,0.2)',
    borderRadius: 8,
    borderWidth: 2
  }
}