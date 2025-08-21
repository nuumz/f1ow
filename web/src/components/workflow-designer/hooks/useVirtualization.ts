/**
 * Virtualization hook for large workflows
 * Optimizes rendering performance by only rendering visible nodes and connections
 */

import { useMemo } from 'react';
import type { WorkflowNode, Connection, CanvasTransform } from '../types';

interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

interface VirtualizationConfig {
  bufferSize: number; // Extra area to render outside viewport
  minNodesForVirtualization: number; // Minimum nodes before virtualization kicks in
  gridSize: number; // Grid size for spatial indexing
}

interface VirtualizedResult {
  visibleNodes: WorkflowNode[];
  visibleConnections: Connection[];
  totalNodes: number;
  totalConnections: number;
  renderMetrics: {
    nodesRendered: number;
    nodesSkipped: number;
    connectionsRendered: number;
    connectionsSkipped: number;
    virtualizationActive: boolean;
  };
}

const DEFAULT_CONFIG: VirtualizationConfig = {
  bufferSize: 300,
  minNodesForVirtualization: 50,
  gridSize: 500,
};

/**
 * Virtualization hook for large workflows
 * Uses spatial indexing and viewport culling to optimize rendering
 */
export function useVirtualization(
  nodes: WorkflowNode[],
  connections: Connection[],
  canvasTransform: CanvasTransform,
  viewport: ViewportBounds,
  config: Partial<VirtualizationConfig> = {}
): VirtualizedResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return useMemo(() => {
    const shouldVirtualize = nodes.length >= finalConfig.minNodesForVirtualization;
    
    if (!shouldVirtualize) {
      return {
        visibleNodes: nodes,
        visibleConnections: connections,
        totalNodes: nodes.length,
        totalConnections: connections.length,
        renderMetrics: {
          nodesRendered: nodes.length,
          nodesSkipped: 0,
          connectionsRendered: connections.length,
          connectionsSkipped: 0,
          virtualizationActive: false,
        },
      };
    }

    // Calculate viewport bounds with buffer
    const buffer = finalConfig.bufferSize / viewport.scale;
    const viewBounds = {
      left: viewport.x - buffer,
      right: viewport.x + viewport.width + buffer,
      top: viewport.y - buffer,
      bottom: viewport.y + viewport.height + buffer,
    };

    // Filter visible nodes
    const visibleNodes = nodes.filter(node => {
      const nodeWidth = node.width || 200;
      const nodeHeight = node.height || 100;
      
      return !(
        node.x + nodeWidth < viewBounds.left ||
        node.x > viewBounds.right ||
        node.y + nodeHeight < viewBounds.top ||
        node.y > viewBounds.bottom
      );
    });

    // Create a set of visible node IDs for fast lookup
    const visibleNodeIds = new Set(visibleNodes.map(node => node.id));

    // Filter connections that connect visible nodes
    const visibleConnections = connections.filter(connection => {
      return visibleNodeIds.has(connection.sourceNodeId) && 
             visibleNodeIds.has(connection.targetNodeId);
    });

    return {
      visibleNodes,
      visibleConnections,
      totalNodes: nodes.length,
      totalConnections: connections.length,
      renderMetrics: {
        nodesRendered: visibleNodes.length,
        nodesSkipped: nodes.length - visibleNodes.length,
        connectionsRendered: visibleConnections.length,
        connectionsSkipped: connections.length - visibleConnections.length,
        virtualizationActive: true,
      },
    };
  }, [nodes, connections, viewport, finalConfig, canvasTransform]);
}

/**
 * Spatial indexing hook for very large workflows (1000+ nodes)
 * Uses grid-based spatial indexing for faster viewport queries
 */
export function useSpatialIndex(
  nodes: WorkflowNode[],
  gridSize = 500
) {
  return useMemo(() => {
    const spatialIndex = new Map<string, WorkflowNode[]>();

    nodes.forEach(node => {
      const gridX = Math.floor(node.x / gridSize);
      const gridY = Math.floor(node.y / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!spatialIndex.has(key)) {
        spatialIndex.set(key, []);
      }
      spatialIndex.get(key)!.push(node);
    });

    const getNodesInBounds = (bounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }): WorkflowNode[] => {
      const startGridX = Math.floor(bounds.left / gridSize);
      const endGridX = Math.ceil(bounds.right / gridSize);
      const startGridY = Math.floor(bounds.top / gridSize);
      const endGridY = Math.ceil(bounds.bottom / gridSize);

      const result: WorkflowNode[] = [];
      
      for (let gridX = startGridX; gridX <= endGridX; gridX++) {
        for (let gridY = startGridY; gridY <= endGridY; gridY++) {
          const key = `${gridX},${gridY}`;
          const gridNodes = spatialIndex.get(key);
          if (gridNodes) {
            // Further filter by exact bounds
            const filteredNodes = gridNodes.filter(node => {
              const nodeWidth = node.width || 200;
              const nodeHeight = node.height || 100;
              
              return !(
                node.x + nodeWidth < bounds.left ||
                node.x > bounds.right ||
                node.y + nodeHeight < bounds.top ||
                node.y > bounds.bottom
              );
            });
            result.push(...filteredNodes);
          }
        }
      }

      return result;
    };

    return {
      spatialIndex,
      getNodesInBounds,
      gridCount: spatialIndex.size,
      averageNodesPerGrid: nodes.length / spatialIndex.size,
    };
  }, [nodes, gridSize]);
}

/**
 * Level-of-detail hook for performance optimization
 * Reduces rendering detail based on zoom level
 */
export function useLevelOfDetail(
  nodes: WorkflowNode[],
  zoomLevel: number,
  config: {
    lowDetailThreshold: number; // Below this zoom, use low detail
    hidePortsThreshold: number; // Below this zoom, hide ports
    hideLabelsThreshold: number; // Below this zoom, hide labels
  } = {
    lowDetailThreshold: 0.5,
    hidePortsThreshold: 0.3,
    hideLabelsThreshold: 0.2,
  }
) {
  return useMemo(() => {
    const showPorts = zoomLevel > config.hidePortsThreshold;
    const showLabels = zoomLevel > config.hideLabelsThreshold;
    const useHighDetail = zoomLevel > config.lowDetailThreshold;

    // Simplify nodes for low zoom levels
    const optimizedNodes = useHighDetail 
      ? nodes 
      : nodes.map(node => ({
          ...node,
          // Simplified rendering properties
          inputs: showPorts ? node.inputs : [],
          outputs: showPorts ? node.outputs : [],
          bottomPorts: showPorts ? node.bottomPorts : [],
        }));

    return {
      nodes: optimizedNodes,
      renderConfig: {
        showPorts,
        showLabels,
        useHighDetail,
        simplifiedRendering: !useHighDetail,
      },
    };
  }, [nodes, zoomLevel, config]);
}

/**
 * Performance-aware connection rendering hook
 * Optimizes connection rendering based on viewport and complexity
 */
export function useConnectionOptimization(
  connections: Connection[],
  visibleNodeIds: Set<string>,
  zoomLevel: number,
  complexityThreshold = 100
) {
  return useMemo(() => {
    // Filter connections to only visible nodes
    const relevantConnections = connections.filter(conn => 
      visibleNodeIds.has(conn.sourceNodeId) && visibleNodeIds.has(conn.targetNodeId)
    );

    // For very high connection counts, use simplified rendering
    const useSimplifiedConnections = relevantConnections.length > complexityThreshold || zoomLevel < 0.3;

    // Group connections for batch rendering if needed
    const connectionGroups = useSimplifiedConnections 
      ? groupConnectionsByDirection(relevantConnections)
      : null;

    return {
      connections: relevantConnections,
      useSimplifiedConnections,
      connectionGroups,
      renderMetrics: {
        totalConnections: connections.length,
        visibleConnections: relevantConnections.length,
        simplificationActive: useSimplifiedConnections,
      },
    };
  }, [connections, visibleNodeIds, zoomLevel, complexityThreshold]);
}

/**
 * Helper function to group connections by direction for batch rendering
 */
function groupConnectionsByDirection(connections: Connection[]) {
  const groups = new Map<string, Connection[]>();
  
  connections.forEach(conn => {
    // Group by source-target node pair
    const key = `${conn.sourceNodeId}-${conn.targetNodeId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(conn);
  });

  return groups;
}

/**
 * Master virtualization hook that combines all optimization techniques
 */
export function useWorkflowVirtualization(
  nodes: WorkflowNode[],
  connections: Connection[],
  canvasTransform: CanvasTransform,
  viewport: ViewportBounds,
  config?: {
    virtualization?: Partial<VirtualizationConfig>;
    levelOfDetail?: Parameters<typeof useLevelOfDetail>[2];
    connectionOptimization?: { complexityThreshold?: number };
  }
): VirtualizedResult & {
  levelOfDetail: ReturnType<typeof useLevelOfDetail>;
  connectionOptimization: ReturnType<typeof useConnectionOptimization>;
} {
  const virtualization = useVirtualization(
    nodes, 
    connections, 
    canvasTransform, 
    viewport, 
    config?.virtualization
  );

  const levelOfDetail = useLevelOfDetail(
    virtualization.visibleNodes,
    viewport.scale,
    config?.levelOfDetail
  );

  const visibleNodeIds = new Set(virtualization.visibleNodes.map(n => n.id));
  const connectionOptimization = useConnectionOptimization(
    virtualization.visibleConnections,
    visibleNodeIds,
    viewport.scale,
    config?.connectionOptimization?.complexityThreshold
  );

  return {
    ...virtualization,
    levelOfDetail,
    connectionOptimization,
  };
}