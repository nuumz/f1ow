/**
 * Node type definitions and registry
 * Central registry for all available node types with their configurations
 */

import type { NodeTypeInfo, NodeDefinition } from '../types'
import type { NodeSchema } from '../schemas'

// Enhanced node type definitions with comprehensive information
export const NodeTypes: Record<string, NodeTypeInfo> = {
  // Core/Control Flow nodes
  start: { 
    icon: '▶', 
    color: '#3F51B5', 
    label: 'Start',
    category: 'Core/Control Flow',
    description: 'Starting point of the workflow',
    shape: 'circle'
  },
  
  if: { 
    icon: '?', 
    color: '#FF9800', 
    label: 'IF',
    category: 'Core/Control Flow',
    description: 'Conditional branching based on boolean expression',
    shape: 'diamond'
  },
  
  switch: { 
    icon: '⋔', 
    color: '#9C27B0', 
    label: 'Switch',
    category: 'Core/Control Flow',
    description: 'Multiple conditional branches based on value',
    shape: 'diamond'
  },
  
  merge: { 
    icon: '⋈', 
    color: '#607D8B', 
    label: 'Merge',
    category: 'Core/Control Flow',
    description: 'Merge multiple data streams'
  },
  
  split: { 
    icon: '✂', 
    color: '#795548', 
    label: 'Split In Batches',
    category: 'Core/Control Flow',
    description: 'Split data into smaller batches'
  },
  
  loop: { 
    icon: '↻', 
    color: '#00BCD4', 
    label: 'Loop Over Items',
    category: 'Core/Control Flow',
    description: 'Iterate over array items'
  },
  
  wait: { 
    icon: '⏸', 
    color: '#FFEB3B', 
    label: 'Wait',
    category: 'Core/Control Flow',
    description: 'Pause execution for specified time'
  },
  
  stop: { 
    icon: '■', 
    color: '#F44336', 
    label: 'Stop and Error',
    category: 'Core/Control Flow',
    description: 'Stop workflow execution with error',
    shape: 'circle'
  },
  
  // Data Processing nodes
  set: { 
    icon: '≔', 
    color: '#2196F3', 
    label: 'Set',
    category: 'Data Processing',
    description: 'Set or modify data fields'
  },
  
  edit: { 
    icon: '✎', 
    color: '#3F51B5', 
    label: 'Edit Fields',
    category: 'Data Processing',
    description: 'Edit specific fields in data'
  },
  
  code: { 
    icon: '</>', 
    color: '#4CAF50', 
    label: 'Code',
    category: 'Data Processing',
    description: 'Execute custom JavaScript code'
  },
  
  function: { 
    icon: 'ƒ', 
    color: '#9E9E9E', 
    label: 'Function',
    category: 'Data Processing',
    description: 'Execute predefined function'
  },
  
  filter: { 
    icon: '⊍', 
    color: '#FF5722', 
    label: 'Filter',
    category: 'Data Processing',
    description: 'Filter data based on conditions'
  },
  
  sort: { 
    icon: '⇅', 
    color: '#673AB7', 
    label: 'Sort',
    category: 'Data Processing',
    description: 'Sort data array'
  },
  
  limit: { 
    icon: '⊤', 
    color: '#009688', 
    label: 'Limit',
    category: 'Data Processing',
    description: 'Limit number of items'
  },
  
  aggregate: { 
    icon: '∑', 
    color: '#E91E63', 
    label: 'Aggregate',
    category: 'Data Processing',
    description: 'Aggregate data calculations'
  },
  
  // Network nodes
  http: { 
    icon: '⌘', 
    label: 'HTTP Request',
    category: 'Network',
    description: 'Make HTTP requests to APIs'
  },
  
  webhook: { 
    icon: '⚡', 
    color: '#607D8B', 
    label: 'Webhook',
    category: 'Network',
    description: 'Receive webhook data'
  },
  
  // Database nodes
  mysql: { 
    icon: 'DB', 
    color: '#00758F', 
    label: 'MySQL',
    category: 'Database',
    description: 'MySQL database operations'
  },
  
  postgres: { 
    icon: 'PG', 
    color: '#336791', 
    label: 'PostgreSQL',
    category: 'Database',
    description: 'PostgreSQL database operations'
  },
  
  mongodb: { 
    icon: 'MG', 
    color: '#47A248', 
    label: 'MongoDB',
    category: 'Database',
    description: 'MongoDB database operations'
  },
  
  redis: { 
    icon: 'RD', 
    color: '#DC382D', 
    label: 'Redis',
    category: 'Database',
    description: 'Redis cache operations'
  },
  
  // File System nodes
  readfile: { 
    icon: '📖', 
    color: '#795548', 
    label: 'Read File',
    category: 'File System',
    description: 'Read file contents'
  },
  
  writefile: { 
    icon: '💾', 
    color: '#607D8B', 
    label: 'Write File',
    category: 'File System',
    description: 'Write data to file'
  },
  
  ftp: { 
    icon: 'FTP', 
    color: '#795548', 
    label: 'FTP',
    category: 'File System',
    description: 'FTP file operations'
  },
  
  sftp: { 
    icon: 'SFTP', 
    color: '#607D8B', 
    label: 'SFTP',
    category: 'File System',
    description: 'SFTP file operations'
  },
  
  // Cloud Services nodes
  aws: { 
    icon: 'AWS', 
    color: '#FF9900', 
    label: 'AWS',
    category: 'Cloud Services',
    description: 'AWS cloud services'
  },
  
  gcloud: { 
    icon: 'GCP', 
    color: '#4285F4', 
    label: 'Google Cloud',
    category: 'Cloud Services',
    description: 'Google Cloud Platform services'
  },
  
  azure: { 
    icon: 'AZ', 
    color: '#0078D4', 
    label: 'Microsoft Azure',
    category: 'Cloud Services',
    description: 'Microsoft Azure services'
  },
  
  // Triggers nodes
  schedule: { 
    icon: '⏰', 
    color: '#FFC107', 
    label: 'Schedule Trigger',
    category: 'Triggers',
    description: 'Trigger workflow on schedule'
  },
  
  interval: { 
    icon: '⏱️', 
    color: '#FF9800', 
    label: 'Interval',
    category: 'Triggers',
    description: 'Trigger workflow at intervals'
  },
  
  manual: { 
    icon: '👆', 
    color: '#9E9E9E', 
    label: 'Manual Trigger',
    category: 'Triggers',
    description: 'Manual workflow trigger'
  },
  
  // AI/ML nodes
  aiagent: { 
    icon: '🤖', 
    label: 'AI Agent',
    category: 'AI/ML',
    description: 'AI agent processing'
  },
  
  openai: { 
    icon: '🧠', 
    color: '#10A37F', 
    label: 'OpenAI',
    category: 'AI/ML',
    description: 'OpenAI API integration'
  },
  
  // Utilities nodes
  delay: { 
    icon: '⏳', 
    color: '#FFEB3B', 
    label: 'Delay',
    category: 'Utilities',
    description: 'Add delay to workflow'
  },
  
  crypto: { 
    icon: '🔐', 
    color: '#9C27B0', 
    label: 'Crypto',
    category: 'Utilities',
    description: 'Cryptographic operations'
  },
  
  hash: { 
    icon: '#️⃣', 
    color: '#607D8B', 
    label: 'Hash',
    category: 'Utilities',
    description: 'Generate hash values'
  },
  
  xml: { 
    icon: '📄', 
    color: '#FF9800', 
    label: 'XML',
    category: 'Utilities',
    description: 'XML processing'
  },
  
  json: { 
    icon: '📋', 
    color: '#4CAF50', 
    label: 'JSON',
    category: 'Utilities',
    description: 'JSON processing',
    shape: 'square'
  },
  
  csv: { 
    icon: '📊', 
    color: '#2196F3', 
    label: 'CSV',
    category: 'Utilities',
    description: 'CSV file processing'
  }
}

// Node definitions with detailed configuration
export const NodeDefinitions: Record<string, NodeDefinition> = {
  // Core/Control Flow nodes
  start: {
    inputs: [],
    outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
    defaultConfig: {},
    category: 'Core/Control Flow',
    description: 'Starting point of the workflow',
    icon: '▶',
    color: '#4CAF50'
  },
  
  if: {
    inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
    outputs: [
      { id: 'true', type: 'output', dataType: 'any', label: 'True' },
      { id: 'false', type: 'output', dataType: 'any', label: 'False' }
    ],
    defaultConfig: { 
      condition: '', 
      value1: '', 
      operation: '=', 
      value2: '' 
    },
    category: 'Core/Control Flow',
    description: 'Conditional branching based on boolean expression',
    icon: '?',
    color: '#FF9800'
  },
  
  switch: {
    inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
    outputs: [
      { id: 'output0', type: 'output', dataType: 'any', label: 'Output 0' },
      { id: 'output1', type: 'output', dataType: 'any', label: 'Output 1' },
      { id: 'output2', type: 'output', dataType: 'any', label: 'Output 2' },
      { id: 'output3', type: 'output', dataType: 'any', label: 'Output 3' }
    ],
    defaultConfig: { mode: 'rules', rules: [] },
    category: 'Core/Control Flow',
    description: 'Multiple conditional branches based on value',
    icon: '⋔',
    color: '#9C27B0'
  },
  
  merge: {
    inputs: [
      { id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true },
      { id: 'merge', type: 'input', dataType: 'any', label: 'Merge', required: true }
    ],
    outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
    defaultConfig: { mode: 'append' },
    category: 'Core/Control Flow',
    description: 'Merge multiple data streams',
    icon: '⋈',
    color: '#607D8B'
  },
  
  // Data Processing nodes
  set: {
    inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
    outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
    defaultConfig: { keepOnlySet: false, values: {} },
    category: 'Data Processing',
    description: 'Set or modify data fields',
    icon: '≔',
    color: '#2196F3'
  },
  
  code: {
    inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
    outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
    defaultConfig: { mode: 'runOnceForAllItems', jsCode: 'return items;' },
    category: 'Data Processing',
    description: 'Execute custom JavaScript code',
    icon: '</>',
    color: '#4CAF50'
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
    },
    category: 'Network',
    description: 'Make HTTP requests to APIs',
    icon: '⌘',
    color: '#2196F3'
  },
  
  // Database nodes
  mysql: {
    inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Main', required: true }],
    outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Main' }],
    defaultConfig: { operation: 'executeQuery', query: '' },
    category: 'Database',
    description: 'MySQL database operations',
    icon: 'DB',
    color: '#00758F'
  },
  
  // AI Agent node
  aiagent: {
    inputs: [{ id: 'main', type: 'input', dataType: 'any', label: 'Input', required: true }],
    outputs: [{ id: 'main', type: 'output', dataType: 'any', label: 'Output' }],
    bottomPorts: [
      { id: 'ai-model', type: 'input', dataType: 'string', label: 'Chat Model*' },
      { id: 'memory', type: 'input', dataType: 'object', label: 'Memory' },
      { id: 'tool', type: 'input', dataType: 'array', label: 'Tool' }
    ],
    defaultConfig: { 
      model: 'gpt-4',
      prompt: '',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: 'You are a helpful AI assistant.'
    },
    category: 'AI/ML',
    description: 'AI agent processing',
    icon: '🤖',
    color: '#9C27B0'
  }
}

// Helper functions
export function getNodeTypeInfo(type: string): NodeTypeInfo | undefined {
  return NodeTypes[type]
}

export function getNodeDefinition(type: string): NodeDefinition {
  return NodeDefinitions[type] || {
    inputs: [{ id: 'input', type: 'input', dataType: 'any', label: 'Input' }],
    outputs: [{ id: 'output', type: 'output', dataType: 'any', label: 'Output' }],
    defaultConfig: {},
    category: 'Utilities',
    description: 'Generic node',
    icon: '📌',
    color: '#9E9E9E'
  }
}

export function getNodeColor(type: string, status?: string): string {
  if (status === 'running') return '#FFA726'
  if (status === 'completed') return '#66BB6A'
  if (status === 'error') return '#EF5350'
  if (status === 'warning') return '#FFCA28'
  
  return NodeTypes[type]?.color || '#8d8d8d'
}

export function getNodeIcon(type: string): string {
  return NodeTypes[type]?.icon || '📌'
}

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

export function getNodeCategories(): string[] {
  const categories = new Set<string>()
  Object.values(NodeTypes).forEach(info => {
    if (info.category) categories.add(info.category)
  })
  return Array.from(categories).sort()
}

export function getNodesByCategory(category: string): Array<{ type: string; info: NodeTypeInfo }> {
  return Object.entries(NodeTypes)
    .filter(([, info]) => info.category === category)
    .map(([type, info]) => ({ type, info }))
}

// Node registry class for dynamic registration
export class NodeRegistry {
  private nodes = new Map<string, NodeTypeInfo>()
  private definitions = new Map<string, NodeDefinition>()
  private schemas = new Map<string, NodeSchema>()

  registerNode(type: string, info: NodeTypeInfo, definition: NodeDefinition, schema?: NodeSchema): void {
    this.nodes.set(type, info)
    this.definitions.set(type, definition)
    if (schema) {
      this.schemas.set(type, schema)
    }
  }

  getNodeInfo(type: string): NodeTypeInfo | undefined {
    return this.nodes.get(type) || NodeTypes[type]
  }

  getNodeDefinition(type: string): NodeDefinition {
    return this.definitions.get(type) || getNodeDefinition(type)
  }

  getNodeSchema(type: string): NodeSchema | undefined {
    return this.schemas.get(type)
  }

  getAllNodes(): Record<string, NodeTypeInfo> {
    const allNodes = { ...NodeTypes }
    this.nodes.forEach((info, type) => {
      allNodes[type] = info
    })
    return allNodes
  }

  getAllCategories(): string[] {
    const categories = new Set<string>()
    
    // Add built-in categories
    Object.values(NodeTypes).forEach(info => {
      if (info.category) categories.add(info.category)
    })
    
    // Add registered categories
    this.nodes.forEach(info => {
      if (info.category) categories.add(info.category)
    })
    
    return Array.from(categories).sort()
  }
}

// Export singleton instance
export const nodeRegistry = new NodeRegistry()
