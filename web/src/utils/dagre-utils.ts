// Dagre layout utility for auto-layout
import dagre from 'dagre'

interface LayoutNode {
  id: string
  width: number
  height: number
}

interface LayoutEdge {
  source: string
  target: string
}

interface LayoutOptions {
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL'
  nodesep?: number
  ranksep?: number
  marginx?: number
  marginy?: number
}

export function calculateLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions = {}
) {
  const g = new dagre.graphlib.Graph()
  
  // Set graph options
  g.setGraph({
    rankdir: options.rankdir || 'LR',
    nodesep: options.nodesep || 100,
    ranksep: options.ranksep || 150,
    marginx: options.marginx || 20,
    marginy: options.marginy || 20
  })
  
  g.setDefaultEdgeLabel(() => ({}))
  
  // Add nodes
  nodes.forEach(node => {
    g.setNode(node.id, {
      width: node.width,
      height: node.height
    })
  })
  
  // Add edges
  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })
  
  // Calculate layout
  dagre.layout(g)
  
  // Extract positions
  const positions: Record<string, { x: number, y: number }> = {}
  
  nodes.forEach(node => {
    const graphNode = g.node(node.id)
    if (graphNode) {
      positions[node.id] = {
        x: graphNode.x,
        y: graphNode.y
      }
    }
  })
  
  return positions
}
