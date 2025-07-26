import React, { createContext, useContext, useReducer, useCallback, useRef, ReactNode, useMemo } from 'react'

// Types
import type { WorkflowNode } from '../hooks/useNodeSelection'
import type { Connection } from '../hooks/useConnections'
import type { NodeVariant } from '../components/nodes/NodeRenderer'

// Execution state interface
interface ExecutionState {
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

// Canvas transform interface
interface CanvasTransform {
  x: number
  y: number
  k: number
}

// Connection state interface
interface ConnectionState {
  isConnecting: boolean
  connectionStart: { nodeId: string; portId: string; type: 'input' | 'output' } | null
  connectionPreview: { x: number; y: number } | null
  selectedConnection: Connection | null
}

// UI state interface
interface UIState {
  showGrid: boolean
  showNodeEditor: boolean
  isDragOver: boolean
  nodeVariant: NodeVariant
}

// Workflow state interface
interface WorkflowState {
  // Core data
  workflowName: string
  nodes: WorkflowNode[]
  connections: Connection[]
  
  // Selection state
  selectedNodes: Set<string>
  selectedNode: WorkflowNode | null
  
  // Canvas state
  canvasTransform: CanvasTransform
  
  // Connection state
  connectionState: ConnectionState
  
  // Execution state
  executionState: ExecutionState
  
  // UI state
  uiState: UIState
}

// Action types
type WorkflowAction =
  // Workflow actions
  | { type: 'SET_WORKFLOW_NAME'; payload: string }
  | { type: 'LOAD_WORKFLOW'; payload: { nodes: WorkflowNode[]; connections: Connection[] } }
  
  // Node actions
  | { type: 'ADD_NODE'; payload: WorkflowNode }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; updates: Partial<WorkflowNode> } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'UPDATE_NODE_POSITION'; payload: { nodeId: string; x: number; y: number } }
  
  // Connection actions
  | { type: 'ADD_CONNECTION'; payload: Connection }
  | { type: 'DELETE_CONNECTION'; payload: string }
  | { type: 'SET_CONNECTIONS'; payload: Connection[] }
  
  // Selection actions
  | { type: 'SELECT_NODE'; payload: { nodeId: string; multiSelect: boolean } }
  | { type: 'SET_SELECTED_NODES'; payload: Set<string> }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SELECTED_NODE'; payload: WorkflowNode | null }
  | { type: 'SELECT_CONNECTION'; payload: Connection | null }
  
  // Canvas actions
  | { type: 'SET_CANVAS_TRANSFORM'; payload: CanvasTransform }
  
  // Connection state actions
  | { type: 'START_CONNECTION'; payload: { nodeId: string; portId: string; type: 'input' | 'output' } }
  | { type: 'UPDATE_CONNECTION_PREVIEW'; payload: { x: number; y: number } }
  | { type: 'CLEAR_CONNECTION_STATE' }
  
  // Execution actions
  | { type: 'SET_EXECUTION_STATE'; payload: Partial<ExecutionState> }
  | { type: 'RESET_EXECUTION' }
  
  // UI actions
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_SHOW_NODE_EDITOR'; payload: boolean }
  | { type: 'SET_DRAG_OVER'; payload: boolean }
  | { type: 'SET_NODE_VARIANT'; payload: NodeVariant }

// Initial state
const initialState: WorkflowState = {
  workflowName: 'New Workflow',
  nodes: [],
  connections: [],
  selectedNodes: new Set(),
  selectedNode: null,
  canvasTransform: { x: 0, y: 0, k: 1 },
  connectionState: {
    isConnecting: false,
    connectionStart: null,
    connectionPreview: null,
    selectedConnection: null
  },
  executionState: {
    status: 'idle',
    completedNodes: [],
    nodeData: {},
    errors: {},
    logs: []
  },
  uiState: {
    showGrid: true,
    showNodeEditor: false,
    isDragOver: false,
    nodeVariant: 'standard'
  }
}

// Reducer function
function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'SET_WORKFLOW_NAME':
      return { ...state, workflowName: action.payload }
    
    case 'LOAD_WORKFLOW':
      return {
        ...state,
        nodes: action.payload.nodes,
        connections: action.payload.connections,
        selectedNodes: new Set(),
        selectedNode: null,
        connectionState: {
          ...state.connectionState,
          selectedConnection: null
        }
      }
    
    case 'ADD_NODE':
      return { ...state, nodes: [...state.nodes, action.payload] }
    
    case 'UPDATE_NODE':
      return {
        ...state,
        nodes: state.nodes.map(node =>
          node.id === action.payload.nodeId
            ? { ...node, ...action.payload.updates }
            : node
        )
      }
    
    case 'DELETE_NODE':
      return {
        ...state,
        nodes: state.nodes.filter(node => node.id !== action.payload),
        connections: state.connections.filter(conn =>
          conn.sourceNodeId !== action.payload && conn.targetNodeId !== action.payload
        ),
        selectedNodes: new Set([...state.selectedNodes].filter(id => id !== action.payload)),
        selectedNode: state.selectedNode?.id === action.payload ? null : state.selectedNode
      }
    
    case 'UPDATE_NODE_POSITION':
      return {
        ...state,
        nodes: state.nodes.map(node =>
          node.id === action.payload.nodeId
            ? { ...node, x: action.payload.x, y: action.payload.y }
            : node
        )
      }
    
    case 'ADD_CONNECTION':
      return { ...state, connections: [...state.connections, action.payload] }
    
    case 'DELETE_CONNECTION':
      return {
        ...state,
        connections: state.connections.filter(conn => conn.id !== action.payload),
        connectionState: {
          ...state.connectionState,
          selectedConnection: state.connectionState.selectedConnection?.id === action.payload
            ? null
            : state.connectionState.selectedConnection
        }
      }
    
    case 'SET_CONNECTIONS':
      return { ...state, connections: action.payload }
    
    case 'SELECT_NODE': {
      const { nodeId, multiSelect } = action.payload
      const newSelectedNodes = new Set(state.selectedNodes)
      
      if (multiSelect) {
        if (newSelectedNodes.has(nodeId)) {
          newSelectedNodes.delete(nodeId)
        } else {
          newSelectedNodes.add(nodeId)
        }
      } else {
        newSelectedNodes.clear()
        newSelectedNodes.add(nodeId)
      }
      
      return { ...state, selectedNodes: newSelectedNodes }
    }
    
    case 'SET_SELECTED_NODES':
      return { ...state, selectedNodes: action.payload }
    
    case 'CLEAR_SELECTION':
      return { 
        ...state, 
        selectedNodes: new Set(),
        selectedNode: null,
        uiState: { ...state.uiState, showNodeEditor: false }
      }
    
    case 'SET_SELECTED_NODE':
      return { ...state, selectedNode: action.payload }
    
    case 'SELECT_CONNECTION':
      return {
        ...state,
        connectionState: {
          ...state.connectionState,
          selectedConnection: action.payload
        }
      }
    
    case 'SET_CANVAS_TRANSFORM':
      return { ...state, canvasTransform: action.payload }
    
    case 'START_CONNECTION': {
      console.log('START_CONNECTION reducer:', action.payload)
      const newConnectionState = {
        ...state,
        connectionState: {
          ...state.connectionState,
          isConnecting: true,
          connectionStart: action.payload,
          connectionPreview: null
        }
      }
      console.log('New connection state:', newConnectionState.connectionState)
      return newConnectionState
    }
    
    case 'UPDATE_CONNECTION_PREVIEW':
      return {
        ...state,
        connectionState: {
          ...state.connectionState,
          connectionPreview: action.payload
        }
      }
    
    case 'CLEAR_CONNECTION_STATE':
      console.log('CLEAR_CONNECTION_STATE reducer called')
      return {
        ...state,
        connectionState: {
          ...state.connectionState,
          isConnecting: false,
          connectionStart: null,
          connectionPreview: null
        }
      }
    
    case 'SET_EXECUTION_STATE':
      return {
        ...state,
        executionState: { ...state.executionState, ...action.payload }
      }
    
    case 'RESET_EXECUTION':
      return {
        ...state,
        executionState: {
          status: 'idle',
          completedNodes: [],
          nodeData: {},
          errors: {},
          logs: []
        }
      }
    
    case 'TOGGLE_GRID':
      return {
        ...state,
        uiState: { ...state.uiState, showGrid: !state.uiState.showGrid }
      }
    
    case 'SET_SHOW_NODE_EDITOR':
      return {
        ...state,
        uiState: { ...state.uiState, showNodeEditor: action.payload }
      }
    
    case 'SET_DRAG_OVER':
      return {
        ...state,
        uiState: { ...state.uiState, isDragOver: action.payload }
      }
    
    case 'SET_NODE_VARIANT':
      return {
        ...state,
        uiState: { ...state.uiState, nodeVariant: action.payload }
      }
    
    default:
      return state
  }
}

// Context interface
interface WorkflowContextType {
  // State
  state: WorkflowState
  
  // Refs
  svgRef: React.RefObject<SVGSVGElement>
  containerRef: React.RefObject<HTMLDivElement>
  
  // Dispatch
  dispatch: React.Dispatch<WorkflowAction>
  
  // Computed values
  isNodeSelected: (nodeId: string) => boolean
  getSelectedNodesList: () => WorkflowNode[]
  canDropOnPort: (targetNodeId: string, targetPortId: string, targetPortType?: 'input' | 'output') => boolean
  canDropOnNode: (targetNodeId: string) => boolean
}

// Context
const WorkflowContext = createContext<WorkflowContextType | null>(null)

// Provider component
interface WorkflowProviderProps {
  readonly children: ReactNode
  readonly initialWorkflow?: {
    readonly name?: string
    readonly nodes?: WorkflowNode[]
    readonly connections?: Connection[]
  }
}

export function WorkflowProvider({ children, initialWorkflow }: WorkflowProviderProps) {
  const [state, dispatch] = useReducer(workflowReducer, {
    ...initialState,
    ...(initialWorkflow && {
      workflowName: initialWorkflow.name || initialState.workflowName,
      nodes: initialWorkflow.nodes || initialState.nodes,
      connections: initialWorkflow.connections || initialState.connections
    })
  })
  
  // Refs
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Computed values
  const isNodeSelected = useCallback((nodeId: string) => {
    return state.selectedNodes.has(nodeId)
  }, [state.selectedNodes])
  
  const getSelectedNodesList = useCallback(() => {
    return state.nodes.filter(node => state.selectedNodes.has(node.id))
  }, [state.nodes, state.selectedNodes])
  
  const canDropOnPort = useCallback((targetNodeId: string, targetPortId: string, targetPortType?: 'input' | 'output') => {
    const { connectionStart } = state.connectionState
    if (!connectionStart || connectionStart.nodeId === targetNodeId) {
      return false
    }
    
    // Validate port types - output can only connect to input and vice versa
    if (targetPortType && connectionStart.type === targetPortType) {
      return false
    }
    
    // Check if exact same connection already exists (same source & target)
    const existingConnection = state.connections.find(conn => {
      if (connectionStart.type === 'output') {
        return conn.sourceNodeId === connectionStart.nodeId &&
               conn.sourcePortId === connectionStart.portId &&
               conn.targetNodeId === targetNodeId &&
               conn.targetPortId === targetPortId
      } else {
        return conn.sourceNodeId === targetNodeId &&
               conn.sourcePortId === targetPortId &&
               conn.targetNodeId === connectionStart.nodeId &&
               conn.targetPortId === connectionStart.portId
      }
    })
    
    // Allow connection if exact same connection doesn't exist
    // This allows multiple connections from one output to multiple inputs
    // and multiple connections to one input from multiple outputs
    return !existingConnection
  }, [state.connectionState, state.connections])
  
  const canDropOnNode = useCallback((targetNodeId: string) => {
    const { connectionStart } = state.connectionState
    return !!connectionStart && connectionStart.nodeId !== targetNodeId
  }, [state.connectionState])
  
  const contextValue: WorkflowContextType = useMemo(() => ({
    state,
    svgRef,
    containerRef,
    dispatch,
    isNodeSelected,
    getSelectedNodesList,
    canDropOnPort,
    canDropOnNode
  }), [state, svgRef, containerRef, dispatch, isNodeSelected, getSelectedNodesList, canDropOnPort, canDropOnNode])
  
  return (
    <WorkflowContext.Provider value={contextValue}>
      {children}
    </WorkflowContext.Provider>
  )
}

// Hook to use workflow context
export function useWorkflowContext() {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error('useWorkflowContext must be used within a WorkflowProvider')
  }
  return context
}

export type { WorkflowState, WorkflowAction, ExecutionState, CanvasTransform, ConnectionState, UIState }