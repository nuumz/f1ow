import type { ReactNode } from 'react';
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';

// Import centralized types
import type {
  WorkflowNode,
  Connection,
  NodeVariant,
  ExecutionState,
  CanvasTransform,
  ConnectionState,
  UIState,
} from '../types';

// Import draft storage utilities
import {
  type DraftWorkflow,
  saveDraftWorkflow,
  autoSaveDraftWorkflow,
  loadDraftWorkflow,
  listDraftWorkflows,
  deleteDraftWorkflow,
  getWorkflowStorageStats,
  setAutoSaveCallback,
} from '../utils/workflow-storage';

// Lightweight logger: info/warn deferred in development to avoid React DevTools stack noise; error logs immediately
const logger = {
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    setTimeout(() => {
      try {
        // Use warn channel to satisfy ESLint no-console policy (warn/error only)
        console.warn('[info]', ...(args as []));
      } catch {
        /* noop */
      }
    }, 0);
  },
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    setTimeout(() => {
      try {
        console.warn(...(args as []));
      } catch {
        /* noop */
      }
    }, 0);
  },
  error: (...args: unknown[]) => {
    // true errors should surface immediately
    console.error(...(args as []));
  },
} as const;

// Workflow state interface (extends centralized types)
export interface WorkflowState {
  // Core data
  workflowName: string;
  nodes: WorkflowNode[];
  connections: Connection[];

  // Selection state
  selectedNodes: Set<string>;
  selectedNode: WorkflowNode | null;

  // Canvas state
  canvasTransform: CanvasTransform;

  // Connection state
  connectionState: ConnectionState;

  // Execution state
  executionState: ExecutionState;

  // UI state
  uiState: UIState;

  // Dragging state
  draggingState: {
    isDragging: boolean;
    draggedNodeId: string | null;
    dragStartPosition: { x: number; y: number } | null;
    currentPosition: { x: number; y: number } | null;
  };

  // Mode state
  designerMode: 'workflow' | 'architecture';
  architectureMode: 'context' | 'api-flow' | 'service-mesh' | 'domain-driven';

  // Workflow metadata
  lastSaved: number;
  isDirty: boolean;

  // Auto-save state
  autoSaveState: {
    isAutoSaving: boolean;
    lastAutoSaveAttempt: number;
    autoSaveError: string | null;
  };

  // Draft tracking
  currentDraftId: string | null;
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
  | {
      type: 'START_CONNECTION';
      payload: { nodeId: string; portId: string; type: 'input' | 'output' };
    }
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
  | {
      type: 'SET_ARCHITECTURE_MODE';
      payload: 'context' | 'api-flow' | 'service-mesh' | 'domain-driven';
    }

  // Dragging actions
  | { type: 'START_DRAGGING'; payload: { nodeId: string; startPosition: { x: number; y: number } } }
  | { type: 'UPDATE_DRAG_POSITION'; payload: { x: number; y: number } }
  | { type: 'END_DRAGGING' }

  // Batched operations for performance
  | { type: 'BATCH_OPERATIONS'; payload: WorkflowAction[] }

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
  | { type: 'DETACH_CURRENT_DRAFT' };

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
    autoSaveEnabled: true,
  },
  executionState: {
    status: 'idle',
    completedNodes: [],
    nodeData: {},
    errors: {},
    logs: [],
  },
  uiState: {
    showGrid: true,
    showNodeEditor: false,
    isDragOver: false,
    nodeVariant: 'standard',
  },
  draggingState: {
    isDragging: false,
    draggedNodeId: null,
    dragStartPosition: null,
    currentPosition: null,
  },
  designerMode: 'workflow',
  architectureMode: 'context',
  lastSaved: Date.now(),
  isDirty: false,
  autoSaveState: {
    isAutoSaving: false,
    lastAutoSaveAttempt: 0,
    autoSaveError: null,
  },
  currentDraftId: null,
};

// Helper functions for connection management
const saveConnectionsToStorage = (workflowName: string, connections: Connection[]) => {
  try {
    const key = `workflow-connections-${workflowName}`;
    const connectionData = {
      connections,
      timestamp: Date.now(),
      version: '1.0',
    };
    localStorage.setItem(key, JSON.stringify(connectionData));
    logger.info('Connections saved to storage:', connections.length, 'connections');
  } catch (error) {
    logger.error('Failed to save connections to localStorage:', error);
  }
};

const loadConnectionsFromStorage = (workflowName: string): Connection[] => {
  try {
    const key = `workflow-connections-${workflowName}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const connectionData = JSON.parse(saved);
      logger.info(
        'Connections loaded from storage:',
        connectionData.connections.length,
        'connections'
      );
      return connectionData.connections || [];
    }
  } catch (error) {
    logger.error('Failed to load connections from localStorage:', error);
  }
  return [];
};

const validateConnections = (
  connections: Connection[],
  nodes: WorkflowNode[],
  designerMode?: 'workflow' | 'architecture'
): Connection[] => {
  if (connections.length === 0 || nodes.length === 0) {
    return [];
  }

  // Precompute node & port indexes for O(1) validation
  const nodeIds = new Set<string>();
  const nodePortMap = new Map<
    string,
    { inputs: Set<string>; outputs: Set<string>; bottoms: Set<string> }
  >();

  for (const n of nodes) {
    nodeIds.add(n.id);
    nodePortMap.set(n.id, {
      inputs: new Set(n.inputs.map((p) => p.id)),
      outputs: new Set(n.outputs.map((p) => p.id)),
      bottoms: new Set((n.bottomPorts || []).map((p) => p.id)),
    });
  }

  const allowVirtualSidePorts = designerMode === 'architecture';
  const isVirtualSidePort = (portId: string) => portId.startsWith('__side-');

  return connections.filter((conn) => {
    // Node existence fast check
    if (!nodeIds.has(conn.sourceNodeId) || !nodeIds.has(conn.targetNodeId)) {
      logger.warn('Invalid connection - missing node:', conn);
      return false;
    }

    const sourcePorts = nodePortMap.get(conn.sourceNodeId);
    const targetPorts = nodePortMap.get(conn.targetNodeId);
    if (!sourcePorts || !targetPorts) {
      return false;
    }

    const sourcePortExists =
      sourcePorts.outputs.has(conn.sourcePortId) ||
      sourcePorts.bottoms.has(conn.sourcePortId) ||
      (allowVirtualSidePorts && isVirtualSidePort(conn.sourcePortId));

    const targetPortExists =
      targetPorts.inputs.has(conn.targetPortId) ||
      targetPorts.bottoms.has(conn.targetPortId) ||
      (allowVirtualSidePorts && isVirtualSidePort(conn.targetPortId));

    if (!sourcePortExists || !targetPortExists) {
      logger.warn('Invalid connection - missing port:', {
        connection: conn,
        sourcePortExists,
        targetPortExists,
        allowVirtualSidePorts,
        designerMode,
      });
      return false;
    }
    return true;
  });
};

// Cache last validation signature (module scope – not part of React state)
let lastValidationSignature: string | null = null;

const markStateAsDirty = (state: WorkflowState): WorkflowState => ({
  ...state,
  isDirty: true,
  connectionState: {
    ...state.connectionState,
    lastModified: Date.now(),
  },
});

// Reducer function
// This reducer aggregates many action types by design for a central state machine.
// Refactoring into multiple reducers would add indirection without clear benefit.
function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  // NOSONAR
  switch (
    action.type // NOSONAR
  ) {
    case 'SET_WORKFLOW_NAME':
      return markStateAsDirty({ ...state, workflowName: action.payload });

    case 'LOAD_WORKFLOW':
      return {
        ...state,
        nodes: action.payload.nodes,
        connections: action.payload.connections,
        selectedNodes: new Set(),
        selectedNode: null,
        connectionState: {
          ...state.connectionState,
          selectedConnection: null,
        },
      };

    case 'ADD_NODE':
      return markStateAsDirty({ ...state, nodes: [...state.nodes, action.payload] });

    case 'UPDATE_NODE':
      return markStateAsDirty({
        ...state,
        nodes: state.nodes.map((node) =>
          node.id === action.payload.nodeId ? { ...node, ...action.payload.updates } : node
        ),
      });

    case 'DELETE_NODE':
      return markStateAsDirty({
        ...state,
        nodes: state.nodes.filter((node) => node.id !== action.payload),
        connections: state.connections.filter(
          (conn) => conn.sourceNodeId !== action.payload && conn.targetNodeId !== action.payload
        ),
        selectedNodes: new Set([...state.selectedNodes].filter((id) => id !== action.payload)),
        selectedNode: state.selectedNode?.id === action.payload ? null : state.selectedNode,
      });

    case 'UPDATE_NODE_POSITION':
      return markStateAsDirty({
        ...state,
        nodes: state.nodes.map((node) =>
          node.id === action.payload.nodeId
            ? { ...node, x: action.payload.x, y: action.payload.y }
            : node
        ),
      });

    case 'ADD_CONNECTION': {
      const newConnections = [...state.connections, action.payload];
      const newState = markStateAsDirty({ ...state, connections: newConnections });

      // Auto-save to storage if enabled
      if (state.connectionState.autoSaveEnabled) {
        saveConnectionsToStorage(state.workflowName, newConnections);
      }

      logger.info('Connection added:', action.payload.id);
      return newState;
    }

    case 'DELETE_CONNECTION': {
      const newConnections = state.connections.filter((conn) => conn.id !== action.payload);
      const newState = markStateAsDirty({
        ...state,
        connections: newConnections,
        connectionState: {
          ...state.connectionState,
          selectedConnection:
            state.connectionState.selectedConnection?.id === action.payload
              ? null
              : state.connectionState.selectedConnection,
        },
      });

      // Auto-save to storage if enabled
      if (state.connectionState.autoSaveEnabled) {
        saveConnectionsToStorage(state.workflowName, newConnections);
      }

      logger.info('Connection deleted:', action.payload);
      return newState;
    }

    case 'SET_CONNECTIONS': {
      const newState = markStateAsDirty({ ...state, connections: action.payload });

      // Auto-save to storage if enabled
      if (state.connectionState.autoSaveEnabled) {
        saveConnectionsToStorage(state.workflowName, action.payload);
      }

      logger.info('Connections set:', action.payload.length, 'connections');
      return newState;
    }

    case 'UPDATE_CONNECTION': {
      const newConnections = state.connections.map((conn) =>
        conn.id === action.payload.connectionId ? { ...conn, ...action.payload.updates } : conn
      );
      const newState = markStateAsDirty({ ...state, connections: newConnections });

      // Auto-save to storage if enabled
      if (state.connectionState.autoSaveEnabled) {
        saveConnectionsToStorage(state.workflowName, newConnections);
      }

      logger.info('Connection updated:', action.payload.connectionId);
      return newState;
    }

    case 'VALIDATE_CONNECTIONS': {
      const validConnections = validateConnections(
        state.connections,
        state.nodes,
        state.designerMode
      );
      const invalidCount = state.connections.length - validConnections.length;

      if (invalidCount > 0) {
        logger.warn(`⚠️ Removed ${invalidCount} invalid connections`);
        const newState = markStateAsDirty({ ...state, connections: validConnections });

        // Auto-save to storage if enabled
        if (state.connectionState.autoSaveEnabled) {
          saveConnectionsToStorage(state.workflowName, validConnections);
        }

        return newState;
      }

      //console.log('✅ All connections are valid')
      return state;
    }

    case 'SAVE_CONNECTIONS_TO_STORAGE': {
      saveConnectionsToStorage(state.workflowName, state.connections);
      return {
        ...state,
        lastSaved: Date.now(),
        isDirty: false,
      };
    }

    case 'LOAD_CONNECTIONS_FROM_STORAGE': {
      const validConnections = validateConnections(action.payload, state.nodes, state.designerMode);
      logger.info('Loaded connections from storage:', validConnections.length, 'connections');
      return { ...state, connections: validConnections, isDirty: false };
    }

    case 'SELECT_NODE': {
      const { nodeId, multiSelect } = action.payload;
      const newSelectedNodes = new Set(state.selectedNodes);

      if (multiSelect) {
        if (newSelectedNodes.has(nodeId)) {
          newSelectedNodes.delete(nodeId);
        } else {
          newSelectedNodes.add(nodeId);
        }
      } else {
        newSelectedNodes.clear();
        newSelectedNodes.add(nodeId);
      }

      return { ...state, selectedNodes: newSelectedNodes };
    }

    case 'SET_SELECTED_NODES':
      return { ...state, selectedNodes: action.payload };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedNodes: new Set(),
        selectedNode: null,
        uiState: { ...state.uiState, showNodeEditor: false },
      };

    case 'SET_SELECTED_NODE':
      return { ...state, selectedNode: action.payload };

    case 'SELECT_CONNECTION':
      return {
        ...state,
        connectionState: {
          ...state.connectionState,
          selectedConnection: action.payload,
        },
      };

    case 'SET_CANVAS_TRANSFORM':
      return { ...state, canvasTransform: action.payload };

    case 'START_CONNECTION': {
      logger.info('START_CONNECTION reducer:', action.payload);
      const newConnectionState = {
        ...state,
        connectionState: {
          ...state.connectionState,
          isConnecting: true,
          connectionStart: action.payload,
          connectionPreview: null,
        },
      };
      logger.info('New connection state:', newConnectionState.connectionState);
      return newConnectionState;
    }

    case 'UPDATE_CONNECTION_PREVIEW':
      return {
        ...state,
        connectionState: {
          ...state.connectionState,
          connectionPreview: action.payload,
        },
      };

    case 'CLEAR_CONNECTION_STATE': {
      logger.info('CLEAR_CONNECTION_STATE reducer called');
      const newState = {
        ...state,
        connectionState: {
          ...state.connectionState,
          isConnecting: false,
          connectionStart: null,
          connectionPreview: null,
        },
      };

      // Auto-save will be triggered by useEffect after isConnecting becomes false

      return newState;
    }

    case 'SET_EXECUTION_STATE':
      return {
        ...state,
        executionState: { ...state.executionState, ...action.payload },
      };

    case 'RESET_EXECUTION':
      return {
        ...state,
        executionState: {
          status: 'idle',
          completedNodes: [],
          nodeData: {},
          errors: {},
          logs: [],
        },
      };

    case 'TOGGLE_GRID':
      return {
        ...state,
        uiState: { ...state.uiState, showGrid: !state.uiState.showGrid },
      };

    case 'SET_SHOW_NODE_EDITOR':
      return {
        ...state,
        uiState: { ...state.uiState, showNodeEditor: action.payload },
      };

    case 'SET_DRAG_OVER':
      return {
        ...state,
        uiState: { ...state.uiState, isDragOver: action.payload },
      };

    case 'SET_NODE_VARIANT':
      return {
        ...state,
        uiState: { ...state.uiState, nodeVariant: action.payload },
      };

    case 'SET_DESIGNER_MODE':
      return {
        ...state,
        designerMode: action.payload,
      };

    case 'SET_ARCHITECTURE_MODE':
      return {
        ...state,
        architectureMode: action.payload,
      };

    case 'START_DRAGGING':
      return {
        ...state,
        draggingState: {
          isDragging: true,
          draggedNodeId: action.payload.nodeId,
          dragStartPosition: action.payload.startPosition,
          currentPosition: action.payload.startPosition,
        },
      };

    case 'UPDATE_DRAG_POSITION':
      return {
        ...state,
        draggingState: {
          ...state.draggingState,
          currentPosition: action.payload,
        },
      };

    case 'END_DRAGGING':
      return {
        ...state,
        draggingState: {
          isDragging: false,
          draggedNodeId: null,
          dragStartPosition: null,
          currentPosition: null,
        },
      };

    case 'BATCH_OPERATIONS':
      // Process multiple actions in a single render cycle
      return action.payload.reduce((currentState, batchAction) => {
        // Prevent infinite recursion by not allowing nested batch operations
        if (batchAction.type === 'BATCH_OPERATIONS') {
          logger.warn('Nested batch operations are not allowed');
          return currentState;
        }
        return workflowReducer(currentState, batchAction);
      }, state);

    case 'MARK_DIRTY':
      return {
        ...state,
        isDirty: true,
        connectionState: {
          ...state.connectionState,
          lastModified: Date.now(),
        },
      };

    case 'MARK_CLEAN':
      return {
        ...state,
        isDirty: false,
        lastSaved: Date.now(),
      };

    case 'SET_LAST_SAVED':
      return {
        ...state,
        lastSaved: action.payload,
        isDirty: false,
      };

    case 'TOGGLE_AUTO_SAVE':
      return {
        ...state,
        connectionState: {
          ...state.connectionState,
          autoSaveEnabled: action.payload,
        },
      };

    case 'SAVE_DRAFT': {
      const { draftId, name } = action.payload;
      const draftData = {
        id: draftId,
        name: name ?? state.workflowName,
        nodes: state.nodes,
        connections: state.connections,
        canvasTransform: state.canvasTransform,
        // Include current designer modes
        designerMode: state.designerMode,
        architectureMode: state.architectureMode,
      };

      const success = saveDraftWorkflow(draftData, { bumpVersion: true });
      if (success) {
        logger.info('Draft saved successfully:', draftId, 'with mode:', state.designerMode);
        return {
          ...state,
          lastSaved: Date.now(),
          isDirty: false,
          currentDraftId: draftId,
          // If user passed a new name, update workflowName so UI reflects rename
          workflowName: name ?? state.workflowName,
        };
      }
      return state;
    }

    case 'LOAD_DRAFT': {
      const { draft } = action.payload;
      logger.info('Loading draft:', draft.name, 'with mode:', draft.designerMode);
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
          selectedConnection: null,
        },
        isDirty: false,
        lastSaved: draft.metadata.updatedAt,
        currentDraftId: draft.id,
      };
    }

    case 'AUTO_SAVE_DRAFT': {
      // If we have a current draft (and it's not an auto-save temp), update that instead of spawning a parallel auto-save draft
      const draftId =
        state.currentDraftId && !state.currentDraftId.startsWith('auto-save-')
          ? state.currentDraftId
          : `auto-save-${state.workflowName}`;
      const draftData = {
        id: draftId,
        name: state.workflowName,
        nodes: state.nodes,
        connections: state.connections,
        canvasTransform: state.canvasTransform,
        // Include modes in auto-save
        designerMode: state.designerMode,
        architectureMode: state.architectureMode,
      };

      // Perform auto-save without triggering re-render
      autoSaveDraftWorkflow(draftData);
      logger.info('Auto-save completed silently (no re-render)');

      // Return state unchanged to prevent re-render
      return {
        ...state,
        // Only update timestamp without causing visual changes
        autoSaveState: {
          ...state.autoSaveState,
          lastAutoSaveAttempt: Date.now(),
        },
      };
    }

    case 'AUTO_SAVE_STARTED': {
      return {
        ...state,
        autoSaveState: {
          ...state.autoSaveState,
          isAutoSaving: true,
          autoSaveError: null,
        },
      };
    }

    case 'AUTO_SAVE_COMPLETED': {
      return {
        ...state,
        isDirty: false,
        lastSaved: Date.now(),
        autoSaveState: {
          ...state.autoSaveState,
          isAutoSaving: false,
          autoSaveError: null,
        },
      };
    }

    case 'AUTO_SAVE_FAILED': {
      logger.error('❌ Auto-save failed:', action.payload.error);
      return {
        ...state,
        autoSaveState: {
          ...state.autoSaveState,
          isAutoSaving: false,
          autoSaveError: action.payload.error,
        },
      };
    }

    case 'DELETE_DRAFT': {
      const success = deleteDraftWorkflow(action.payload);
      if (success) {
        logger.info('Draft deleted successfully:', action.payload);
      }
      return state;
    }

    case 'DETACH_CURRENT_DRAFT': {
      return {
        ...state,
        currentDraftId: null,
      };
    }

    default:
      return state;
  }
}

// Context interface
interface WorkflowContextType {
  // State
  state: WorkflowState;

  // Refs
  svgRef: React.RefObject<SVGSVGElement>;
  containerRef: React.RefObject<HTMLDivElement>;

  // Dispatch
  dispatch: React.Dispatch<WorkflowAction>;

  // Computed values
  isNodeSelected: (nodeId: string) => boolean;
  getSelectedNodesList: () => WorkflowNode[];
  canDropOnPort: (
    targetNodeId: string,
    targetPortId: string,
    targetPortType?: 'input' | 'output'
  ) => boolean;
  canDropOnNode: (targetNodeId: string) => boolean;

  // Connection management
  validateConnections: () => void;
  saveConnectionsToStorage: () => void;
  loadConnectionsFromStorage: () => void;
  toggleAutoSave: (enabled: boolean) => void;

  // Draft management
  saveDraft: (draftId: string, name?: string) => void;
  loadDraft: (draftId: string) => boolean;
  autoSaveDraft: () => void;
  deleteDraft: (draftId: string) => void;
  listDrafts: () => Array<Pick<DraftWorkflow, 'id' | 'name' | 'metadata'>>;
  getStorageStats: () => ReturnType<typeof getWorkflowStorageStats>;

  // Auto-save status
  getAutoSaveStatus: () => {
    isAutoSaving: boolean;
    lastAttempt: number;
    error: string | null;
  };

  // Designer mode management
  setDesignerMode: (mode: 'workflow' | 'architecture') => void;

  // Batched operations for performance
  batchOperations: (actions: WorkflowAction[]) => void;

  // Dragging management
  startDragging: (nodeId: string, startPosition: { x: number; y: number }) => void;
  updateDragPosition: (x: number, y: number) => void;
  endDragging: () => void;
  isDragging: () => boolean;
  getDraggedNodeId: () => string | null;
}

// Context
const WorkflowContext = createContext<WorkflowContextType | null>(null);

// Provider component
interface WorkflowProviderProps {
  readonly children: ReactNode;
  readonly initialWorkflow?: {
    readonly name?: string;
    readonly nodes?: WorkflowNode[];
    readonly connections?: Connection[];
  };
}

export function WorkflowProvider({ children, initialWorkflow }: WorkflowProviderProps) {
  const [state, dispatch] = useReducer(workflowReducer, {
    ...initialState,
    ...(initialWorkflow && {
      workflowName: initialWorkflow.name || initialState.workflowName,
      nodes: initialWorkflow.nodes || initialState.nodes,
      connections: initialWorkflow.connections || initialState.connections,
    }),
  });

  // Create stable refs for current state to avoid stale closures
  const currentStateRef = useRef(state);
  currentStateRef.current = state;

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Computed values
  const isNodeSelected = useCallback(
    (nodeId: string) => {
      return state.selectedNodes.has(nodeId);
    },
    [state.selectedNodes]
  );

  const getSelectedNodesList = useCallback(() => {
    return state.nodes.filter((node) => state.selectedNodes.has(node.id));
  }, [state.nodes, state.selectedNodes]);

  const canDropOnPort = useCallback(
    (targetNodeId: string, targetPortId: string, targetPortType?: 'input' | 'output') => {
      const { connectionStart } = state.connectionState;
      if (!connectionStart || connectionStart.nodeId === targetNodeId) {
        return false;
      }

      // Validate port types - output can only connect to input and vice versa
      if (targetPortType && connectionStart.type === targetPortType) {
        return false;
      }

      // Check if exact same connection already exists (same source & target)
      const existingConnection = state.connections.find((conn) => {
        if (connectionStart.type === 'output') {
          return (
            conn.sourceNodeId === connectionStart.nodeId &&
            conn.sourcePortId === connectionStart.portId &&
            conn.targetNodeId === targetNodeId &&
            conn.targetPortId === targetPortId
          );
        } else {
          return (
            conn.sourceNodeId === targetNodeId &&
            conn.sourcePortId === targetPortId &&
            conn.targetNodeId === connectionStart.nodeId &&
            conn.targetPortId === connectionStart.portId
          );
        }
      });

      // In architecture mode, allow duplicates for virtual side ports because they are omni-ports
      const isVirtualSidePort = (id: string) => id.startsWith('__side-');
      if (
        state.designerMode === 'architecture' &&
        (isVirtualSidePort(connectionStart.portId) || isVirtualSidePort(targetPortId))
      ) {
        return true;
      }

      // Allow connection if exact same connection doesn't exist
      // This allows multiple connections from one output to multiple inputs
      // and multiple connections to one input from multiple outputs
      return !existingConnection;
    },
    [state.connectionState, state.connections, state.designerMode]
  );

  const canDropOnNode = useCallback(
    (targetNodeId: string) => {
      const { connectionStart } = state.connectionState;
      return !!connectionStart && connectionStart.nodeId !== targetNodeId;
    },
    [state.connectionState]
  );

  // Connection management functions
  const validateConnections = useCallback(() => {
    dispatch({ type: 'VALIDATE_CONNECTIONS' });
  }, [dispatch]);

  const saveConnectionsToStorage = useCallback(() => {
    dispatch({ type: 'SAVE_CONNECTIONS_TO_STORAGE' });
  }, [dispatch]);

  const loadConnectionsFromStorageHandler = useCallback(() => {
    const savedConnections = loadConnectionsFromStorage(state.workflowName);
    if (savedConnections.length > 0) {
      dispatch({ type: 'LOAD_CONNECTIONS_FROM_STORAGE', payload: savedConnections });
    }
  }, [state.workflowName, dispatch]);

  const toggleAutoSave = useCallback(
    (enabled: boolean) => {
      dispatch({ type: 'TOGGLE_AUTO_SAVE', payload: enabled });
    },
    [dispatch]
  );

  // Draft management functions
  const saveDraft = useCallback(
    (draftId: string, name?: string) => {
      dispatch({ type: 'SAVE_DRAFT', payload: { draftId, name } });
    },
    [dispatch]
  );

  const loadDraft = useCallback(
    (draftId: string): boolean => {
      const draft = loadDraftWorkflow(draftId);
      if (draft) {
        dispatch({ type: 'LOAD_DRAFT', payload: { draft } });
        return true;
      }
      return false;
    },
    [dispatch]
  );

  const autoSaveDraft = useCallback(() => {
    logger.info('Auto-save dispatch triggered');
    dispatch({ type: 'AUTO_SAVE_DRAFT' });
  }, [dispatch]);

  const deleteDraft = useCallback(
    (draftId: string) => {
      dispatch({ type: 'DELETE_DRAFT', payload: draftId });
    },
    [dispatch]
  );

  const listDrafts = useCallback(() => {
    return listDraftWorkflows();
  }, []);

  const getStorageStats = useCallback(() => {
    return getWorkflowStorageStats();
  }, []);

  const getAutoSaveStatus = useCallback(() => {
    return {
      isAutoSaving: state.autoSaveState.isAutoSaving,
      lastAttempt: state.autoSaveState.lastAutoSaveAttempt,
      error: state.autoSaveState.autoSaveError,
    };
  }, [state.autoSaveState]);

  // Dragging management functions
  const startDragging = useCallback(
    (nodeId: string, startPosition: { x: number; y: number }) => {
      dispatch({
        type: 'START_DRAGGING',
        payload: { nodeId, startPosition },
      });
    },
    [dispatch]
  );

  const updateDragPosition = useCallback(
    (x: number, y: number) => {
      dispatch({
        type: 'UPDATE_DRAG_POSITION',
        payload: { x, y },
      });
    },
    [dispatch]
  );

  const endDragging = useCallback(() => {
    const currentState = currentStateRef.current;

    // Prevent duplicate calls when already not dragging
    if (!currentState.draggingState.isDragging) {
      return;
    }

    dispatch({ type: 'END_DRAGGING' });
  }, [dispatch]);

  const isDragging = useCallback(() => {
    return currentStateRef.current.draggingState.isDragging;
  }, []);

  const getDraggedNodeId = useCallback(() => {
    return currentStateRef.current.draggingState.draggedNodeId;
  }, []);

  // Designer mode management function
  const setDesignerMode = useCallback(
    (mode: 'workflow' | 'architecture') => {
      dispatch({ type: 'SET_DESIGNER_MODE', payload: mode });
    },
    [dispatch]
  );

  // Batched operations function for performance optimization
  const batchOperations = useCallback(
    (actions: WorkflowAction[]) => {
      if (actions.length === 0) {
        return;
      }
      if (actions.length === 1) {
        dispatch(actions[0]);
      } else {
        dispatch({ type: 'BATCH_OPERATIONS', payload: actions });
      }
    },
    [dispatch]
  );

  // Set up auto-save state callback
  useEffect(() => {
    const callback = (status: 'started' | 'completed' | 'failed', error?: string) => {
      switch (status) {
        case 'started':
          dispatch({ type: 'AUTO_SAVE_STARTED' });
          break;
        case 'completed':
          dispatch({ type: 'AUTO_SAVE_COMPLETED' });
          break;
        case 'failed':
          dispatch({
            type: 'AUTO_SAVE_FAILED',
            payload: { error: error || 'Unknown error' },
          });
          break;
      }
    };

    setAutoSaveCallback(callback);

    return () => {
      setAutoSaveCallback(() => {});
    };
  }, [dispatch]);

  // Auto-load connections when workflow name changes
  useEffect(() => {
    if (state.workflowName && state.workflowName !== 'New Workflow') {
      const savedConnections = loadConnectionsFromStorage(state.workflowName);
      if (savedConnections.length > 0) {
        dispatch({ type: 'LOAD_CONNECTIONS_FROM_STORAGE', payload: savedConnections });
      }
    }
  }, [state.workflowName]);

  // Auto-validate connections when node / connection identity set changes (not every minor update)
  useEffect(() => {
    if (state.nodes.length === 0 || state.connections.length === 0) {
      return;
    }
    const nodeSig = state.nodes
      .map((n) => n.id)
      .sort((a, b) => a.localeCompare(b))
      .join(',');
    const connSig = state.connections
      .map((c) => c.id)
      .sort((a, b) => a.localeCompare(b))
      .join(',');
    const signature = `${nodeSig}|${connSig}`;
    if (lastValidationSignature !== signature) {
      lastValidationSignature = signature;
      validateConnections();
    }
  }, [state.nodes, state.connections, validateConnections]);

  // Auto-save draft when workflow changes (debounced to prevent flickering during drag)
  useEffect(() => {
    if (state.isDirty && state.nodes.length > 0) {
      // Skip auto-save during drag operations to prevent port flickering
      if (state.connectionState.isConnecting) {
        logger.info('Skipping auto-save during drag operation to prevent flickering');
        return;
      }

      // Debounce auto-save to prevent excessive saves during rapid changes
      const autoSaveTimer = setTimeout(() => {
        dispatch({ type: 'AUTO_SAVE_DRAFT' });
      }, 1000); // 1 second debounce

      return () => clearTimeout(autoSaveTimer);
    }
  }, [
    state.isDirty,
    state.nodes,
    state.connections,
    state.workflowName,
    state.connectionState.isConnecting,
    dispatch,
  ]);

  // Auto-save after drag operations complete (without triggering re-render)
  useEffect(() => {
    if (!state.connectionState.isConnecting && state.isDirty && state.nodes.length > 0) {
      // If we just finished a drag operation and need to save
      const dragEndAutoSaveTimer = setTimeout(() => {
        logger.info('Silent auto-save triggered after drag completion (no re-render)');

        // Perform auto-save directly without dispatch to avoid re-render
        const draftId = `auto-save-${state.workflowName}`;
        const draftData = {
          id: draftId,
          name: state.workflowName,
          nodes: state.nodes,
          connections: state.connections,
          canvasTransform: state.canvasTransform,
          // Include modes in direct auto-save
          designerMode: state.designerMode,
          architectureMode: state.architectureMode,
        };

        // Direct auto-save without Redux action
        autoSaveDraftWorkflow(draftData);
      }, 250); // 250ms delay after drag ends

      return () => clearTimeout(dragEndAutoSaveTimer);
    }
  }, [
    state.connectionState.isConnecting,
    state.isDirty,
    state.nodes,
    state.connections,
    state.workflowName,
    state.canvasTransform,
    state.designerMode,
    state.architectureMode,
  ]);

  // Split context value into separate memoized objects to reduce re-renders
  const coreDataValue = useMemo(() => ({
    workflowName: state.workflowName,
    nodes: state.nodes,
    connections: state.connections,
    designerMode: state.designerMode,
    architectureMode: state.architectureMode,
    isDirty: state.isDirty,
    lastSaved: state.lastSaved,
  }), [
    state.workflowName,
    state.nodes,
    state.connections,
    state.designerMode,
    state.architectureMode,
    state.isDirty,
    state.lastSaved,
  ]);

  const selectionValue = useMemo(() => ({
    selectedNodes: state.selectedNodes,
    selectedNode: state.selectedNode,
  }), [state.selectedNodes, state.selectedNode]);

  const canvasValue = useMemo(() => ({
    canvasTransform: state.canvasTransform,
    draggingState: state.draggingState,
  }), [state.canvasTransform, state.draggingState]);

  const connectionValue = useMemo(() => ({
    connectionState: state.connectionState,
  }), [state.connectionState]);

  // Stable function references (only recreated when dependencies change)
  const stableFunctions = useMemo(() => ({
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
    setDesignerMode,
    batchOperations,
    startDragging,
    updateDragPosition,
    endDragging,
    isDragging,
    getDraggedNodeId,
  }), [
    dispatch,
    isNodeSelected,
    getSelectedNodesList,
    canDropOnPort,
    canDropOnNode,
    validateConnections,
    saveConnectionsToStorage,
    loadConnectionsFromStorageHandler,
    toggleAutoSave,
    saveDraft,
    loadDraft,
    autoSaveDraft,
    deleteDraft,
    listDrafts,
    getStorageStats,
    getAutoSaveStatus,
    setDesignerMode,
    batchOperations,
    startDragging,
    updateDragPosition,
    endDragging,
    isDragging,
    getDraggedNodeId,
  ]);

  // Main context value with separated concerns
  const contextValue: WorkflowContextType = useMemo(() => ({
    // Combine all state slices
    state: {
      ...coreDataValue,
      ...selectionValue,
      ...canvasValue,
      ...connectionValue,
      executionState: state.executionState,
      uiState: state.uiState,
      autoSaveState: state.autoSaveState,
      currentDraftId: state.currentDraftId,
    },
    
    // Stable refs
    svgRef,
    containerRef,
    
    // Stable functions
    ...stableFunctions,
  }), [coreDataValue, selectionValue, canvasValue, connectionValue, state.executionState, state.uiState, state.autoSaveState, state.currentDraftId, stableFunctions]);

  return <WorkflowContext.Provider value={contextValue}>{children}</WorkflowContext.Provider>;
}

// Hook to use workflow context
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflowContext() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflowContext must be used within a WorkflowProvider');
  }
  return context;
}

// Performance-optimized selector hooks to reduce re-renders
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflowNodes(): WorkflowNode[] {
  const { state } = useWorkflowContext();
  return useMemo(() => state.nodes, [state.nodes]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflowConnections(): Connection[] {
  const { state } = useWorkflowContext();
  return useMemo(() => state.connections, [state.connections]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedNodes(): WorkflowNode[] {
  const { state } = useWorkflowContext();
  return useMemo(() => {
    if (state.selectedNodes.size === 0) {
      return [];
    }
    return state.nodes.filter(node => state.selectedNodes.has(node.id));
  }, [state.nodes, state.selectedNodes]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedNodesSet(): Set<string> {
  const { state } = useWorkflowContext();
  return useMemo(() => state.selectedNodes, [state.selectedNodes]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNodeById(nodeId: string): WorkflowNode | null {
  const { state } = useWorkflowContext();
  return useMemo(() => {
    return state.nodes.find(node => node.id === nodeId) || null;
  }, [state.nodes, nodeId]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDesignerMode(): 'workflow' | 'architecture' {
  const { state } = useWorkflowContext();
  return useMemo(() => state.designerMode, [state.designerMode]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useArchitectureMode(): 'context' | 'api-flow' | 'service-mesh' | 'domain-driven' {
  const { state } = useWorkflowContext();
  return useMemo(() => state.architectureMode, [state.architectureMode]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUIState() {
  const { state } = useWorkflowContext();
  return useMemo(() => state.uiState, [state.uiState]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExecutionState() {
  const { state } = useWorkflowContext();
  return useMemo(() => state.executionState, [state.executionState]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedNode(): WorkflowNode | null {
  const { state } = useWorkflowContext();
  return useMemo(() => state.selectedNode, [state.selectedNode]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflowName(): string {
  const { state } = useWorkflowContext();
  return useMemo(() => state.workflowName, [state.workflowName]);
}

// Advanced selector hooks for derived state
// eslint-disable-next-line react-refresh/only-export-components
export function useNodesByType(nodeType?: string): WorkflowNode[] {
  const { state } = useWorkflowContext();
  return useMemo(() => {
    if (!nodeType) {
      return state.nodes;
    }
    return state.nodes.filter(node => node.type === nodeType);
  }, [state.nodes, nodeType]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConnectionMetrics() {
  const { state } = useWorkflowContext();
  return useMemo(() => {
    const connections = state.connections;
    const totalConnections = connections.length;
    const validConnections = connections.filter(conn => conn.validated !== false).length;
    const invalidConnections = totalConnections - validConnections;
    
    // Calculate node connection degrees
    const connectionCounts = new Map<string, { incoming: number; outgoing: number }>();
    connections.forEach(conn => {
      const source = connectionCounts.get(conn.sourceNodeId) || { incoming: 0, outgoing: 0 };
      const target = connectionCounts.get(conn.targetNodeId) || { incoming: 0, outgoing: 0 };
      
      connectionCounts.set(conn.sourceNodeId, { ...source, outgoing: source.outgoing + 1 });
      connectionCounts.set(conn.targetNodeId, { ...target, incoming: target.incoming + 1 });
    });

    return {
      totalConnections,
      validConnections,
      invalidConnections,
      connectionCounts,
      avgConnectionsPerNode: state.nodes.length > 0 ? totalConnections / state.nodes.length : 0,
    };
  }, [state.connections, state.nodes.length]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflowComplexity() {
  const { state } = useWorkflowContext();
  return useMemo(() => {
    const nodeCount = state.nodes.length;
    const connectionCount = state.connections.length;
    const uniqueNodeTypes = new Set(state.nodes.map(n => n.type)).size;
    
    // Calculate complexity metrics
    const density = nodeCount > 1 ? connectionCount / (nodeCount * (nodeCount - 1) / 2) : 0;
    const averageDegree = nodeCount > 0 ? (connectionCount * 2) / nodeCount : 0;
    
    let complexityScore = 'simple';
    if (nodeCount > 50 || connectionCount > 100 || uniqueNodeTypes > 10) {
      complexityScore = 'complex';
    } else if (nodeCount > 20 || connectionCount > 40 || uniqueNodeTypes > 5) {
      complexityScore = 'medium';
    }

    return {
      nodeCount,
      connectionCount,
      uniqueNodeTypes,
      density: Math.round(density * 100) / 100,
      averageDegree: Math.round(averageDegree * 100) / 100,
      complexityScore: complexityScore as 'simple' | 'medium' | 'complex',
    };
  }, [state.nodes, state.connections]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVisibleNodes(
  viewport?: { x: number; y: number; width: number; height: number; scale: number },
  bufferSize = 200
): WorkflowNode[] {
  const { state } = useWorkflowContext();
  return useMemo(() => {
    if (!viewport || state.nodes.length < 50) {
      return state.nodes;
    }

    const buffer = bufferSize / viewport.scale;
    const minX = viewport.x - buffer;
    const maxX = viewport.x + viewport.width + buffer;
    const minY = viewport.y - buffer;
    const maxY = viewport.y + viewport.height + buffer;

    return state.nodes.filter(node => {
      return node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY;
    });
  }, [state.nodes, viewport, bufferSize]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNodeConnections(nodeId: string) {
  const { state } = useWorkflowContext();
  return useMemo(() => {
    const incoming = state.connections.filter(conn => conn.targetNodeId === nodeId);
    const outgoing = state.connections.filter(conn => conn.sourceNodeId === nodeId);
    return { incoming, outgoing, total: incoming.length + outgoing.length };
  }, [state.connections, nodeId]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDragState() {
  const { state } = useWorkflowContext();
  return useMemo(() => ({
    isDragging: state.draggingState.isDragging,
    draggedNodeId: state.draggingState.draggedNodeId,
    dragStartPosition: state.draggingState.dragStartPosition,
    currentPosition: state.draggingState.currentPosition,
  }), [
    state.draggingState.isDragging,
    state.draggingState.draggedNodeId,
    state.draggingState.dragStartPosition,
    state.draggingState.currentPosition,
  ]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCanvasTransform(): CanvasTransform {
  const { state } = useWorkflowContext();
  return useMemo(() => state.canvasTransform, [state.canvasTransform]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConnectionState() {
  const { state } = useWorkflowContext();
  return useMemo(() => ({
    isConnecting: state.connectionState.isConnecting,
    connectionStart: state.connectionState.connectionStart,
    connectionPreview: state.connectionState.connectionPreview,
    selectedConnection: state.connectionState.selectedConnection,
  }), [
    state.connectionState.isConnecting,
    state.connectionState.connectionStart,
    state.connectionState.connectionPreview,
    state.connectionState.selectedConnection,
  ]);
}

// (Types relocated to WorkflowContextExports.ts to satisfy Fast Refresh constraints)
