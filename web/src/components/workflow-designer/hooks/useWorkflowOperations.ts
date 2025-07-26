import { useCallback } from 'react'
import * as d3 from 'd3'
import { useWorkflowContext } from '../contexts/WorkflowContext'
import { createNode } from '../utils/node-utils'
import type { WorkflowNode } from './useNodeSelection'
import type { Connection } from './useConnections'

let connectionCounter = 0

// Generate unique connection ID
const generateConnectionId = () => {
  return `connection-${Date.now()}-${++connectionCounter}`
}

export function useWorkflowOperations() {
  const { state, dispatch, svgRef } = useWorkflowContext()

  // Node operations
  const addNode = useCallback((type: string, position?: { x: number; y: number }) => {
    let nodePosition = position
    
    if (!nodePosition && svgRef.current) {
      // Calculate center of current viewport
      const rect = svgRef.current.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      
      const currentTransform = state.canvasTransform
      if (currentTransform) {
        const canvasCenterX = (centerX - currentTransform.x) / currentTransform.k
        const canvasCenterY = (centerY - currentTransform.y) / currentTransform.k
        
        nodePosition = {
          x: canvasCenterX + (Math.random() - 0.5) * 100,
          y: canvasCenterY + (Math.random() - 0.5) * 100
        }
      }
    }
    
    const newNode = createNode(type, nodePosition || { x: 300, y: 200 })
    dispatch({ type: 'ADD_NODE', payload: newNode })
    return newNode
  }, [dispatch, svgRef, state.canvasTransform])

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    dispatch({ type: 'UPDATE_NODE', payload: { nodeId, updates } })
  }, [dispatch])

  const deleteNode = useCallback((nodeId: string) => {
    dispatch({ type: 'DELETE_NODE', payload: nodeId })
    // Validate connections after node deletion to remove invalid connections
    dispatch({ type: 'VALIDATE_CONNECTIONS' })
  }, [dispatch])

  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    dispatch({ type: 'UPDATE_NODE_POSITION', payload: { nodeId, x, y } })
  }, [dispatch])

  // Connection operations
  const createConnection = useCallback((
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => {
    // Check if exact same connection already exists
    const existingConnection = state.connections.find(conn =>
      conn.sourceNodeId === sourceNodeId &&
      conn.sourcePortId === sourcePortId &&
      conn.targetNodeId === targetNodeId &&
      conn.targetPortId === targetPortId
    )
    
    // Don't create duplicate connections
    if (existingConnection) {
      console.warn('Connection already exists:', existingConnection)
      return existingConnection
    }
    
    const newConnection: Connection = {
      id: generateConnectionId(),
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId
    }
    
    console.log('Creating new connection:', newConnection)
    console.log('Current connections count:', state.connections.length)
    
    dispatch({ type: 'ADD_CONNECTION', payload: newConnection })
    return newConnection
  }, [dispatch, state.connections])

  const deleteConnection = useCallback((connectionId: string) => {
    dispatch({ type: 'DELETE_CONNECTION', payload: connectionId })
  }, [dispatch])

  const updateConnection = useCallback((connectionId: string, updates: Partial<Connection>) => {
    dispatch({ type: 'UPDATE_CONNECTION', payload: { connectionId, updates } })
  }, [dispatch])

  // Selection operations
  const selectNode = useCallback((nodeId: string, multiSelect = false) => {
    dispatch({ type: 'SELECT_NODE', payload: { nodeId, multiSelect } })
  }, [dispatch])

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [dispatch])

  const setSelectedNode = useCallback((node: WorkflowNode | null) => {
    dispatch({ type: 'SET_SELECTED_NODE', payload: node })
  }, [dispatch])

  const selectConnection = useCallback((connection: Connection | null) => {
    dispatch({ type: 'SELECT_CONNECTION', payload: connection })
  }, [dispatch])

  // Canvas operations
  const setCanvasTransform = useCallback((transform: d3.ZoomTransform | { x: number; y: number; k: number }) => {
    const transformObj = {
      x: transform.x,
      y: transform.y,
      k: transform.k
    }
    dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: transformObj })
  }, [dispatch])

  // Connection state operations
  const startConnection = useCallback((nodeId: string, portId: string, type: 'input' | 'output') => {
    dispatch({ type: 'START_CONNECTION', payload: { nodeId, portId, type } })
  }, [dispatch])

  const updateConnectionPreview = useCallback((x: number, y: number) => {
    dispatch({ type: 'UPDATE_CONNECTION_PREVIEW', payload: { x, y } })
  }, [dispatch])

  const clearConnectionState = useCallback(() => {
    dispatch({ type: 'CLEAR_CONNECTION_STATE' })
  }, [dispatch])

  // UI operations
  const toggleGrid = useCallback(() => {
    dispatch({ type: 'TOGGLE_GRID' })
  }, [dispatch])

  const setShowNodeEditor = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_NODE_EDITOR', payload: show })
  }, [dispatch])

  const setDragOver = useCallback((isDragOver: boolean) => {
    dispatch({ type: 'SET_DRAG_OVER', payload: isDragOver })
  }, [dispatch])

  const setNodeVariant = useCallback((variant: 'standard' | 'compact') => {
    dispatch({ type: 'SET_NODE_VARIANT', payload: variant })
  }, [dispatch])

  // Workflow operations
  const setWorkflowName = useCallback((name: string) => {
    dispatch({ type: 'SET_WORKFLOW_NAME', payload: name })
  }, [dispatch])

  const loadWorkflow = useCallback((nodes: WorkflowNode[], connections: Connection[]) => {
    dispatch({ type: 'LOAD_WORKFLOW', payload: { nodes, connections } })
  }, [dispatch])

  const saveWorkflow = useCallback(async () => {
    // Validate connections before saving
    dispatch({ type: 'VALIDATE_CONNECTIONS' })
    
    const workflow = {
      name: state.workflowName,
      definition: {
        nodes: state.nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: [n.x, n.y],
          parameters: n.config
        })),
        edges: state.connections.map(c => ({
          id: c.id,
          source: c.sourceNodeId,
          target: c.targetNodeId,
          sourceHandle: c.sourcePortId,
          targetHandle: c.targetPortId
        }))
      }
    }
    
    try {
      // Save connections to storage
      dispatch({ type: 'SAVE_CONNECTIONS_TO_STORAGE' })
      
      // Mark as clean
      dispatch({ type: 'MARK_CLEAN' })
      
      console.log('Workflow saved:', workflow)
      alert('Workflow saved successfully!')
      return workflow
    } catch (error) {
      console.error('Failed to save workflow:', error)
      alert('Failed to save workflow')
      throw error
    }
  }, [state.workflowName, state.nodes, state.connections, dispatch])

  const exportWorkflow = useCallback(() => {
    const workflow = {
      name: state.workflowName,
      definition: {
        nodes: state.nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: [n.x, n.y],
          parameters: n.config
        })),
        edges: state.connections.map(c => ({
          id: c.id,
          source: c.sourceNodeId,
          target: c.targetNodeId,
          sourceHandle: c.sourcePortId,
          targetHandle: c.targetPortId
        }))
      }
    }

    const dataStr = JSON.stringify(workflow, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${state.workflowName.replace(/\s+/g, '_')}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }, [state.workflowName, state.nodes, state.connections])

  const importWorkflow = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const workflow = JSON.parse(text)
      
      if (!workflow?.definition?.nodes) {
        throw new Error('Invalid workflow format')
      }

      const nodes = workflow.definition.nodes.map((nodeData: any) => ({
        id: nodeData.id,
        type: nodeData.type,
        x: nodeData.position[0],
        y: nodeData.position[1],
        config: nodeData.parameters || {},
        inputs: [], // Will be populated by createNode
        outputs: [], // Will be populated by createNode
        status: 'idle' as const
      }))

      const connections = workflow.definition.edges?.map((edgeData: any) => ({
        id: edgeData.id,
        sourceNodeId: edgeData.source,
        sourcePortId: edgeData.sourceHandle,
        targetNodeId: edgeData.target,
        targetPortId: edgeData.targetHandle
      })) || []

      dispatch({ type: 'SET_WORKFLOW_NAME', payload: workflow.name || 'Imported Workflow' })
      dispatch({ type: 'LOAD_WORKFLOW', payload: { nodes, connections } })
      
      return { nodes, connections }
    } catch (error) {
      console.error('Failed to import workflow:', error)
      alert('Failed to import workflow: Invalid file format')
      throw error
    }
  }, [dispatch])

  // Execution operations
  const setExecutionState = useCallback((updates: Partial<typeof state.executionState>) => {
    dispatch({ type: 'SET_EXECUTION_STATE', payload: updates })
  }, [dispatch])

  const resetExecution = useCallback(() => {
    dispatch({ type: 'RESET_EXECUTION' })
  }, [dispatch])

  const executeWorkflow = useCallback(async () => {
    if (state.nodes.length === 0) {
      alert('Please add nodes to the workflow before executing')
      return
    }

    setExecutionState({ 
      status: 'running', 
      startTime: Date.now(),
      completedNodes: [],
      errors: {},
      logs: []
    })

    try {
      // Simulate workflow execution
      for (const node of state.nodes) {
        setExecutionState({ currentNode: node.id })
        
        // Add log entry
        const logEntry = {
          nodeId: node.id,
          timestamp: Date.now(),
          level: 'info' as const,
          message: `Executing node: ${node.type}`
        }
        
        setExecutionState({ 
          logs: [...state.executionState.logs, logEntry]
        })

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Mark as completed
        setExecutionState({ 
          completedNodes: [...state.executionState.completedNodes, node.id]
        })
      }
      
      setExecutionState({ 
        status: 'completed', 
        endTime: Date.now(),
        currentNode: undefined
      })
      
      alert('Workflow executed successfully!')
    } catch (error) {
      console.error('Workflow execution failed:', error)
      setExecutionState({ 
        status: 'error',
        endTime: Date.now(),
        errors: { general: 'Execution failed' }
      })
      alert('Workflow execution failed')
    }
  }, [state.nodes, state.executionState, setExecutionState])

  return {
    // Node operations
    addNode,
    updateNode,
    deleteNode,
    updateNodePosition,
    
    // Connection operations
    createConnection,
    deleteConnection,
    updateConnection,
    
    // Selection operations
    selectNode,
    clearSelection,
    setSelectedNode,
    selectConnection,
    
    // Canvas operations
    setCanvasTransform,
    
    // Connection state operations
    startConnection,
    updateConnectionPreview,
    clearConnectionState,
    
    // UI operations
    toggleGrid,
    setShowNodeEditor,
    setDragOver,
    setNodeVariant,
    
    // Workflow operations
    setWorkflowName,
    loadWorkflow,
    saveWorkflow,
    exportWorkflow,
    importWorkflow,
    
    // Execution operations
    setExecutionState,
    resetExecution,
    executeWorkflow
  }
}