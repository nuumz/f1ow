import { useCallback, useRef, useEffect } from 'react'
import type * as d3 from 'd3'
import { useWorkflowContext } from '../contexts/WorkflowContext'
import { useWorkflowOperations } from './useWorkflowOperations'
import { useWorkflowCanvas } from './useWorkflowCanvas'
import { ArchitectureNodeDefinitions } from '../types/architecture'
import type { NodeDefinition } from '../types'
import type { WorkflowNode } from './useNodeSelection'
import type { Connection } from './useConnections'

export function useWorkflowEventHandlers() {
  const { state, svgRef, dispatch } = useWorkflowContext()
  const operations = useWorkflowOperations()
  const canvas = useWorkflowCanvas()

  // Use ref to store current connection state to avoid stale closure
  const connectionStateRef = useRef(state.connectionState)
  // Track node count for adaptive throttling without re-creating callbacks
  const nodesCountRef = useRef(state.nodes.length)
  useEffect(() => {
    nodesCountRef.current = state.nodes.length
  }, [state.nodes.length])

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

        // Route by mode: architecture nodes use ArchitectureNodeDefinitions
        if (state.designerMode === 'architecture') {
          // Common aliases from palette → definition keys
          const alias: Record<string, string> = {
            api: 'rest-api',
            queue: 'message-queue',
            storage: 'database',
            loadbalancer: 'load-balancer'
          }
          const defKey = ArchitectureNodeDefinitions[nodeType]
            ? nodeType
            : (alias[nodeType] ?? nodeType)

          const def: NodeDefinition | undefined = ArchitectureNodeDefinitions[defKey]

          if (def) {
            const cfg = (def.defaultConfig ?? {}) as Record<string, unknown>
            let label: string | undefined
            if ('serviceName' in cfg) {
              const v = cfg['serviceName']
              if (typeof v === 'string' && v.trim()) {
                label = v
              }
            }
            const resolvedLabel =
              label || defKey.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())

            const newNode = {
              id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              type: defKey,
              label: resolvedLabel,
              x: canvasX,
              y: canvasY,
              config: def.defaultConfig || {},
              inputs: def.inputs || [],
              outputs: def.outputs || [],
              bottomPorts: def.bottomPorts || [],
              category: def.category || 'Services',
              status: 'idle' as const
            }
            dispatch({ type: 'ADD_NODE', payload: newNode })
          } else {
            // Fallback to generic workflow node creation so the action still succeeds
            operations.addNode(nodeType, { x: canvasX, y: canvasY })
          }
        } else {
          // Workflow mode: use standard operations
          operations.addNode(nodeType, { x: canvasX, y: canvasY })
        }
      } else {
        // Fallback to screen coordinates if transform not available
        if (state.designerMode === 'architecture') {
          const alias: Record<string, string> = {
            api: 'rest-api',
            queue: 'message-queue',
            storage: 'database',
            loadbalancer: 'load-balancer'
          }
          const defKey = ArchitectureNodeDefinitions[nodeType]
            ? nodeType
            : (alias[nodeType] ?? nodeType)

          const def: NodeDefinition | undefined = ArchitectureNodeDefinitions[defKey]
          if (def) {
            const cfg = (def.defaultConfig ?? {}) as Record<string, unknown>
            let label: string | undefined
            if ('serviceName' in cfg) {
              const v = cfg['serviceName']
              if (typeof v === 'string' && v.trim()) {
                label = v
              }
            }
            const resolvedLabel =
              label || defKey.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())

            const newNode = {
              id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              type: defKey,
              label: resolvedLabel,
              x: clientX,
              y: clientY,
              config: def.defaultConfig || {},
              inputs: def.inputs || [],
              outputs: def.outputs || [],
              bottomPorts: def.bottomPorts || [],
              category: def.category || 'Services',
              status: 'idle' as const
            }
            dispatch({ type: 'ADD_NODE', payload: newNode })
          } else {
            operations.addNode(nodeType, { x: clientX, y: clientY })
          }
        } else {
          operations.addNode(nodeType, { x: clientX, y: clientY })
        }
      }
    }
  }, [dispatch, svgRef, state.canvasTransform, state.designerMode, operations])

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
    const currentConnectionState = connectionStateRef.current
    if (currentConnectionState.isConnecting && currentConnectionState.connectionStart) {
      dispatch({ type: 'UPDATE_CONNECTION_PREVIEW', payload: { x, y } })
    }
  }, [dispatch])

  // Drag & Drop handlers for connections
  const handlePortDragStart = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    console.warn('🔥 handlePortDragStart called:', { nodeId, portId, portType })

    // Prevent duplicate calls - only allow if not already connecting
    const currentConnectionState = connectionStateRef.current
    if (currentConnectionState.isConnecting) {
      console.warn('⚠️ Already connecting, ignoring duplicate call')
      return
    }

    // Only allow dragging from output ports
    if (portType === 'output') {
      dispatch({ type: 'START_CONNECTION', payload: { nodeId, portId, type: portType } })
      console.warn('✅ Connection started from output port')
    } else {
      console.warn('❌ Cannot start connection from input port')
    }
  }, [dispatch])

  // Use a ref to avoid order/dependency issues with throttled function
  const throttledUpdatePreviewRef = useRef<(x: number, y: number) => void>(() => { })
  const handlePortDrag = useCallback((x: number, y: number) => {
    throttledUpdatePreviewRef.current(x, y)
  }, [])

  const handlePortDragEnd = useCallback((targetNodeId?: string, targetPortId?: string, canvasX?: number, canvasY?: number) => {
    // Get fresh connection state from ref
    const currentConnectionState = connectionStateRef.current

    console.warn('🔥 handlePortDragEnd called:', {
      targetNodeId,
      targetPortId,
      canvasX,
      canvasY,
      isConnecting: currentConnectionState.isConnecting,
      connectionStart: currentConnectionState.connectionStart
    })

    // Guard against multiple calls when not connecting
    if (!currentConnectionState.isConnecting || !currentConnectionState.connectionStart) {
      console.warn('⚠️ Not currently connecting, ignoring call')
      return
    }

    // Handle canvas background drop: disabled auto-create. Simply cancel without creating a node.
    if (targetNodeId === '__CANVAS_DROP__') {
      console.warn('🛑 Canvas background drop detected – auto node creation is disabled. Cancelling connection.')
    }
    // Handle regular port-to-port connections
    else if (targetNodeId && targetPortId) {
      const { nodeId: sourceNodeId, portId: sourcePortId, type } = currentConnectionState.connectionStart

      console.warn('🔗 Attempting to create connection:', {
        sourceNodeId,
        sourcePortId,
        sourceType: type,
        targetNodeId,
        targetPortId
      })

      // Only allow output -> input connections
      if (type === 'output' && sourceNodeId !== targetNodeId) {
        console.warn('✅ Valid connection attempt: output -> input')

        // Use operations for connection creation
        const result = operations.createConnection(sourceNodeId, sourcePortId, targetNodeId, targetPortId)

        if (result) {
          console.warn('✅ Connection created successfully')
        } else {
          console.warn('❌ Connection creation failed')
        }
      } else {
        console.warn('❌ Invalid connection:', {
          reason: type !== 'output' ? 'Not from output port' : 'Same node connection attempt'
        })
      }
    } else {
      console.warn('❌ Missing target information for connection')
    }

    // Clear connection state after drag end
    dispatch({ type: 'CLEAR_CONNECTION_STATE' })
  }, [operations, dispatch])

  // =====================
  // Performance: Throttled preview updates (RAF-based)
  // =====================
  const previewRafIdRef = useRef<number | null>(null)
  const lastPreviewTsRef = useRef<number>(0)
  const pendingPreviewRef = useRef<{ x: number; y: number } | null>(null)
  const lastSentPreviewRef = useRef<{ x: number; y: number } | null>(null)

  // Helper: compute adaptive interval based on graph size
  const getMinIntervalMs = () => {
    const n = nodesCountRef.current
    if (n > 150) { return 24 }
    if (n > 60) { return 16 }
    return 12
  }

  // Dispatch once (guarded by connectionState)
  const dispatchPreview = useCallback((x: number, y: number) => {
    const last = lastSentPreviewRef.current
    if (last && last.x === x && last.y === y) {
      return
    }
    const current = connectionStateRef.current
    if (current.isConnecting) {
      dispatch({ type: 'UPDATE_CONNECTION_PREVIEW', payload: { x, y } })
      lastSentPreviewRef.current = { x, y }
    }
  }, [dispatch])

  // Public API used by handlers
  const throttledUpdatePreview = useCallback((x: number, y: number) => {
    pendingPreviewRef.current = { x, y }

    if (previewRafIdRef.current !== null) {
      return
    }

    previewRafIdRef.current = requestAnimationFrame(() => {
      const now = performance.now()
      const minInterval = getMinIntervalMs()

      // If too soon, schedule next frame to try again with the latest pending
      if (now - lastPreviewTsRef.current < minInterval) {
        previewRafIdRef.current = requestAnimationFrame(() => {
          // Use latest pending on next frame
          const p = pendingPreviewRef.current
          if (p) {
            dispatchPreview(p.x, p.y)
            lastPreviewTsRef.current = performance.now()
          }
          previewRafIdRef.current = null
        })
        return
      }

      const p = pendingPreviewRef.current
      if (p) {
        dispatchPreview(p.x, p.y)
        lastPreviewTsRef.current = now
        pendingPreviewRef.current = null
      }
      previewRafIdRef.current = null
    })
  }, [dispatchPreview])

  // Keep the ref pointing to the latest throttled function
  useEffect(() => {
    throttledUpdatePreviewRef.current = throttledUpdatePreview
  }, [throttledUpdatePreview])

  // Cleanup on connection end/unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (previewRafIdRef.current !== null) {
        cancelAnimationFrame(previewRafIdRef.current)
        previewRafIdRef.current = null
      }
      pendingPreviewRef.current = null
    }
  }, [])

  // When connection completes/cancels, reset preview throttling state
  useEffect(() => {
    if (!state.connectionState.isConnecting) {
      if (previewRafIdRef.current !== null) {
        cancelAnimationFrame(previewRafIdRef.current)
        previewRafIdRef.current = null
      }
      pendingPreviewRef.current = null
    }
  }, [state.connectionState.isConnecting])

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
          console.warn('Copied to clipboard:', clipboardData)
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