// Export the original WorkflowDesigner (legacy)
export { default as WorkflowDesigner } from './WorkflowDesigner'

// Export the new WorkflowDesigner with provider
export { default as WorkflowDesignerWithProvider } from './WorkflowDesignerWithProvider'

// Export the provider and context
export { WorkflowProvider, useWorkflowContext } from './contexts/WorkflowContext'

// Export custom hooks
export { useWorkflowOperations } from './hooks/useWorkflowOperations'
export { useWorkflowCanvas } from './hooks/useWorkflowCanvas'
export { useWorkflowEventHandlers } from './hooks/useWorkflowEventHandlers'

// Export types
export type { 
  WorkflowState, 
  WorkflowAction, 
  ExecutionState, 
  CanvasTransform, 
  ConnectionState, 
  UIState 
} from './contexts/WorkflowContext'

// Export existing types for backward compatibility
export type { WorkflowNode } from './hooks/useNodeSelection'
export type { Connection } from './hooks/useConnections'
export type { NodeVariant } from './components/nodes/NodeRenderer'