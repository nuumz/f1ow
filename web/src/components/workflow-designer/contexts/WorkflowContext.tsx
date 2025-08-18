import type { ReactNode} from 'react';
import React, { createContext, useContext, useReducer, useCallback, useRef, useMemo, useEffect } from 'react'

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

// Import draft storage utilities
import { 
  type DraftWorkflow,
  saveDraftWorkflow,
  autoSaveDraftWorkflow,
  loadDraftWorkflow,
  listDraftWorkflows,
  deleteDraftWorkflow,
  getWorkflowStorageStats,
  setAutoSaveCallback
} from '../utils/workflow-storage'

// Workflow state interface (extends centralized types)
export interface WorkflowState {
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
  
  // Dragging state
  draggingState: {
    isDragging: boolean
    draggedNodeId: string | null
    dragStartPosition: { x: number; y: number } | null
    currentPosition: { x: number; y: number } | null
  }
  
  // Mode state
  designerMode: 'workflow' | 'architecture'
  architectureMode: 'context' | 'api-flow' | 'service-mesh' | 'domain-driven'
  
  // Workflow metadata
  lastSaved: number
  isDirty: boolean
  
  // Auto-save state
  autoSaveState: {
    isAutoSaving: boolean
    lastAutoSaveAttempt: number
    autoSaveError: string | null
  }

  // Draft tracking
  currentDraftId: string | null
}

// Action types
export type WorkflowAction =
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
  
  // Mode actions
  | { type: 'SET_DESIGNER_MODE'; payload: 'workflow' | 'architecture' }
  | { type: 'SET_ARCHITECTURE_MODE'; payload: 'context' | 'api-flow' | 'service-mesh' | 'domain-driven' }
  
  // Dragging actions
  | { type: 'START_DRAGGING'; payload: { nodeId: string; startPosition: { x: number; y: number } } }
  | { type: 'UPDATE_DRAG_POSITION'; payload: { x: number; y: number } }
  | { type: 'END_DRAGGING' }
  
  // Workflow state actions
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN' }
  | { type: 'SET_LAST_SAVED'; payload: number }
  | { type: 'TOGGLE_AUTO_SAVE'; payload: boolean }
  
  // Draft workflow actions
  | { type: 'SAVE_DRAFT'; payload: { draftId: string; name?: string } }
  | { type: 'LOAD_DRAFT'; payload: { draft: DraftWorkflow } }
  | { type: 'AUTO_SAVE_DRAFT' }
  | { type: 'AUTO_SAVE_STARTED' }
  | { type: 'AUTO_SAVE_COMPLETED' }
  | { type: 'AUTO_SAVE_FAILED'; payload: { error: string } }
  | { type: 'DELETE_DRAFT'; payload: string }
  | { type: 'DETACH_CURRENT_DRAFT' }

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
  draggingState: {
    isDragging: false,
    draggedNodeId: null,
    dragStartPosition: null,
    currentPosition: null
  },
  designerMode: 'workflow',
  architectureMode: 'context',
  lastSaved: Date.now(),
  isDirty: false,
  autoSaveState: {
    isAutoSaving: false,
    lastAutoSaveAttempt: 0,
    autoSaveError: null
  },
  currentDraftId: null
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

const validateConnections = (
  connections: Connection[],
  nodes: WorkflowNode[],
  designerMode?: 'workflow' | 'architecture'
): Connection[] => {
  if (connections.length === 0 || nodes.length === 0) {return []}

  // Precompute node & port indexes for O(1) validation
  const nodeIds = new Set<string>()
  const nodePortMap = new Map<string, { inputs: Set<string>; outputs: Set<string>; bottoms: Set<string> }>()

  for (const n of nodes) {
    nodeIds.add(n.id)
    nodePortMap.set(n.id, {
      inputs: new Set(n.inputs.map(p => p.id)),
      outputs: new Set(n.outputs.map(p => p.id)),
      bottoms: new Set((n.bottomPorts || []).map(p => p.id))
    })
  }

  const allowVirtualSidePorts = designerMode === 'architecture'
  const isVirtualSidePort = (portId: string) => portId.startsWith('__side-')

  return connections.filter(conn => {
    // Node existence fast check
    if (!nodeIds.has(conn.sourceNodeId) || !nodeIds.has(conn.targetNodeId)) {
      console.warn('Invalid connection - missing node:', conn)
      return false
    }

    const sourcePorts = nodePortMap.get(conn.sourceNodeId)
    const targetPorts = nodePortMap.get(conn.targetNodeId)
    if (!sourcePorts || !targetPorts) {return false}

    const sourcePortExists =
      sourcePorts.outputs.has(conn.sourcePortId) ||
      sourcePorts.bottoms.has(conn.sourcePortId) ||
      (allowVirtualSidePorts && isVirtualSidePort(conn.sourcePortId))

    const targetPortExists =
      targetPorts.inputs.has(conn.targetPortId) ||
      targetPorts.bottoms.has(conn.targetPortId) ||
      (allowVirtualSidePorts && isVirtualSidePort(conn.targetPortId))

    if (!sourcePortExists || !targetPortExists) {
      console.warn('Invalid connection - missing port:', {
        connection: conn,
        sourcePortExists,
        targetPortExists,
        allowVirtualSidePorts,
        designerMode
      })
      return false
    }
    return true
  })
}

// Cache last validation signature (module scope – not part of React state)
let lastValidationSignature: string | null = null

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
      return markStateAsDirty({ ...state, workflowName: action.payload })
    
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
      return markStateAsDirty({ ...state, nodes: [...state.nodes, action.payload] })
    
    case 'UPDATE_NODE':
      return markStateAsDirty({
        ...state,
        nodes: state.nodes.map(node =>
          node.id === action.payload.nodeId
            ? { ...node, ...action.payload.updates }
            : node
        )
      })
    
    case 'DELETE_NODE':
      return markStateAsDirty({
        ...state,
        nodes: state.nodes.filter(node => node.id !== action.payload),
        connections: state.connections.filter(conn =>
          conn.sourceNodeId !== action.payload && conn.targetNodeId !== action.payload
        ),
        selectedNodes: new Set([...state.selectedNodes].filter(id => id !== action.payload)),
        selectedNode: state.selectedNode?.id === action.payload ? null : state.selectedNode
      })
    
    case 'UPDATE_NODE_POSITION':
      return markStateAsDirty({
        ...state,
        nodes: state.nodes.map(node =>
          node.id === action.payload.nodeId
            ? { ...node, x: action.payload.x, y: action.payload.y }
            : node
        )
      })
    
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
      const validConnections = validateConnections(state.connections, state.nodes, state.designerMode)
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
      const validConnections = validateConnections(action.payload, state.nodes, state.designerMode)
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
      const newState = {
        ...state,
        connectionState: {
          ...state.connectionState,
          isConnecting: false,
          connectionStart: null,
          connectionPreview: null
        }
      }
      
      // Auto-save will be triggered by useEffect after isConnecting becomes false
      
      return newState
    
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
    
    case 'SET_DESIGNER_MODE':
      return {
        ...state,
        designerMode: action.payload
      }
    
    case 'SET_ARCHITECTURE_MODE':
      return {
        ...state,
        architectureMode: action.payload
      }
    
    case 'START_DRAGGING':
      return {
        ...state,
        draggingState: {
          isDragging: true,
          draggedNodeId: action.payload.nodeId,
          dragStartPosition: action.payload.startPosition,
          currentPosition: action.payload.startPosition
        }
      }
    
    case 'UPDATE_DRAG_POSITION':
      return {
        ...state,
        draggingState: {
          ...state.draggingState,
          currentPosition: action.payload
        }
      }
    
    case 'END_DRAGGING':
      return {
        ...state,
        draggingState: {
          isDragging: false,
          draggedNodeId: null,
          dragStartPosition: null,
          currentPosition: null
        }
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
    
    case 'SAVE_DRAFT': {
      const { draftId, name } = action.payload
      const draftData = {
        id: draftId,
        name: name || state.workflowName,
        nodes: state.nodes,
        connections: state.connections,
        canvasTransform: state.canvasTransform,
        // Include current designer modes
        designerMode: state.designerMode,
        architectureMode: state.architectureMode
      }
      
  const success = saveDraftWorkflow(draftData, { bumpVersion: true })
      if (success) {
        console.log('✅ Draft saved successfully:', draftId, 'with mode:', state.designerMode)
        return {
          ...state,
          lastSaved: Date.now(),
          isDirty: false,
          currentDraftId: draftId,
          // If user passed a new name, update workflowName so UI reflects rename
          workflowName: name ? name : state.workflowName
        }
      }
      return state
    }
    
    case 'LOAD_DRAFT': {
      const { draft } = action.payload
      console.log('✅ Loading draft:', draft.name, 'with mode:', draft.designerMode)
      return {
        ...state,
        workflowName: draft.name,
        nodes: draft.nodes,
        connections: draft.connections,
        canvasTransform: draft.canvasTransform,
        // Restore designer modes from draft
        designerMode: draft.designerMode || 'workflow',
        architectureMode: draft.architectureMode || 'context',
        selectedNodes: new Set(),
        selectedNode: null,
        connectionState: {
          ...state.connectionState,
          selectedConnection: null
        },
        isDirty: false,
  lastSaved: draft.metadata.updatedAt,
  currentDraftId: draft.id
      }
    }
    
    case 'AUTO_SAVE_DRAFT': {
      // If we have a current draft (and it's not an auto-save temp), update that instead of spawning a parallel auto-save draft
      const draftId = state.currentDraftId && !state.currentDraftId.startsWith('auto-save-')
        ? state.currentDraftId
        : `auto-save-${state.workflowName}`
      const draftData = {
        id: draftId,
        name: state.workflowName,
        nodes: state.nodes,
        connections: state.connections,
        canvasTransform: state.canvasTransform,
        // Include modes in auto-save
        designerMode: state.designerMode,
        architectureMode: state.architectureMode
      }
      
      // Perform auto-save without triggering re-render
  autoSaveDraftWorkflow(draftData)
      console.log('💾 Auto-save completed silently (no re-render)')
      
      // Return state unchanged to prevent re-render
      return {
        ...state,  
        // Only update timestamp without causing visual changes
        autoSaveState: {
          ...state.autoSaveState,
          lastAutoSaveAttempt: Date.now()
        }
      }
    }
    
    case 'AUTO_SAVE_STARTED': {
      return {
        ...state,
        autoSaveState: {
          ...state.autoSaveState,
          isAutoSaving: true,
          autoSaveError: null
        }
      }
    }
    
    case 'AUTO_SAVE_COMPLETED': {
      return {
        ...state,
        isDirty: false,
        lastSaved: Date.now(),
        autoSaveState: {
          ...state.autoSaveState,
          isAutoSaving: false,
          autoSaveError: null
        }
      }
    }
    
    case 'AUTO_SAVE_FAILED': {
      console.error('❌ Auto-save failed:', action.payload.error)
      return {
        ...state,
        autoSaveState: {
          ...state.autoSaveState,
          isAutoSaving: false,
          autoSaveError: action.payload.error
        }
      }
    }
    
    case 'DELETE_DRAFT': {
      const success = deleteDraftWorkflow(action.payload)
      if (success) {
        console.log('✅ Draft deleted successfully:', action.payload)
      }
      return state
    }

    case 'DETACH_CURRENT_DRAFT': {
      return {
        ...state,
        currentDraftId: null
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
  
  // Draft management
  saveDraft: (draftId: string, name?: string) => void
  loadDraft: (draftId: string) => boolean
  autoSaveDraft: () => void
  deleteDraft: (draftId: string) => void
  listDrafts: () => Array<Pick<DraftWorkflow, 'id' | 'name' | 'metadata'>>
  getStorageStats: () => ReturnType<typeof getWorkflowStorageStats>
  
  // Auto-save status
  getAutoSaveStatus: () => {
    isAutoSaving: boolean
    lastAttempt: number
    error: string | null
  }
  
  // Dragging management
  startDragging: (nodeId: string, startPosition: { x: number; y: number }) => void
  updateDragPosition: (x: number, y: number) => void
  endDragging: () => void
  isDragging: () => boolean
  getDraggedNodeId: () => string | null
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
  
  // Create stable refs for current state to avoid stale closures
  const currentStateRef = useRef(state)
  currentStateRef.current = state
  
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
    
    // In architecture mode, allow duplicates for virtual side ports because they are omni-ports
    const isVirtualSidePort = (id: string) => id.startsWith('__side-')
    if (state.designerMode === 'architecture' && (
      isVirtualSidePort(connectionStart.portId) || isVirtualSidePort(targetPortId)
    )) {
      return true
    }

    // Allow connection if exact same connection doesn't exist
    // This allows multiple connections from one output to multiple inputs
    // and multiple connections to one input from multiple outputs
    return !existingConnection
  }, [state.connectionState, state.connections, state.designerMode])
  
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

  // Draft management functions
  const saveDraft = useCallback((draftId: string, name?: string) => {
    dispatch({ type: 'SAVE_DRAFT', payload: { draftId, name } })
  }, [dispatch])

  const loadDraft = useCallback((draftId: string): boolean => {
    const draft = loadDraftWorkflow(draftId)
    if (draft) {
      dispatch({ type: 'LOAD_DRAFT', payload: { draft } })
      return true
    }
    return false
  }, [dispatch])

  const autoSaveDraft = useCallback(() => {
    console.log('📝 Auto-save dispatch triggered')
    dispatch({ type: 'AUTO_SAVE_DRAFT' })
  }, [dispatch])

  const deleteDraft = useCallback((draftId: string) => {
    dispatch({ type: 'DELETE_DRAFT', payload: draftId })
  }, [dispatch])

  const listDrafts = useCallback(() => {
    return listDraftWorkflows()
  }, [])

  const getStorageStats = useCallback(() => {
    return getWorkflowStorageStats()
  }, [])
  
  const getAutoSaveStatus = useCallback(() => {
    return {
      isAutoSaving: state.autoSaveState.isAutoSaving,
      lastAttempt: state.autoSaveState.lastAutoSaveAttempt,
      error: state.autoSaveState.autoSaveError
    }
  }, [state.autoSaveState])
  
  // Dragging management functions
  const startDragging = useCallback((nodeId: string, startPosition: { x: number; y: number }) => {
    dispatch({ 
      type: 'START_DRAGGING', 
      payload: { nodeId, startPosition }
    })
  }, [dispatch])
  
  const updateDragPosition = useCallback((x: number, y: number) => {
    dispatch({ 
      type: 'UPDATE_DRAG_POSITION', 
      payload: { x, y }
    })
  }, [dispatch])
  
  const endDragging = useCallback(() => {
    const currentState = currentStateRef.current
    
    // Prevent duplicate calls when already not dragging
    if (!currentState.draggingState.isDragging) {
      return
    }
    
    dispatch({ type: 'END_DRAGGING' })
  }, [dispatch])
  
  const isDragging = useCallback(() => {
    return currentStateRef.current.draggingState.isDragging
  }, [])
  
  const getDraggedNodeId = useCallback(() => {
    return currentStateRef.current.draggingState.draggedNodeId
  }, [])
  
  // Set up auto-save state callback
  useEffect(() => {
    const callback = (status: 'started' | 'completed' | 'failed', error?: string) => {
      switch (status) {
        case 'started':
          dispatch({ type: 'AUTO_SAVE_STARTED' })
          break
        case 'completed':
          dispatch({ type: 'AUTO_SAVE_COMPLETED' })
          break
        case 'failed':
          dispatch({ 
            type: 'AUTO_SAVE_FAILED', 
            payload: { error: error || 'Unknown error' }
          })
          break
      }
    }
    
    setAutoSaveCallback(callback)
    
    return () => {
      setAutoSaveCallback(() => {})
    }
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
  
  // Auto-validate connections when node / connection identity set changes (not every minor update)
  useEffect(() => {
    if (state.nodes.length === 0 || state.connections.length === 0) {return}
    const nodeSig = state.nodes.map(n => n.id).sort().join(',')
    const connSig = state.connections.map(c => c.id).sort().join(',')
    const signature = `${nodeSig}|${connSig}`
    if (lastValidationSignature !== signature) {
      lastValidationSignature = signature
      validateConnections()
    }
  }, [state.nodes, state.connections, validateConnections])

  // Auto-save draft when workflow changes (debounced to prevent flickering during drag)
  useEffect(() => {
    if (state.isDirty && state.nodes.length > 0) {
      // Skip auto-save during drag operations to prevent port flickering
      if (state.connectionState.isConnecting) {
        console.log('🚫 Skipping auto-save during drag operation to prevent flickering')
        return
      }
      
      // Debounce auto-save to prevent excessive saves during rapid changes
      const autoSaveTimer = setTimeout(() => {
        dispatch({ type: 'AUTO_SAVE_DRAFT' })
      }, 1000) // 1 second debounce
      
      return () => clearTimeout(autoSaveTimer)
    }
  }, [state.isDirty, state.nodes, state.connections, state.workflowName, state.connectionState.isConnecting, dispatch])
  
  // Auto-save after drag operations complete (without triggering re-render)
  useEffect(() => {
    if (!state.connectionState.isConnecting && state.isDirty && state.nodes.length > 0) {
      // If we just finished a drag operation and need to save
      const dragEndAutoSaveTimer = setTimeout(() => {
        console.log('💾 Silent auto-save triggered after drag completion (no re-render)')
        
        // Perform auto-save directly without dispatch to avoid re-render
        const draftId = `auto-save-${state.workflowName}`
        const draftData = {
          id: draftId,
          name: state.workflowName,
          nodes: state.nodes,
          connections: state.connections,
          canvasTransform: state.canvasTransform,
          // Include modes in direct auto-save
          designerMode: state.designerMode,
          architectureMode: state.architectureMode
        }
        
        // Direct auto-save without Redux action
        autoSaveDraftWorkflow(draftData)
      }, 250) // 250ms delay after drag ends
      
      return () => clearTimeout(dragEndAutoSaveTimer)
    }
  }, [state.connectionState.isConnecting, state.isDirty, state.nodes, state.connections, state.workflowName, state.canvasTransform, state.designerMode, state.architectureMode])
  
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
    toggleAutoSave,
    saveDraft,
    loadDraft,
    autoSaveDraft,
    deleteDraft,
    listDrafts,
    getStorageStats,
    getAutoSaveStatus,
    startDragging,
    updateDragPosition,
    endDragging,
    isDragging,
    getDraggedNodeId
  }), [state, svgRef, containerRef, dispatch, isNodeSelected, getSelectedNodesList, canDropOnPort, canDropOnNode, validateConnections, saveConnectionsToStorage, loadConnectionsFromStorageHandler, toggleAutoSave, saveDraft, loadDraft, autoSaveDraft, deleteDraft, listDrafts, getStorageStats, getAutoSaveStatus, startDragging, updateDragPosition, endDragging, isDragging, getDraggedNodeId])
  
  return (
    <WorkflowContext.Provider value={contextValue}>
      {children}
    </WorkflowContext.Provider>
  )
}

// Hook to use workflow context
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflowContext() {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error('useWorkflowContext must be used within a WorkflowProvider')
  }
  return context
}

// (Types relocated to WorkflowContextExports.ts to satisfy Fast Refresh constraints)