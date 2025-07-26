import { useState, useCallback } from 'react'
import type { WorkflowNode } from '../types'

export type { WorkflowNode } from '../types' // Re-export for backward compatibility

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
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    if (ctrlKey || isMultiSelectMode) {
      // Multi-select mode
      setSelectedNodes(prev => {
        const newSet = new Set(prev)
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId)
          // If removing the current selectedNode, pick another one or clear it
          if (selectedNode?.id === nodeId) {
            const remainingIds = Array.from(newSet)
            if (remainingIds.length > 0) {
              const nextNode = nodes.find(n => n.id === remainingIds[0])
              setSelectedNode(nextNode || null)
            } else {
              setSelectedNode(null)
            }
          }
        } else {
          newSet.add(nodeId)
          setSelectedNode(node) // Set as primary selected node
        }
        return newSet
      })
    } else {
      // Single select mode - clear previous selections
      setSelectedNodes(new Set([nodeId]))
      setSelectedNode(node)
    }
  }, [isMultiSelectMode, selectedNode, nodes])

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