import { useCallback, useMemo, useRef } from 'react'
import type { Connection, NodeVariant, WorkflowNode } from '../types'
import { generateModeAwareConnectionPath } from '../utils/connection-utils'
import { PERFORMANCE_CONSTANTS } from '../utils/canvas-constants'

type DragPos = { x: number; y: number }

export interface UseConnectionPathsApi {
  getConnectionPath: (connection: Connection, useDragPositions?: boolean) => string
  updateDragPosition: (nodeId: string, pos: DragPos) => void
  clearDragPosition: (nodeId: string) => void
  clearAllDragPositions: () => void
  clearCache: () => void
}

/**
 * useConnectionPaths
 * Centralizes path generation with lightweight caching and drag overrides.
 * - Workflow mode: bezier-like paths
 * - Architecture mode: orthogonal rounded paths
 */
export function useConnectionPaths(
  nodes: WorkflowNode[],
  nodeVariant: NodeVariant,
  modeId: 'workflow' | 'architecture' | undefined
): UseConnectionPathsApi {
  const pathCacheRef = useRef<Map<string, string>>(new Map())
  const dragPositionsRef = useRef<Map<string, DragPos>>(new Map())

  const nodeMap = useMemo(() => {
    const m = new Map<string, WorkflowNode>()
    nodes.forEach((n) => m.set(n.id, n))
    return m
  }, [nodes])

  const clearCache = useCallback(() => {
    pathCacheRef.current.clear()
  }, [])

  const updateDragPosition = useCallback((nodeId: string, pos: DragPos) => {
    dragPositionsRef.current.set(nodeId, pos)
  }, [])

  const clearDragPosition = useCallback((nodeId: string) => {
    dragPositionsRef.current.delete(nodeId)
  }, [])

  const clearAllDragPositions = useCallback(() => {
    dragPositionsRef.current.clear()
  }, [])

  const cleanupCacheIfNeeded = useCallback(() => {
    const cache = pathCacheRef.current
    const size = cache.size
    const MAX_CACHE_SIZE = PERFORMANCE_CONSTANTS.MAX_CACHE_SIZE
    const CACHE_CLEANUP_THRESHOLD = PERFORMANCE_CONSTANTS.CACHE_CLEANUP_THRESHOLD
    if (size <= MAX_CACHE_SIZE) return

    // Probabilistic pruning
    const overBy = size - MAX_CACHE_SIZE
    const pressureRatio = Math.min(1, overBy / (MAX_CACHE_SIZE * 0.5))
    const baseSample = 0.02 + pressureRatio * 0.08 // 2%-10%
    const softTarget = Math.floor(MAX_CACHE_SIZE * 0.95)
    let removed = 0
    for (const key of cache.keys()) {
      if (cache.size <= softTarget) break
      if (Math.random() < baseSample) {
        cache.delete(key)
        removed++
      }
    }
    if (cache.size > CACHE_CLEANUP_THRESHOLD) {
      const toRemove = cache.size - CACHE_CLEANUP_THRESHOLD
      let i = 0
      for (const key of cache.keys()) {
        cache.delete(key)
        i++
        if (i >= toRemove) break
      }
    }
    if (removed > 0 && process.env.NODE_ENV === 'development') {
      console.debug('[useConnectionPaths] cache pruned by', removed)
    }
  }, [])

  const getConnectionPath = useCallback(
    (connection: Connection, useDragPositions = false): string => {
      const cacheKey = `${connection.id}-${connection.sourceNodeId}-${connection.sourcePortId}-${connection.targetNodeId}-${connection.targetPortId}-${nodeVariant}${useDragPositions ? '-drag' : ''}`

      if (!useDragPositions) {
        const cached = pathCacheRef.current.get(cacheKey)
        if (cached) return cached
      }

      const sourceNode = nodeMap.get(connection.sourceNodeId)
      const targetNode = nodeMap.get(connection.targetNodeId)
      if (!sourceNode || !targetNode) return ''

      let nodesForPath = nodes
      if (useDragPositions) {
        const srcDrag = dragPositionsRef.current.get(connection.sourceNodeId)
        const tgtDrag = dragPositionsRef.current.get(connection.targetNodeId)
        if (srcDrag || tgtDrag) {
          nodesForPath = nodes.map((n) => {
            if (srcDrag && n.id === connection.sourceNodeId) {
              return { ...n, x: srcDrag.x, y: srcDrag.y }
            }
            if (tgtDrag && n.id === connection.targetNodeId) {
              return { ...n, x: tgtDrag.x, y: tgtDrag.y }
            }
            return n
          })
        }
      }

      const path = generateModeAwareConnectionPath(
        {
          sourceNodeId: connection.sourceNodeId,
          sourcePortId: connection.sourcePortId,
          targetNodeId: connection.targetNodeId,
          targetPortId: connection.targetPortId,
        },
        nodesForPath,
  nodeVariant,
  modeId || 'workflow'
      )

      if (!useDragPositions) {
        pathCacheRef.current.set(cacheKey, path)
        cleanupCacheIfNeeded()
      }
      return path
    },
    [nodeMap, nodeVariant, modeId, nodes, cleanupCacheIfNeeded]
  )

  return {
    getConnectionPath,
    updateDragPosition,
    clearDragPosition,
    clearAllDragPositions,
    clearCache,
  }
}

export default useConnectionPaths
