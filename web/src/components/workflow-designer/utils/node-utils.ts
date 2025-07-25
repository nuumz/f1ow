import type { WorkflowNode } from '../hooks/useNodeSelection'

export interface NodePort {
  id: string
  type: 'input' | 'output'
  dataType: string
  label: string
  required?: boolean
  multiple?: boolean
  connected?: boolean
}

export interface NodeDefinition {
  inputs: NodePort[]
  outputs: NodePort[]
  defaultConfig?: any
}

// Constants
export const NODE_WIDTH = 200
export const NODE_MIN_HEIGHT = 80
export const PORT_RADIUS = 6

// Enhanced node type definitions with comprehensive n8n compatibility
export const NodeTypes = {
  // Core/Control Flow nodes
  start: { icon: '▶️', color: '#4CAF50', label: 'Start' },
  if: { icon: '❓', color: '#FF9800', label: 'IF' },
  switch: { icon: '🔀', color: '#9C27B0', label: 'Switch' },
  merge: { icon: '🔗', color: '#607D8B', label: 'Merge' },
  split: { icon: '✂️', color: '#795548', label: 'Split In Batches' },
  loop: { icon: '🔁', color: '#00BCD4', label: 'Loop Over Items' },
  wait: { icon: '⏳', color: '#FFEB3B', label: 'Wait' },
  stop: { icon: '🛑', color: '#F44336', label: 'Stop and Error' },
  
  // Data Processing nodes
  set: { icon: '📝', color: '#2196F3', label: 'Set' },
  edit: { icon: '✏️', color: '#3F51B5', label: 'Edit Fields' },
  code: { icon: '💻', color: '#4CAF50', label: 'Code' },
  function: { icon: '⚙️', color: '#9E9E9E', label: 'Function' },
  filter: { icon: '🔍', color: '#FF5722', label: 'Filter' },
  sort: { icon: '🔢', color: '#673AB7', label: 'Sort' },
  limit: { icon: '📏', color: '#009688', label: 'Limit' },
  aggregate: { icon: '📊', color: '#E91E63', label: 'Aggregate' },
  
  // Network nodes
  http: { icon: '🌐', color: '#2196F3', label: 'HTTP Request' },
  webhook: { icon: '🔗', color: '#607D8B', label: 'Webhook' },
  
  // Database nodes
  mysql: { icon: '🐬', color: '#00758F', label: 'MySQL' },
  postgres: { icon: '🐘', color: '#336791', label: 'PostgreSQL' },
  mongodb: { icon: '🍃', color: '#47A248', label: 'MongoDB' },
  redis: { icon: '🔴', color: '#DC382D', label: 'Redis' },
  
  // Communication nodes
  email: { icon: '📧', color: '#EA4335', label: 'Email Send' },
  gmail: { icon: '📮', color: '#EA4335', label: 'Gmail' },
  slack: { icon: '💬', color: '#4A154B', label: 'Slack' },
  discord: { icon: '🎮', color: '#5865F2', label: 'Discord' },
  telegram: { icon: '📱', color: '#0088CC', label: 'Telegram' },
  
  // File Operations nodes
  readfile: { icon: '📁', color: '#FFC107', label: 'Read Binary File' },
  writefile: { icon: '💾', color: '#FF9800', label: 'Write Binary File' },
  ftp: { icon: '🌐', color: '#795548', label: 'FTP' },
  sftp: { icon: '🔒', color: '#607D8B', label: 'SFTP' },
  
  // Cloud Services nodes
  aws: { icon: '☁️', color: '#FF9900', label: 'AWS' },
  gcloud: { icon: '🌤️', color: '#4285F4', label: 'Google Cloud' },
  azure: { icon: '⛅', color: '#0078D4', label: 'Microsoft Azure' },
  
  // Triggers nodes
  schedule: { icon: '⏰', color: '#FFC107', label: 'Schedule Trigger' },
  interval: { icon: '⏱️', color: '#FF9800', label: 'Interval' },
  manual: { icon: '👆', color: '#9E9E9E', label: 'Manual Trigger' },
  
  // AI/ML nodes
  openai: { icon: '🤖', color: '#10A37F', label: 'OpenAI' },
  anthropic: { icon: '🧠', color: '#FF6B35', label: 'Anthropic' },
  
  // Advanced nodes
  subworkflow: { icon: '📦', color: '#E91E63', label: 'Execute Workflow' },
  parallel: { icon: '⚡', color: '#3F51B5', label: 'Split In Batches' },
  queue: { icon: '📋', color: '#607D8B', label: 'Queue' },
  
  // Utilities nodes
  datetime: { icon: '📅', color: '#795548', label: 'Date & Time' },
  crypto: { icon: '🔐', color: '#9C27B0', label: 'Crypto' },
  hash: { icon: '#️⃣', color: '#607D8B', label: 'Hash' },
  xml: { icon: '📄', color: '#FF9800', label: 'XML' },
  json: { icon: '📋', color: '#4CAF50', label: 'JSON' },
  csv: { icon: '📊', color: '#2196F3', label: 'CSV' }
}

/**
 * Get node color based on type and status
 */
export function getNodeColor(type: string, status?: string): string {
  if (status === 'running') return '#FFA726'
  if (status === 'completed') return '#66BB6A'
  if (status === 'error') return '#EF5350'
  if (status === 'warning') return '#FFCA28'
  
  return NodeTypes[type as keyof typeof NodeTypes]?.color || '#757575'
}

/**
 * Get port color based on data type
 */
export function getPortColor(dataType: string): string {
  const colors: Record<string, string> = {
    any: '#9E9E9E',
    string: '#4CAF50',
    number: '#2196F3',
    boolean: '#FF9800',
    object: '#9C27B0',
    array: '#00BCD4',
    error: '#F44336'
  }
  return colors[dataType] || '#9E9E9E'
}

/**
 * Get node icon based on type
 */
export function getNodeIcon(type: string): string {
  return NodeTypes[type as keyof typeof NodeTypes]?.icon || '📌'
}

/**
 * Calculate node height based on port count
 */
export function getNodeHeight(node: WorkflowNode): number {
  const portCount = Math.max(node.inputs.length, node.outputs.length)
  return Math.max(NODE_MIN_HEIGHT, portCount * 30 + 60)
}

/**
 * Get comprehensive node definition with inputs, outputs, and default config
 */
export function getNodeDefinition(type: string): NodeDefinition {
  const definitions: Record<string, NodeDefinition> = {
    // Core/Control Flow nodes
    start: {
      inputs: [],
      outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
      defaultConfig: {}
    },
    if: {
      inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
      outputs: [
        { id: 'true', type: 'output', dataType: 'any', label: 'True' },
        { id: 'false', type: 'output', dataType: 'any', label: 'False' }
      ],
      defaultConfig: { condition: '', value1: '', operation: '=', value2: '' }
    },
    switch: {
      inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
      outputs: [
        { id: 'output0', type: 'output', dataType: 'any', label: 'Output 0' },
        { id: 'output1', type: 'output', dataType: 'any', label: 'Output 1' },
        { id: 'output2', type: 'output', dataType: 'any', label: 'Output 2' },
        { id: 'output3', type: 'output', dataType: 'any', label: 'Output 3' }
      ],
      defaultConfig: { mode: 'rules', rules: [] }
    },
    merge: {
      inputs: [
        { id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true },
        { id: 'merge', type: 'input', dataType: 'any', label: 'Merge', required: true }
      ],
      outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
      defaultConfig: { mode: 'append' }
    },
    
    // Data Processing nodes
    set: {
      inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
      outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
      defaultConfig: { keepOnlySet: false, values: {} }
    },
    code: {
      inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
      outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
      defaultConfig: { mode: 'runOnceForAllItems', jsCode: 'return items;' }
    },
    
    // Network nodes
    http: {
      inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main' }],
      outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
      defaultConfig: { 
        method: 'GET', 
        url: '', 
        authentication: 'none',
        timeout: 10000,
        followRedirect: true
      }
    },
    
    // Database nodes
    mysql: {
      inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
      outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
      defaultConfig: { operation: 'executeQuery', query: '' }
    }
  }
  
  // Return definition or default fallback
  return definitions[type] || { 
    inputs: [{ id: 'input', type: 'input', dataType: 'any', label: 'Input' }], 
    outputs: [{ id: 'output', type: 'output', dataType: 'any', label: 'Output' }],
    defaultConfig: {} 
  }
}

/**
 * Create a new workflow node
 */
export function createNode(type: string, position: { x: number; y: number }): WorkflowNode {
  const definition = getNodeDefinition(type)
  const nodeInfo = NodeTypes[type as keyof typeof NodeTypes]
  
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    label: nodeInfo?.label || 'New Node',
    x: position.x,
    y: position.y,
    config: definition.defaultConfig || {},
    inputs: definition.inputs,
    outputs: definition.outputs,
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
  // Can't connect to self
  if (sourceNode.id === targetNode.id) {
    return false
  }

  // Find the ports
  const sourcePort = sourceNode.outputs.find(p => p.id === sourcePortId)
  const targetPort = targetNode.inputs.find(p => p.id === targetPortId)

  if (!sourcePort || !targetPort) {
    return false
  }

  // Basic data type compatibility
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
  area: { x: number; y: number; width: number; height: number }
): WorkflowNode[] {
  return nodes.filter(node => {
    const nodeRect = {
      x: node.x - NODE_WIDTH / 2,
      y: node.y - 20,
      width: NODE_WIDTH,
      height: getNodeHeight(node)
    }

    // Check if node rectangle intersects with selection area
    return !(
      nodeRect.x + nodeRect.width < area.x ||
      area.x + area.width < nodeRect.x ||
      nodeRect.y + nodeRect.height < area.y ||
      area.y + area.height < nodeRect.y
    )
  })
}