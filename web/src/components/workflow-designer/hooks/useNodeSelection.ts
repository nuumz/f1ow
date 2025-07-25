import { useState, useCallback } from 'react'

export interface WorkflowNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  width?: number
  height?: number
  config: any
  inputs: any[]
  outputs: any[]
  status?: 'idle' | 'running' | 'completed' | 'error' | 'warning'
  data?: any
  locked?: boolean
  selected?: boolean
  group?: string
  metadata?: {
    description?: string
    version?: string
    author?: string
    tags?: string[]
  }
}

export interface UseNodeSelectionProps {
  nodes: WorkflowNode[]
}

export interface UseNodeSelectionReturn {
  // State
  selectedNode: WorkflowNode | null
  selectedNodes: Set<string>
  isMultiSelectMode: boolean
  
  // Setters
  setSelectedNode: (node: WorkflowNode | null) => void
  setSelectedNodes: (nodes: Set<string>) => void
  setIsMultiSelectMode: (enabled: boolean) => void
  
  // Operations
  isNodeSelected: (nodeId: string) => boolean
  toggleNodeSelection: (nodeId: string, ctrlKey?: boolean) => void
  clearSelection: () => void
  selectNodesInArea: (minX: number, maxX: number, minY: number, maxY: number) => void
  getSelectedNodesList: () => WorkflowNode[]
  selectAllNodes: () => void
}

export function useNodeSelection({
  nodes
}: UseNodeSelectionProps): UseNodeSelectionReturn {
  
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  const isNodeSelected = useCallback((nodeId: string) => {
    return selectedNodes.has(nodeId) || selectedNode?.id === nodeId
  }, [selectedNodes, selectedNode])

  const toggleNodeSelection = useCallback((nodeId: string, ctrlKey: boolean = false) => {
    if (ctrlKey || isMultiSelectMode) {
      setSelectedNodes(prev => {
        const newSet = new Set(prev)
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId)
        } else {
          newSet.add(nodeId)
        }
        return newSet
      })
      // Keep selectedNode for backwards compatibility
      const node = nodes.find(n => n.id === nodeId)
      if (node && !selectedNodes.has(nodeId)) {
        setSelectedNode(node)
      }
    } else {
      // Single select mode
      setSelectedNodes(new Set([nodeId]))
      setSelectedNode(nodes.find(n => n.id === nodeId) || null)
    }
  }, [isMultiSelectMode, selectedNodes, nodes])

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Set())
    setSelectedNode(null)
  }, [])

  const selectNodesInArea = useCallback((minX: number, maxX: number, minY: number, maxY: number) => {
    const nodesInArea = nodes.filter(node => {
      return node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY
    })

    const nodeIds = new Set(nodesInArea.map(n => n.id))
    setSelectedNodes(nodeIds)
    
    if (nodesInArea.length > 0) {
      setSelectedNode(nodesInArea[0])
    }
  }, [nodes])

  const getSelectedNodesList = useCallback(() => {
    return nodes.filter(node => isNodeSelected(node.id))
  }, [nodes, isNodeSelected])

  const selectAllNodes = useCallback(() => {
    const allNodeIds = new Set(nodes.map(n => n.id))
    setSelectedNodes(allNodeIds)
    if (nodes.length > 0) {
      setSelectedNode(nodes[0])
    }
  }, [nodes])

  return {
    // State
    selectedNode,
    selectedNodes,
    isMultiSelectMode,
    
    // Setters
    setSelectedNode,
    setSelectedNodes,
    setIsMultiSelectMode,
    
    // Operations
    isNodeSelected,
    toggleNodeSelection,
    clearSelection,
    selectNodesInArea,
    getSelectedNodesList,
    selectAllNodes
  }
}