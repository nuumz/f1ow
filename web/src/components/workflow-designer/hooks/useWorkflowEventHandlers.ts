import { useCallback, useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useWorkflowContext } from '../contexts/WorkflowContext'
import { useWorkflowOperations } from './useWorkflowOperations'
import { useWorkflowCanvas } from './useWorkflowCanvas'
import type { WorkflowNode } from './useNodeSelection'
import type { Connection } from './useConnections'

export function useWorkflowEventHandlers() {
  const { state, svgRef, dispatch } = useWorkflowContext()
  const operations = useWorkflowOperations()
  const canvas = useWorkflowCanvas()
  
  // Use ref to store current connection state to avoid stale closure
  const connectionStateRef = useRef(state.connectionState)
  
  // Update ref when state changes
  useEffect(() => {
    connectionStateRef.current = state.connectionState
  }, [state.connectionState])

  // Canvas event handlers
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (state.connectionState.isConnecting) {
      dispatch({ type: 'CLEAR_CONNECTION_STATE' })
      return
    }

    const ctrlKey = event.ctrlKey || event.metaKey
    if (!ctrlKey) {
      dispatch({ type: 'CLEAR_SELECTION' })
      dispatch({ type: 'SELECT_CONNECTION', payload: null })
    }
    
    dispatch({ type: 'SET_SHOW_NODE_EDITOR', payload: false })
  }, [state.connectionState.isConnecting, dispatch])

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    dispatch({ type: 'SET_DRAG_OVER', payload: true })
  }, [dispatch])

  const handleCanvasDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dispatch({ type: 'SET_DRAG_OVER', payload: false })
  }, [dispatch])

  const handleCanvasDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dispatch({ type: 'SET_DRAG_OVER', payload: false })
    
    const nodeType = event.dataTransfer.getData('application/node-type')
    if (nodeType && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const clientX = event.clientX - rect.left
      const clientY = event.clientY - rect.top
      
      // Convert screen coordinates to canvas coordinates
      const currentTransform = state.canvasTransform
      if (currentTransform) {
        const canvasX = (clientX - currentTransform.x) / currentTransform.k
        const canvasY = (clientY - currentTransform.y) / currentTransform.k
        
        // Use operations for node creation as it includes proper node setup
        operations.addNode(nodeType, { x: canvasX, y: canvasY })
      } else {
        // Fallback to screen coordinates if transform not available
        operations.addNode(nodeType, { x: clientX, y: clientY })
      }
    }
  }, [dispatch, svgRef, state.canvasTransform, operations])

  // Node event handlers
  const handleNodeClick = useCallback((nodeData: WorkflowNode, ctrlKey: boolean = false) => {
    dispatch({ type: 'SELECT_NODE', payload: { nodeId: nodeData.id, multiSelect: ctrlKey } })
    dispatch({ type: 'SELECT_CONNECTION', payload: null })
    dispatch({ type: 'SET_SHOW_NODE_EDITOR', payload: false })
  }, [dispatch])

  const handleNodeDoubleClick = useCallback((nodeData: WorkflowNode) => {
    dispatch({ type: 'CLEAR_SELECTION' })
    dispatch({ type: 'SELECT_NODE', payload: { nodeId: nodeData.id, multiSelect: false } })
    dispatch({ type: 'SET_SELECTED_NODE', payload: nodeData })
    dispatch({ type: 'SELECT_CONNECTION', payload: null })
    dispatch({ type: 'SET_SHOW_NODE_EDITOR', payload: true })
  }, [dispatch])

  const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
    dispatch({ type: 'UPDATE_NODE_POSITION', payload: { nodeId, x, y } })
  }, [dispatch])

  // Connection event handlers
  const handlePortClick = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    if (state.connectionState.isConnecting && state.connectionState.connectionStart) {
      // Complete connection
      if (state.connectionState.connectionStart.nodeId !== nodeId) {
        let sourceNodeId, sourcePortId, targetNodeId, targetPortId

        if (state.connectionState.connectionStart.type === 'output' && portType === 'input') {
          sourceNodeId = state.connectionState.connectionStart.nodeId
          sourcePortId = state.connectionState.connectionStart.portId
          targetNodeId = nodeId
          targetPortId = portId
        } else if (state.connectionState.connectionStart.type === 'input' && portType === 'output') {
          sourceNodeId = nodeId
          sourcePortId = portId
          targetNodeId = state.connectionState.connectionStart.nodeId
          targetPortId = state.connectionState.connectionStart.portId
        }

        if (sourceNodeId && sourcePortId && targetNodeId && targetPortId) {
          // Use operations for connection creation as it includes proper connection setup
          operations.createConnection(sourceNodeId, sourcePortId, targetNodeId, targetPortId)
        }
      }
      dispatch({ type: 'CLEAR_CONNECTION_STATE' })
    } else {
      // Start connection
      dispatch({ type: 'START_CONNECTION', payload: { nodeId, portId, type: portType } })
    }
  }, [state.connectionState, operations, dispatch])

  const handleConnectionClick = useCallback((connection: Connection) => {
    dispatch({ type: 'SELECT_CONNECTION', payload: connection })
    dispatch({ type: 'CLEAR_SELECTION' })
    dispatch({ type: 'SET_SHOW_NODE_EDITOR', payload: false })
  }, [dispatch])

  const handleCanvasMouseMove = useCallback((x: number, y: number) => {
    if (state.connectionState.isConnecting && state.connectionState.connectionStart) {
      dispatch({ type: 'UPDATE_CONNECTION_PREVIEW', payload: { x, y } })
    }
  }, [state.connectionState, dispatch])

  // Drag & Drop handlers for connections
  const handlePortDragStart = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    console.log('handlePortDragStart called:', { nodeId, portId, portType })
    console.log('Current connection state before START_CONNECTION:', state.connectionState)
    dispatch({ type: 'START_CONNECTION', payload: { nodeId, portId, type: portType } })
    
    // Force re-check state after dispatch
    setTimeout(() => {
      console.log('Connection state after START_CONNECTION dispatch:', state.connectionState)
    }, 0)
  }, [dispatch, state.connectionState])

  const handlePortDrag = useCallback((x: number, y: number) => {
    dispatch({ type: 'UPDATE_CONNECTION_PREVIEW', payload: { x, y } })
  }, [dispatch])

  const handlePortDragEnd = useCallback((targetNodeId?: string, targetPortId?: string) => {
    // Use ref to get fresh connection state
    const currentConnectionState = connectionStateRef.current
    
    console.log('handlePortDragEnd called:', {
      targetNodeId,
      targetPortId,
      connectionStart: currentConnectionState.connectionStart,
      isConnecting: currentConnectionState.isConnecting
    })
    
    if (targetNodeId && targetPortId && currentConnectionState.connectionStart) {
      const { nodeId, portId, type } = currentConnectionState.connectionStart
      
      console.log('Connection start data:', { nodeId, portId, type })
      
      if (nodeId !== targetNodeId) {
        let sourceNodeId, sourcePortId, targetNodeIdFinal, targetPortIdFinal

        if (type === 'output') {
          sourceNodeId = nodeId
          sourcePortId = portId
          targetNodeIdFinal = targetNodeId
          targetPortIdFinal = targetPortId
        } else {
          sourceNodeId = targetNodeId
          sourcePortId = targetPortId
          targetNodeIdFinal = nodeId
          targetPortIdFinal = portId
        }

        console.log('Creating connection:', {
          sourceNodeId,
          sourcePortId,
          targetNodeIdFinal,
          targetPortIdFinal
        })

        // Use operations for connection creation
        operations.createConnection(sourceNodeId, sourcePortId, targetNodeIdFinal, targetPortIdFinal)
      } else {
        console.log('Same node - not creating connection')
      }
    } else {
      console.log('Missing required data for connection creation:', {
        hasTargetNodeId: !!targetNodeId,
        hasTargetPortId: !!targetPortId,
        hasConnectionStart: !!currentConnectionState.connectionStart,
        isConnecting: currentConnectionState.isConnecting
      })
    }
    dispatch({ type: 'CLEAR_CONNECTION_STATE' })
  }, [operations, dispatch])

  // Canvas internal click handler (for WorkflowCanvas component)
  const handleCanvasClickInternal = useCallback(() => {
    if (state.connectionState.isConnecting) {
      dispatch({ type: 'CLEAR_CONNECTION_STATE' })
      return
    }
    
    dispatch({ type: 'CLEAR_SELECTION' })
    dispatch({ type: 'SELECT_CONNECTION', payload: null })
    dispatch({ type: 'SET_SHOW_NODE_EDITOR', payload: false })
  }, [state.connectionState.isConnecting, dispatch])

  // Transform change handler
  const handleTransformChange = useCallback((transform: d3.ZoomTransform) => {
    const transformObj = {
      x: transform.x,
      y: transform.y,
      k: transform.k
    }
    canvas.saveCanvasTransform(transformObj)
  }, [canvas])

  // Zoom level change handler
  const lastZoomLevelRef = useRef<number>(1)
  const handleZoomLevelChange = useCallback((zoomLevel: number) => {
    // Only log when zoom level actually changes
    if (Math.abs(zoomLevel - lastZoomLevelRef.current) > 0.01) {
      lastZoomLevelRef.current = zoomLevel
    }
  }, [])

  // Keyboard event handlers
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Delete selected items
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (state.selectedNodes.size > 0) {
        // Delete selected nodes
        Array.from(state.selectedNodes).forEach(nodeId => {
          dispatch({ type: 'DELETE_NODE', payload: nodeId })
        })
      } else if (state.connectionState.selectedConnection) {
        // Delete selected connection
        dispatch({ type: 'DELETE_CONNECTION', payload: state.connectionState.selectedConnection.id })
      }
      event.preventDefault()
    }
    
    // Select all (Ctrl+A)
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      const allNodeIds = new Set(state.nodes.map(node => node.id))
      dispatch({ type: 'SET_SELECTED_NODES', payload: allNodeIds })
      event.preventDefault()
    }
    
    // Copy (Ctrl+C)
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      if (state.selectedNodes.size > 0) {
        const selectedNodes = state.nodes.filter(node => state.selectedNodes.has(node.id))
        const selectedConnections = state.connections.filter(conn => 
          state.selectedNodes.has(conn.sourceNodeId) && state.selectedNodes.has(conn.targetNodeId)
        )
        
        const clipboardData = {
          nodes: selectedNodes,
          connections: selectedConnections
        }
        
        try {
          navigator.clipboard.writeText(JSON.stringify(clipboardData))
          console.log('Copied to clipboard:', clipboardData)
        } catch (error) {
          console.warn('Failed to copy to clipboard:', error)
        }
      }
      event.preventDefault()
    }
    
    // Escape - Clear selection and connection state
    if (event.key === 'Escape') {
      dispatch({ type: 'CLEAR_SELECTION' })
      dispatch({ type: 'CLEAR_CONNECTION_STATE' })
      dispatch({ type: 'SET_SHOW_NODE_EDITOR', payload: false })
      event.preventDefault()
    }
  }, [state.selectedNodes, state.connectionState, state.nodes, state.connections, dispatch])

  return {
    // Canvas handlers
    handleCanvasClick,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
    handleCanvasClickInternal,
    handleCanvasMouseMove,
    handleTransformChange,
    handleZoomLevelChange,
    
    // Node handlers
    handleNodeClick,
    handleNodeDoubleClick,
    handleNodeDrag,
    
    // Connection handlers
    handlePortClick,
    handleConnectionClick,
    handlePortDragStart,
    handlePortDrag,
    handlePortDragEnd,
    
    // Keyboard handlers
    handleKeyDown
  }
}