/**
 * Visual State Manager
 * Handles batched visual updates, drag positioning, and node styling for performance optimization
 */

import * as d3 from 'd3'
import type { WorkflowNode, Connection } from '../types'
import { getNodeColor } from './node-utils'

// D3 selection type aliases to avoid 'any' usage
type LayerSelection = d3.Selection<SVGGElement, unknown, null, undefined>
type NodeElementSelection = d3.Selection<SVGGElement, unknown, null, undefined>

// Adaptive performance configuration interfaces
interface AdaptiveConfig {
    vBudget: number
    lastDuration: number
}

interface ConnectionAdaptiveConfig {
    cBudget: number
    lastDuration: number
}

// Window globals for adaptive performance
declare global {
    interface Window {
        __wfAdaptive?: AdaptiveConfig
        __wfConnAdaptive?: ConnectionAdaptiveConfig
    }
}

// Configuration objects for complex functions
export interface DragPositionConfig {
    draggedElement: NodeElementSelection | null
    currentDragPositions: Map<string, { x: number; y: number }>
    updateConnDragPos: (nodeId: string, pos: { x: number; y: number }) => void
    nodeConnectionsMap: Map<string, Connection[]>
    connectionUpdateQueue: Set<string>
    lastDragUpdate: { current: number }
    dragUpdateThrottle: number
    startBatchedConnectionUpdates: () => void
}

export interface VisualCacheConfig {
    nodePositionCache: Map<string, { x: number; y: number }>
    currentDragPositions: Map<string, { x: number; y: number }>
    connectionUpdateQueue: Set<string>
    visualUpdateQueue: Set<string>
    clearConnCache: () => void
    clearAllDragPositions: () => void
    zIndexManager: { clearState: () => void }
    rafScheduler: { clear: () => void }
    batchedConnectionUpdateRef: React.MutableRefObject<number | null>
    batchedVisualUpdateRef: React.MutableRefObject<number | null>
}

/**
 * Processes batched visual updates for nodes with adaptive performance management
 */
export function processBatchedVisualUpdates(
    visualUpdateQueue: Set<string>,
    allNodeElements: Map<string, SVGGElement>,
    onComplete: () => void
): boolean {
    if (visualUpdateQueue.size === 0) {
        return false
    }

    const start = performance.now()

    // Initialize adaptive config if not present (using nullish coalescing)
    window.__wfAdaptive ??= { vBudget: 4, lastDuration: 0 }

    const adaptive = window.__wfAdaptive
    const MAX_MS = adaptive.vBudget

    for (const nodeId of Array.from(visualUpdateQueue)) {
        if (performance.now() - start > MAX_MS) {
            break
        }

        const element = allNodeElements.get(nodeId)
        if (!element) {
            visualUpdateQueue.delete(nodeId)
            continue
        }

        const nodeElement = d3.select(element)
        const nodeBackground = nodeElement.select('.node-background')

        nodeElement
            .style('opacity', 0.9)
            .style('filter', 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))')

        nodeBackground
            .attr('stroke', '#2196F3')
            .attr('stroke-width', 3)

        visualUpdateQueue.delete(nodeId)
    }

    // Update adaptive performance config
    const duration = performance.now() - start
    adaptive.lastDuration = duration
    const usage = duration / MAX_MS

    if (usage < 0.6 && adaptive.vBudget < 6) {
        adaptive.vBudget += 0.25
    } else if (usage > 0.9 && adaptive.vBudget > 2) {
        adaptive.vBudget -= 0.25
    }

    // Return true if more processing needed
    const hasMore = visualUpdateQueue.size > 0
    if (!hasMore) {
        onComplete()
    }

    return hasMore
}

/**
 * Processes batched connection updates with adaptive performance management
 */
export function processBatchedConnectionUpdates(
    connectionUpdateQueue: Set<string>,
    nodeConnectionsMap: Map<string, Connection[]>,
    connectionLayer: LayerSelection,
    getConnectionPath: (conn: Connection, useDragPositions?: boolean) => string,
    onComplete: () => void
): boolean {
    if (connectionUpdateQueue.size === 0) {
        return false
    }

    // PERFORMANCE: Use cached DOM selections to avoid repeated queries
    if (!connectionLayer) {
        return false
    }

    // PERFORMANCE: Optimized batching - process more items but with time slicing
    const nodesToProcess = Array.from(connectionUpdateQueue)
    const startTime = performance.now()

    // Initialize adaptive config if not present (using nullish coalescing)
    window.__wfConnAdaptive ??= { cBudget: 8, lastDuration: 0 }

    const connAdaptive = window.__wfConnAdaptive
    const maxProcessingTime = connAdaptive.cBudget

    for (const nodeId of nodesToProcess) {
        // Time-slice processing to avoid blocking main thread
        if (performance.now() - startTime > maxProcessingTime) {
            break
        }

        const affectedConnections = nodeConnectionsMap.get(nodeId) || []
        if (affectedConnections.length === 0) {
            connectionUpdateQueue.delete(nodeId)
            continue
        }

        // PERFORMANCE: Batch DOM operations together
        const connectionElements = affectedConnections
            .map((conn) => ({
                conn,
                element: connectionLayer.select(`[data-connection-id="${conn.id}"]`),
            }))
            .filter(({ element }) => !element.empty())

        // Update all paths in a single batch
        connectionElements.forEach(({ conn, element }) => {
            const pathElement = element.select('.connection-path')
            const newPath = getConnectionPath(conn, true)
            pathElement.attr('d', newPath)
        })

        connectionUpdateQueue.delete(nodeId)
    }

    // Update adaptive performance config
    const duration = performance.now() - startTime
    connAdaptive.lastDuration = duration
    const usage = duration / maxProcessingTime

    if (usage < 0.55 && connAdaptive.cBudget < 10) {
        connAdaptive.cBudget += 0.5
    } else if (usage > 0.9 && connAdaptive.cBudget > 4) {
        connAdaptive.cBudget -= 0.5
    }

    // Return true if more processing needed
    const hasMore = connectionUpdateQueue.size > 0
    if (!hasMore) {
        onComplete()
    }

    return hasMore
}

/**
 * Updates dragged node position with immediate visual feedback and batched connection updates
 */
export function updateDraggedNodePosition(
    nodeId: string,
    newX: number,
    newY: number,
    config: DragPositionConfig
): void {
    // Always update node position immediately for smooth dragging
    if (config.draggedElement) {
        config.draggedElement.attr('transform', `translate(${newX}, ${newY})`)
    }

    // Store current drag position
    config.currentDragPositions.set(nodeId, { x: newX, y: newY })
    // Sync with connection paths hook for live path updates during drag
    config.updateConnDragPos(nodeId, { x: newX, y: newY })

    // Throttle connection updates to improve performance
    const now = Date.now()
    if (now - config.lastDragUpdate.current < config.dragUpdateThrottle) {
        return
    }
    config.lastDragUpdate.current = now

    // Queue connection updates for batched processing
    const affectedConnections = config.nodeConnectionsMap.get(nodeId) || []
    if (affectedConnections.length > 0) {
        config.connectionUpdateQueue.add(nodeId)
        config.startBatchedConnectionUpdates()
    }
}

/**
 * Resets node visual style based on selection state
 */
export function resetNodeVisualStyle(
    nodeElement: NodeElementSelection,
    nodeId: string,
    isNodeSelected: (nodeId: string) => boolean,
    nodeMap: Map<string, WorkflowNode>
): void {
    const isSelected = isNodeSelected(nodeId)
    const nodeBackground = nodeElement.select('.node-background')
    const node = nodeMap.get(nodeId)

    if (isSelected) {
        nodeElement
            .style('opacity', 1)
            .style('filter', 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))')
        nodeBackground
            .attr('stroke', '#2196F3')
            .attr('stroke-width', 3)
    } else {
        nodeElement
            .style('opacity', 1)
            .style('filter', 'none')

        if (node) {
            nodeBackground
                .attr('stroke', getNodeColor(node.type, node.status))
                .attr('stroke-width', 2)
        }
    }
}

/**
 * Clears all visual state caches and queues
 */
export function clearAllVisualCaches(config: VisualCacheConfig): void {
    // Clear connection path cache in hook
    config.clearConnCache()
    config.nodePositionCache.clear()
    config.currentDragPositions.clear()
    config.clearAllDragPositions()
    config.connectionUpdateQueue.clear()
    config.visualUpdateQueue.clear()
    config.zIndexManager.clearState()
    config.rafScheduler.clear()

    if (config.batchedConnectionUpdateRef.current) {
        cancelAnimationFrame(config.batchedConnectionUpdateRef.current)
        config.batchedConnectionUpdateRef.current = null
    }

    if (config.batchedVisualUpdateRef.current) {
        cancelAnimationFrame(config.batchedVisualUpdateRef.current)
        config.batchedVisualUpdateRef.current = null
    }
}
