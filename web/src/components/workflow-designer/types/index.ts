/**
 * Core workflow types and interfaces
 * Central definitions for all workflow-related types to ensure consistency across the application
 */

// Core node port interface
export interface NodePort {
  id: string
  type: 'input' | 'output'
  dataType: DataType
  label: string
  required?: boolean
  multiple?: boolean
  connected?: boolean
}

// Data type enumeration for port types
export type DataType = 
  | 'any'
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'object' 
  | 'array'
  | 'error'

// Node status enumeration
export type NodeStatus = 
  | 'idle' 
  | 'running' 
  | 'completed' 
  | 'error' 
  | 'warning'

// Port type enumeration
export type PortType = 'input' | 'output'

// Node variant enumeration
export type NodeVariant = 'compact' | 'standard'

// Node category enumeration
export type NodeCategory = 
  | 'Core/Control Flow'
  | 'Data Processing'
  | 'Network'
  | 'Database'
  | 'File System'
  | 'Cloud Services'
  | 'Triggers'
  | 'AI/ML'
  | 'Utilities'
  | 'Authentication'
  | 'Monitoring'

// Core workflow node interface
export interface WorkflowNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  width?: number
  height?: number
  config: Record<string, any>
  inputs: NodePort[]
  outputs: NodePort[]
  status?: NodeStatus
  data?: any
  locked?: boolean
  selected?: boolean
  group?: string
  metadata?: {
    description?: string
    version?: string
    author?: string
    tags?: string[]
    category?: NodeCategory
  }
}

// Connection between nodes
export interface Connection {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  validated?: boolean
  dataFlow?: any
  style?: {
    color?: string
    strokeWidth?: number
    animated?: boolean
  }
}

// Connection start state for drag operations
export interface ConnectionStart {
  nodeId: string
  portId: string
  type: PortType
}

// Node definition for creating nodes
export interface NodeDefinition {
  inputs: NodePort[]
  outputs: NodePort[]
  defaultConfig?: Record<string, any>
  category?: NodeCategory
  description?: string
  icon?: string
  color?: string
}

// Position interface
export interface Position {
  x: number
  y: number
}

// Node theme interface
export interface NodeTheme {
  backgroundColor: string
  borderColor: string
  textColor: string
  accentColor: string
  shadowColor?: string
  borderRadius?: number
  borderWidth?: number
}

// Canvas transform for zoom and pan
export interface CanvasTransform {
  x: number
  y: number
  k: number
}

// Port position calculation
export interface PortPosition {
  x: number
  y: number
}

// Node type information
export interface NodeTypeInfo {
  icon: string
  color: string
  label: string
  category?: NodeCategory
  description?: string
}

// Execution state for workflow runs
export interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'error' | 'paused'
  currentNode?: string
  completedNodes: string[]
  nodeData: Record<string, any>
  errors: Record<string, string>
  startTime?: number
  endTime?: number
  logs: Array<{
    nodeId: string
    timestamp: number
    level: 'info' | 'warning' | 'error'
    message: string
  }>
}

// Connection state management
export interface ConnectionState {
  isConnecting: boolean
  connectionStart: ConnectionStart | null
  connectionPreview: Position | null
  selectedConnection: Connection | null
  lastModified: number
  autoSaveEnabled: boolean
}

// UI state management
export interface UIState {
  showGrid: boolean
  showNodeEditor: boolean
  isDragOver: boolean
  nodeVariant: NodeVariant
}

// Workflow state (main state container)
export interface WorkflowState {
  nodes: WorkflowNode[]
  connections: Connection[]
  canvasTransform: CanvasTransform
  selectedNodes: Set<string>
  selectedNode: WorkflowNode | null
  isMultiSelectMode: boolean
  executionState: ExecutionState
  connectionState: ConnectionState
  uiState: UIState
  metadata: {
    name: string
    description: string
    version: string
    created: number
    modified: number
  }
}

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  type: NotificationType
  message: string
  duration?: number
}

// Node render props for components
export interface NodeRenderProps {
  node: WorkflowNode
  variant?: NodeVariant
  theme?: Partial<NodeTheme>
  isSelected?: boolean
  isConnecting?: boolean
  isDragging?: boolean
  showPorts?: boolean
  showLabel?: boolean
  showIcon?: boolean
  showStatus?: boolean
  customWidth?: number
  customHeight?: number
  
  // Event handlers
  onNodeClick?: (node: WorkflowNode, ctrlKey: boolean) => void
  onNodeDoubleClick?: (node: WorkflowNode) => void
  onPortClick?: (nodeId: string, portId: string, portType: PortType) => void
  onPortDragStart?: (nodeId: string, portId: string, portType: PortType) => void
  onPortDrag?: (x: number, y: number) => void
  onPortDragEnd?: (targetNodeId?: string, targetPortId?: string) => void
  
  // Visual feedback for connections
  canDropOnPort?: (targetNodeId: string, targetPortId: string) => boolean
  canDropOnNode?: (targetNodeId: string) => boolean
}

// Event handler types
export type NodeClickHandler = (node: WorkflowNode, ctrlKey?: boolean) => void
export type NodeDoubleClickHandler = (node: WorkflowNode) => void
export type PortClickHandler = (nodeId: string, portId: string, portType: PortType) => void
export type PortDragHandler = (x: number, y: number) => void
export type ConnectionValidationHandler = (
  sourceNode: WorkflowNode, 
  sourcePortId: string, 
  targetNode: WorkflowNode, 
  targetPortId: string
) => { valid: boolean; reason?: string }

// Selection area interface
export interface SelectionArea {
  x: number
  y: number
  width: number
  height: number
}

// Layout options for auto-layout
export interface LayoutOptions {
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL'
  nodesep?: number
  ranksep?: number
  marginx?: number
  marginy?: number
}

// Validation result interface
export interface ValidationResult {
  valid: boolean
  reason?: string
  suggestions?: string[]
}

// Export helper type guards
export function isValidNodeType(type: string): boolean {
  return typeof type === 'string' && type.length > 0
}

export function isValidPortType(type: string): type is PortType {
  return type === 'input' || type === 'output'
}

export function isValidDataType(type: string): type is DataType {
  return ['any', 'string', 'number', 'boolean', 'object', 'array', 'error'].includes(type)
}

export function isValidNodeStatus(status: string): status is NodeStatus {
  return ['idle', 'running', 'completed', 'error', 'warning'].includes(status)
}
