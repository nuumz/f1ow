import { useState, useCallback, useRef } from 'react'
import type { WorkflowNode, Connection, ConnectionStart } from '../types'

export type { Connection, ConnectionStart } from '../types' // Re-export for backward compatibility

export interface UseConnectionsProps {
  nodes: WorkflowNode[]
}

export interface UseConnectionsReturn {
  // State
  connections: Connection[]
  selectedConnection: Connection | null
  isConnecting: boolean
  connectionStart: ConnectionStart | null
  connectionPreview: { x: number; y: number } | null
  
  // Setters
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>
  setSelectedConnection: (connection: Connection | null) => void
  setIsConnecting: (connecting: boolean) => void
  setConnectionStart: (start: ConnectionStart | null) => void
  setConnectionPreview: (preview: { x: number; y: number } | null) => void
  
  // Operations
  createConnection: (sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string) => { success: boolean; reason?: string }
  removeConnection: (connectionId: string) => void
  validateConnection: (sourceNode: WorkflowNode, sourcePortId: string, targetNode: WorkflowNode, targetPortId: string) => { valid: boolean; reason?: string }
  getConnectionsForNode: (nodeId: string) => Connection[]
  clearConnectionState: () => void
  
  // Drag & Drop operations
  startDragConnection: (nodeId: string, portId: string, type: 'input' | 'output') => void
  updateConnectionPreview: (x: number, y: number) => void
  finishDragConnection: (targetNodeId?: string, targetPortId?: string) => boolean
  canDropOnPort: (targetNodeId: string, targetPortId: string) => boolean
  canDropOnNode: (targetNodeId: string) => boolean
}

export function useConnections({
  nodes
}: UseConnectionsProps): UseConnectionsReturn {
  
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStart, setConnectionStart] = useState<ConnectionStart | null>(null)
  const [connectionPreview, setConnectionPreview] = useState<{ x: number; y: number } | null>(null)
  
  // Use ref to store current connection start for immediate access
  const connectionStartRef = useRef<ConnectionStart | null>(null)

  const validateConnection = useCallback((
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string
  ): { valid: boolean; reason?: string } => {

    // Basic validation rules
    if (sourceNode.id === targetNode.id) {
      return { valid: false, reason: 'Cannot connect to self' }
    }

    // Check if exact same connection already exists
    const existingConnection = connections.find(c =>
      c.sourceNodeId === sourceNode.id &&
      c.sourcePortId === sourcePortId &&
      c.targetNodeId === targetNode.id &&
      c.targetPortId === targetPortId
    )

    if (existingConnection) {
      return { valid: false, reason: 'Connection already exists' }
    }

    // Check if target port is already connected (inputs should be unique)
    const targetPortConnected = connections.find(c =>
      c.targetNodeId === targetNode.id && c.targetPortId === targetPortId
    )

    if (targetPortConnected) {
      return { valid: false, reason: `Input port already connected to ${targetPortConnected.sourceNodeId}` }
    }

    // Allow multiple connections with same port types between different nodes
    // Only prevent exact same connection (same source AND target nodes)

    // Find the actual ports to validate data types
    const sourcePort = sourceNode.outputs.find(p => p.id === sourcePortId)
    const targetPort = targetNode.inputs.find(p => p.id === targetPortId)

    if (!sourcePort || !targetPort) {
      return { valid: false, reason: 'Ports not found' }
    }

    // Data type compatibility check (simplified)
    if (sourcePort.dataType !== 'any' && targetPort.dataType !== 'any') {
      if (sourcePort.dataType !== targetPort.dataType) {
        return { valid: false, reason: `Incompatible data types: ${sourcePort.dataType} → ${targetPort.dataType}` }
      }
    }

    return { valid: true }
  }, [connections])

  const createConnection = useCallback((
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ): { success: boolean; reason?: string } => {
    const sourceNode = nodes.find(n => n.id === sourceNodeId)
    const targetNode = nodes.find(n => n.id === targetNodeId)

    if (!sourceNode || !targetNode) {
      console.warn('Source or target node not found')
      return { success: false, reason: 'Node not found' }
    }

    const validation = validateConnection(sourceNode, sourcePortId, targetNode, targetPortId)
    if (!validation.valid) {
      console.warn('Invalid connection:', validation.reason)
      return { success: false, reason: validation.reason }
    }

    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
      validated: true
    }

    setConnections(prev => [...prev, newConnection])
    return { success: true }
  }, [nodes, validateConnection])

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connectionId))
    if (selectedConnection?.id === connectionId) {
      setSelectedConnection(null)
    }
  }, [selectedConnection])

  const getConnectionsForNode = useCallback((nodeId: string) => {
    return connections.filter(c => 
      c.sourceNodeId === nodeId || c.targetNodeId === nodeId
    )
  }, [connections])

  const clearConnectionState = useCallback(() => {
    setIsConnecting(false)
    setConnectionStart(null)
    connectionStartRef.current = null
    setConnectionPreview(null)
  }, [])

  // Drag & Drop operations
  const startDragConnection = useCallback((nodeId: string, portId: string, type: 'input' | 'output') => {
    const connectionData = { nodeId, portId, type }
    setIsConnecting(true)
    setConnectionStart(connectionData)
    connectionStartRef.current = connectionData
    // ไม่ตั้ง preview เป็น null เพื่อให้เส้นสีฟ้าแสดงได้ทันที
    // setConnectionPreview จะถูกเรียกใน updateConnectionPreview
  }, [])

  const updateConnectionPreview = useCallback((x: number, y: number) => {
    // เช็คทั้ง state และ ref เพื่อความแม่นยำ
    if (isConnecting || connectionStartRef.current) {
      setConnectionPreview({ x, y })
    }
  }, [isConnecting])

  const finishDragConnection = useCallback((targetNodeId?: string, targetPortId?: string) => {
    const currentConnectionStart = connectionStartRef.current
    
    if (!currentConnectionStart || !targetNodeId || !targetPortId) {
      clearConnectionState()
      return false
    }

    // Only allow output -> input connections
    if (currentConnectionStart.type === 'output') {
      const result = createConnection(
        currentConnectionStart.nodeId,
        currentConnectionStart.portId,
        targetNodeId,
        targetPortId
      )
      
      if (!result.success && result.reason) {
        // Show user-friendly error message - could show toast notification here
      }
      
      clearConnectionState()
      return result.success
    }

    clearConnectionState()
    return false
  }, [createConnection, clearConnectionState])

  // Check if we can drop on a specific port
  const canDropOnPort = useCallback((targetNodeId: string, targetPortId: string) => {
    const currentConnectionStart = connectionStartRef.current
    if (!currentConnectionStart || currentConnectionStart.type !== 'output') {
      return false
    }

    const sourceNode = nodes.find(n => n.id === currentConnectionStart.nodeId)
    const targetNode = nodes.find(n => n.id === targetNodeId)
    
    if (!sourceNode || !targetNode) {
      return false
    }

    const validation = validateConnection(sourceNode, currentConnectionStart.portId, targetNode, targetPortId)
    return validation.valid
  }, [nodes, validateConnection])

  // Check if we can drop on any input port of a node
  const canDropOnNode = useCallback((targetNodeId: string) => {
    const currentConnectionStart = connectionStartRef.current
    if (!currentConnectionStart || currentConnectionStart.type !== 'output') {
      return false
    }

    const targetNode = nodes.find(n => n.id === targetNodeId)
    if (!targetNode || !targetNode.inputs) {
      return false
    }

    // Check if any input port of this node can accept the connection
    return targetNode.inputs.some(inputPort => 
      canDropOnPort(targetNodeId, inputPort.id)
    )
  }, [nodes, canDropOnPort])

  return {
    // State
    connections,
    selectedConnection,
    isConnecting,
    connectionStart,
    connectionPreview,
    
    // Setters
    setConnections,
    setSelectedConnection,
    setIsConnecting,
    setConnectionStart,
    setConnectionPreview,
    
    // Operations
    createConnection,
    removeConnection,
    validateConnection,
    getConnectionsForNode,
    clearConnectionState,
    
    // Drag & Drop operations
    startDragConnection,
    updateConnectionPreview,
    finishDragConnection,
    canDropOnPort,
    canDropOnNode
  }
}