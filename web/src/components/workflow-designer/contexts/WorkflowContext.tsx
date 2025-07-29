import React, { createContext, useContext, useReducer, useCallback, useRef, ReactNode, useMemo, useEffect } from 'react'

// Import centralized types
import type { 
  WorkflowNode, 
  Connection, 
  NodeVariant,
  ExecutionState,
  CanvasTransform,
  ConnectionState,
  UIState
} from '../types'

// Workflow state interface (extends centralized types)
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
  
  // Workflow metadata
  lastSaved: number
  isDirty: boolean
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
  | { type: 'UPDATE_CONNECTION'; payload: { connectionId: string; updates: Partial<Connection> } }
  | { type: 'VALIDATE_CONNECTIONS' }
  | { type: 'SAVE_CONNECTIONS_TO_STORAGE' }
  | { type: 'LOAD_CONNECTIONS_FROM_STORAGE'; payload: Connection[] }
  
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
  
  // Workflow state actions
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN' }
  | { type: 'SET_LAST_SAVED'; payload: number }
  | { type: 'TOGGLE_AUTO_SAVE'; payload: boolean }

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
    selectedConnection: null,
    lastModified: Date.now(),
    autoSaveEnabled: true
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
  },
  lastSaved: Date.now(),
  isDirty: false
}

// Helper functions for connection management
const saveConnectionsToStorage = (workflowName: string, connections: Connection[]) => {
  try {
    const key = `workflow-connections-${workflowName}`
    const connectionData = {
      connections,
      timestamp: Date.now(),
      version: '1.0'
    }
    localStorage.setItem(key, JSON.stringify(connectionData))
    console.log('✅ Connections saved to storage:', connections.length, 'connections')
  } catch (error) {
    console.warn('Failed to save connections to localStorage:', error)
  }
}

const loadConnectionsFromStorage = (workflowName: string): Connection[] => {
  try {
    const key = `workflow-connections-${workflowName}`
    const saved = localStorage.getItem(key)
    if (saved) {
      const connectionData = JSON.parse(saved)
      console.log('✅ Connections loaded from storage:', connectionData.connections.length, 'connections')
      return connectionData.connections || []
    }
  } catch (error) {
    console.warn('Failed to load connections from localStorage:', error)
  }
  return []
}

const validateConnections = (connections: Connection[], nodes: WorkflowNode[]): Connection[] => {
  const nodeIds = new Set(nodes.map(n => n.id))
  
  return connections.filter(conn => {
    // Check if both nodes exist
    if (!nodeIds.has(conn.sourceNodeId) || !nodeIds.has(conn.targetNodeId)) {
      console.warn('Invalid connection - missing node:', conn)
      return false
    }
    
    // Check if ports exist on nodes
    const sourceNode = nodes.find(n => n.id === conn.sourceNodeId)
    const targetNode = nodes.find(n => n.id === conn.targetNodeId)
    
    if (!sourceNode || !targetNode) return false
    
    const sourcePortExists = sourceNode.outputs.some(p => p.id === conn.sourcePortId) ||
                             (sourceNode.bottomPorts && sourceNode.bottomPorts.some(p => p.id === conn.sourcePortId))
    const targetPortExists = targetNode.inputs.some(p => p.id === conn.targetPortId) ||
                             (targetNode.bottomPorts && targetNode.bottomPorts.some(p => p.id === conn.targetPortId))
    
    if (!sourcePortExists || !targetPortExists) {
      console.warn('Invalid connection - missing port:', conn)
      return false
    }
    
    return true
  })
}

const markStateAsDirty = (state: WorkflowState): WorkflowState => ({
  ...state,
  isDirty: true,
  connectionState: {
    ...state.connectionState,
    lastModified: Date.now()
  }
})

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
    
    case 'ADD_CONNECTION': {
      const newConnections = [...state.connections, action.payload]
      const newState = markStateAsDirty({ ...state, connections: newConnections })
      
      // Auto-save to storage if enabled
      if (state.connectionState.autoSaveEnabled) {
        saveConnectionsToStorage(state.workflowName, newConnections)
      }
      
      console.log('✅ Connection added:', action.payload.id)
      return newState
    }
    
    case 'DELETE_CONNECTION': {
      const newConnections = state.connections.filter(conn => conn.id !== action.payload)
      const newState = markStateAsDirty({
        ...state,
        connections: newConnections,
        connectionState: {
          ...state.connectionState,
          selectedConnection: state.connectionState.selectedConnection?.id === action.payload
            ? null
            : state.connectionState.selectedConnection
        }
      })
      
      // Auto-save to storage if enabled
      if (state.connectionState.autoSaveEnabled) {
        saveConnectionsToStorage(state.workflowName, newConnections)
      }
      
      console.log('✅ Connection deleted:', action.payload)
      return newState
    }
    
    case 'SET_CONNECTIONS': {
      const newState = markStateAsDirty({ ...state, connections: action.payload })
      
      // Auto-save to storage if enabled
      if (state.connectionState.autoSaveEnabled) {
        saveConnectionsToStorage(state.workflowName, action.payload)
      }
      
      console.log('✅ Connections set:', action.payload.length, 'connections')
      return newState
    }
    
    case 'UPDATE_CONNECTION': {
      const newConnections = state.connections.map(conn =>
        conn.id === action.payload.connectionId
          ? { ...conn, ...action.payload.updates }
          : conn
      )
      const newState = markStateAsDirty({ ...state, connections: newConnections })
      
      // Auto-save to storage if enabled
      if (state.connectionState.autoSaveEnabled) {
        saveConnectionsToStorage(state.workflowName, newConnections)
      }
      
      console.log('✅ Connection updated:', action.payload.connectionId)
      return newState
    }
    
    case 'VALIDATE_CONNECTIONS': {
      const validConnections = validateConnections(state.connections, state.nodes)
      const invalidCount = state.connections.length - validConnections.length
      
      if (invalidCount > 0) {
        console.warn(`⚠️ Removed ${invalidCount} invalid connections`)
        const newState = markStateAsDirty({ ...state, connections: validConnections })
        
        // Auto-save to storage if enabled
        if (state.connectionState.autoSaveEnabled) {
          saveConnectionsToStorage(state.workflowName, validConnections)
        }
        
        return newState
      }
      
      //console.log('✅ All connections are valid')
      return state
    }
    
    case 'SAVE_CONNECTIONS_TO_STORAGE': {
      saveConnectionsToStorage(state.workflowName, state.connections)
      return {
        ...state,
        lastSaved: Date.now(),
        isDirty: false
      }
    }
    
    case 'LOAD_CONNECTIONS_FROM_STORAGE': {
      const validConnections = validateConnections(action.payload, state.nodes)
      console.log('✅ Loaded connections from storage:', validConnections.length, 'connections')
      return { ...state, connections: validConnections, isDirty: false }
    }
    
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
    
    case 'MARK_DIRTY':
      return {
        ...state,
        isDirty: true,
        connectionState: {
          ...state.connectionState,
          lastModified: Date.now()
        }
      }
    
    case 'MARK_CLEAN':
      return {
        ...state,
        isDirty: false,
        lastSaved: Date.now()
      }
    
    case 'SET_LAST_SAVED':
      return {
        ...state,
        lastSaved: action.payload,
        isDirty: false
      }
    
    case 'TOGGLE_AUTO_SAVE':
      return {
        ...state,
        connectionState: {
          ...state.connectionState,
          autoSaveEnabled: action.payload
        }
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
  
  // Connection management
  validateConnections: () => void
  saveConnectionsToStorage: () => void
  loadConnectionsFromStorage: () => void
  toggleAutoSave: (enabled: boolean) => void
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
  
  // Connection management functions
  const validateConnections = useCallback(() => {
    dispatch({ type: 'VALIDATE_CONNECTIONS' })
  }, [dispatch])
  
  const saveConnectionsToStorage = useCallback(() => {
    dispatch({ type: 'SAVE_CONNECTIONS_TO_STORAGE' })
  }, [dispatch])
  
  const loadConnectionsFromStorageHandler = useCallback(() => {
    const savedConnections = loadConnectionsFromStorage(state.workflowName)
    if (savedConnections.length > 0) {
      dispatch({ type: 'LOAD_CONNECTIONS_FROM_STORAGE', payload: savedConnections })
    }
  }, [state.workflowName, dispatch])
  
  const toggleAutoSave = useCallback((enabled: boolean) => {
    dispatch({ type: 'TOGGLE_AUTO_SAVE', payload: enabled })
  }, [dispatch])
  
  // Auto-load connections when workflow name changes
  useEffect(() => {
    if (state.workflowName && state.workflowName !== 'New Workflow') {
      const savedConnections = loadConnectionsFromStorage(state.workflowName)
      if (savedConnections.length > 0) {
        dispatch({ type: 'LOAD_CONNECTIONS_FROM_STORAGE', payload: savedConnections })
      }
    }
  }, [state.workflowName])
  
  // Auto-validate connections when nodes change
  useEffect(() => {
    if (state.nodes.length > 0 && state.connections.length > 0) {
      validateConnections()
    }
  }, [state.nodes, validateConnections])
  
  const contextValue: WorkflowContextType = useMemo(() => ({
    state,
    svgRef,
    containerRef,
    dispatch,
    isNodeSelected,
    getSelectedNodesList,
    canDropOnPort,
    canDropOnNode,
    validateConnections,
    saveConnectionsToStorage,
    loadConnectionsFromStorage: loadConnectionsFromStorageHandler,
    toggleAutoSave
  }), [state, svgRef, containerRef, dispatch, isNodeSelected, getSelectedNodesList, canDropOnPort, canDropOnNode, validateConnections, saveConnectionsToStorage, loadConnectionsFromStorageHandler, toggleAutoSave])
  
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

// Export types (centralized types are re-exported from ../types)
export type { WorkflowState, WorkflowAction }
export type { ExecutionState, CanvasTransform, ConnectionState, UIState } from '../types'