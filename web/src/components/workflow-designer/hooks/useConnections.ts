import { useState, useCallback } from 'react'
import type { WorkflowNode } from './useNodeSelection'

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

export interface ConnectionStart {
  nodeId: string
  portId: string
  type: 'input' | 'output'
}

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
  createConnection: (sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string) => boolean
  removeConnection: (connectionId: string) => void
  validateConnection: (sourceNode: WorkflowNode, sourcePortId: string, targetNode: WorkflowNode, targetPortId: string) => boolean
  getConnectionsForNode: (nodeId: string) => Connection[]
  clearConnectionState: () => void
}

export function useConnections({
  nodes
}: UseConnectionsProps): UseConnectionsReturn {
  
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStart, setConnectionStart] = useState<ConnectionStart | null>(null)
  const [connectionPreview, setConnectionPreview] = useState<{ x: number; y: number } | null>(null)

  const validateConnection = useCallback((
    sourceNode: WorkflowNode,
    sourcePortId: string,
    targetNode: WorkflowNode,
    targetPortId: string
  ): boolean => {
    // Basic validation rules
    if (sourceNode.id === targetNode.id) {
      return false // Can't connect to self
    }

    // Check if connection already exists
    const existingConnection = connections.find(c =>
      c.sourceNodeId === sourceNode.id &&
      c.sourcePortId === sourcePortId &&
      c.targetNodeId === targetNode.id &&
      c.targetPortId === targetPortId
    )

    if (existingConnection) {
      return false // Connection already exists
    }

    // Check if target port is already connected (inputs should be unique)
    const targetPortConnected = connections.some(c =>
      c.targetNodeId === targetNode.id && c.targetPortId === targetPortId
    )

    if (targetPortConnected) {
      return false // Target port already connected
    }

    // Find the actual ports to validate data types
    const sourcePort = sourceNode.outputs.find(p => p.id === sourcePortId)
    const targetPort = targetNode.inputs.find(p => p.id === targetPortId)

    if (!sourcePort || !targetPort) {
      return false // Ports not found
    }

    // Data type compatibility check (simplified)
    if (sourcePort.dataType !== 'any' && targetPort.dataType !== 'any') {
      if (sourcePort.dataType !== targetPort.dataType) {
        return false // Incompatible data types
      }
    }

    return true
  }, [connections])

  const createConnection = useCallback((
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ): boolean => {
    const sourceNode = nodes.find(n => n.id === sourceNodeId)
    const targetNode = nodes.find(n => n.id === targetNodeId)

    if (!sourceNode || !targetNode) {
      console.warn('Source or target node not found')
      return false
    }

    if (!validateConnection(sourceNode, sourcePortId, targetNode, targetPortId)) {
      console.warn('Invalid connection')
      return false
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
    return true
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
    setConnectionPreview(null)
  }, [])

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
    clearConnectionState
  }
}