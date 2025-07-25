import { useState, useCallback } from 'react'
import type { WorkflowNode } from './useNodeSelection'

export interface DragState {
  isGroupDragging: boolean
  dragOffset: Map<string, { x: number; y: number }>
}

export interface UseDragOperationsProps {
  nodes: WorkflowNode[]
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>
  selectedNodes: Set<string>
  isNodeSelected: (nodeId: string) => boolean
  getSelectedNodesList: () => WorkflowNode[]
}

export interface UseDragOperationsReturn {
  // State
  isGroupDragging: boolean
  dragOffset: Map<string, { x: number; y: number }>
  
  // Setters
  setIsGroupDragging: (dragging: boolean) => void
  setDragOffset: (offset: Map<string, { x: number; y: number }>) => void
  
  // Operations
  calculateGroupDragOffsets: (primaryNodeId: string) => Map<string, { x: number; y: number }>
  updateGroupPositions: (primaryNodeId: string, newX: number, newY: number, offsets: Map<string, { x: number; y: number }>) => void
  updateSingleNodePosition: (nodeId: string, x: number, y: number) => void
  resetDragState: () => void
}

export function useDragOperations({
  nodes,
  setNodes,
  selectedNodes,
  isNodeSelected,
  getSelectedNodesList
}: UseDragOperationsProps): UseDragOperationsReturn {
  
  const [isGroupDragging, setIsGroupDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Map<string, { x: number; y: number }>>(new Map())

  const calculateGroupDragOffsets = useCallback((primaryNodeId: string) => {
    const offsets = new Map<string, { x: number; y: number }>()
    const primaryNode = nodes.find(n => n.id === primaryNodeId)
    
    if (!primaryNode) return offsets

    getSelectedNodesList().forEach(node => {
      if (node.id !== primaryNodeId) {
        offsets.set(node.id, {
          x: node.x - primaryNode.x,
          y: node.y - primaryNode.y
        })
      }
    })

    return offsets
  }, [nodes, getSelectedNodesList])

  const updateGroupPositions = useCallback((
    primaryNodeId: string,
    newX: number,
    newY: number,
    offsets: Map<string, { x: number; y: number }>
  ) => {
    setNodes(prev => prev.map(node => {
      if (node.id === primaryNodeId) {
        return { ...node, x: newX, y: newY }
      } else if (isNodeSelected(node.id) && offsets.has(node.id)) {
        const offset = offsets.get(node.id)!
        return { ...node, x: newX + offset.x, y: newY + offset.y }
      }
      return node
    }))
  }, [setNodes, isNodeSelected])

  const updateSingleNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, x, y } : node
    ))
  }, [setNodes])

  const resetDragState = useCallback(() => {
    setIsGroupDragging(false)
    setDragOffset(new Map())
  }, [])

  return {
    // State
    isGroupDragging,
    dragOffset,
    
    // Setters
    setIsGroupDragging,
    setDragOffset,
    
    // Operations
    calculateGroupDragOffsets,
    updateGroupPositions,
    updateSingleNodePosition,
    resetDragState
  }
}