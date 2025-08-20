# Connection Path System - f1ow Workflow Engine

## 🔗 Overview

The Connection Path System is a sophisticated visual connection rendering system that handles node interconnections in both workflow and architecture modes. It implements advanced path generation algorithms, intelligent caching strategies, and provides smooth interactive experiences.

## 🎯 Core Architecture

### System Components

```typescript
// Main modules structure
ConnectionPathSystem/
├── hooks/
│   ├── useConnections.ts       // Connection state management
│   └── useConnectionPaths.ts   // Path generation with caching
├── utils/
│   ├── path-generation.ts      // Core path algorithms
│   ├── connection-utils.ts     // High-level API and mode logic
│   ├── connection-analysis.ts  // Grouping and analysis
│   ├── connection-dom.ts       // D3-based DOM rendering
│   └── port-positioning.ts     // Port calculation utilities
└── components/
    └── ConnectionLayer.tsx      // React rendering component
```

### Key Interfaces

```typescript
interface Connection {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  type?: 'workflow' | 'architecture'
  metadata?: Record<string, any>
}

interface ConnectionPreview {
  sourceNodeId: string
  sourcePortId: string
  previewPosition: { x: number; y: number }
  targetNodeId?: string
  targetPortId?: string
}

interface PortPosition {
  x: number
  y: number
  side?: 'top' | 'right' | 'bottom' | 'left'
}
```

## 🚀 Path Generation Algorithms

### 1. Workflow Mode - Bézier Curves

Workflow mode uses smooth curved paths for visual flow representation:

```typescript
function generateBezierPath(
  sourcePos: PortPosition,
  targetPos: PortPosition,
  options?: { curvature?: number }
): string {
  const dx = targetPos.x - sourcePos.x
  const dy = targetPos.y - sourcePos.y
  const curvature = options?.curvature || 0.5
  
  // Calculate control points for smooth curve
  const controlPoint1X = sourcePos.x + dx * curvature
  const controlPoint1Y = sourcePos.y
  const controlPoint2X = targetPos.x - dx * curvature  
  const controlPoint2Y = targetPos.y
  
  return `M ${sourcePos.x} ${sourcePos.y} 
          C ${controlPoint1X} ${controlPoint1Y}, 
            ${controlPoint2X} ${controlPoint2Y}, 
            ${targetPos.x} ${targetPos.y}`
}
```

### 2. Architecture Mode - Orthogonal Routing

Architecture mode implements Manhattan-style routing with intelligent path finding:

```typescript
interface OrthogonalPathOptions {
  sourceNode: WorkflowNode
  targetNode: WorkflowNode
  sourceSide?: SidePortId
  targetSide?: SidePortId
  avoidOverlap?: boolean
}

function generateOrthogonalPath(options: OrthogonalPathOptions): string {
  // Intelligent U-shape detection
  const needsUShape = detectUShapeRequirement(
    options.sourceNode,
    options.targetNode,
    options.sourceSide,
    options.targetSide
  )
  
  if (needsUShape) {
    return generateUShapePath(options)
  }
  
  // Standard orthogonal routing with adaptive lead lengths
  const leadLength = getAdaptiveLeadLength(
    calculateDistance(sourcePos, targetPos),
    FIXED_LEAD_LENGTH
  )
  
  return generateAdaptiveOrthogonalPath(
    sourcePos,
    targetPos,
    leadLength
  )
}
```

### 3. U-Shape Routing

Special handling for connections that need to route around nodes:

```typescript
function generateUShapePath(
  sourcePos: PortPosition,
  targetPos: PortPosition,
  obstacleNodes: WorkflowNode[]
): string {
  // Calculate safe clearance distance
  const safeClearance = 16
  
  // Determine U-shape direction (top/bottom)
  const useBottomRoute = shouldUseBottomRoute(
    sourcePos,
    targetPos,
    obstacleNodes
  )
  
  if (useBottomRoute) {
    const bottomY = Math.max(
      ...obstacleNodes.map(n => n.y + n.height)
    ) + safeClearance
    
    return `M ${sourcePos.x} ${sourcePos.y}
            L ${sourcePos.x} ${bottomY}
            L ${targetPos.x} ${bottomY}
            L ${targetPos.x} ${targetPos.y}`
  }
  
  // Similar logic for top U-shape
  // ...
}
```

## ⚡ Performance Optimizations

### 1. Multi-Level Caching Strategy

```typescript
class PathCache {
  private pathCache = new Map<string, string>()
  private geometryCache = new Map<string, NodeGeometry>()
  private dragOverrides = new Map<string, Position>()
  
  // Cache keys include all relevant parameters
  private generateCacheKey(
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId: string,
    targetPortId: string,
    mode: 'workflow' | 'architecture'
  ): string {
    return `${mode}:${sourceNodeId}:${sourcePortId}->${targetNodeId}:${targetPortId}`
  }
  
  // Intelligent cache invalidation
  invalidateNode(nodeId: string): void {
    // Only invalidate paths connected to this node
    for (const [key, _] of this.pathCache) {
      if (key.includes(nodeId)) {
        this.pathCache.delete(key)
      }
    }
  }
}
```

### 2. Adaptive Cache Cleanup

```typescript
function performCacheCleanup(
  cache: Map<string, any>,
  maxSize: number = 500
): void {
  const cacheSize = cache.size
  
  if (cacheSize <= maxSize) return
  
  // Pressure-based cleanup probability
  const overBy = cacheSize - maxSize
  const pressureRatio = Math.min(1, overBy / (maxSize * 0.5))
  const cleanupProbability = 0.02 + pressureRatio * 0.08 // 2%-10%
  
  let removed = 0
  for (const [key, _] of cache) {
    if (Math.random() < cleanupProbability) {
      cache.delete(key)
      removed++
      if (removed >= overBy * 0.3) break // Remove ~30% of overflow
    }
  }
}
```

### 3. Drag Position Overrides

During drag operations, positions are temporarily overridden without cache invalidation:

```typescript
const useConnectionPaths = () => {
  const dragPositionsRef = useRef<Map<string, Position>>(new Map())
  
  // Override position during drag without cache invalidation
  const setDragPosition = useCallback((nodeId: string, position: Position) => {
    dragPositionsRef.current.set(nodeId, position)
    // Don't invalidate cache - use override for rendering
  }, [])
  
  const clearDragPosition = useCallback((nodeId: string) => {
    dragPositionsRef.current.delete(nodeId)
    // Now invalidate cache for permanent update
    invalidateNodeCache(nodeId)
  }, [])
  
  // Apply overrides when calculating paths
  const getNodePosition = useCallback((nodeId: string): Position => {
    return dragPositionsRef.current.get(nodeId) || 
           nodes.find(n => n.id === nodeId)?.position
  }, [nodes])
}
```

## 🎨 Port Positioning System

### 1. Shape-Aware Port Calculation

```typescript
interface PortCalculationOptions {
  nodeShape: 'rectangle' | 'diamond' | 'circle'
  nodeVariant: 'standard' | 'compact'
  portType: 'input' | 'output' | 'bottom'
  portIndex: number
  totalPorts: number
}

function calculatePortPosition(
  node: WorkflowNode,
  options: PortCalculationOptions
): PortPosition {
  const { width, height } = getNodeDimensions(node, options.nodeVariant)
  
  switch (options.nodeShape) {
    case 'diamond':
      return calculateDiamondPortPosition(node, options)
    
    case 'circle':
      return calculateCirclePortPosition(node, options)
    
    default: // rectangle
      return calculateRectanglePortPosition(node, options)
  }
}
```

### 2. Bottom Port Special Handling

```typescript
function calculateBottomPortPosition(
  node: WorkflowNode,
  portIndex: number,
  totalPorts: number
): PortPosition {
  const nodeWidth = getNodeWidth(node)
  const usableWidth = nodeWidth * 0.8 // 80% of width for ports
  
  // Special positioning for small port counts
  if (totalPorts === 1) {
    return { x: node.x + nodeWidth / 2, y: node.y + node.height }
  }
  
  if (totalPorts === 2) {
    const spacing = usableWidth / 3
    const positions = [-spacing, spacing]
    return {
      x: node.x + nodeWidth / 2 + positions[portIndex],
      y: node.y + node.height
    }
  }
  
  // Even distribution for many ports
  const spacing = usableWidth / (totalPorts - 1)
  const offset = -usableWidth / 2 + portIndex * spacing
  return {
    x: node.x + nodeWidth / 2 + offset,
    y: node.y + node.height
  }
}
```

## 🔄 Connection Validation

### 1. Mode-Aware Validation Rules

```typescript
const validateConnection = (
  sourceNode: WorkflowNode,
  targetNode: WorkflowNode,
  sourcePort: string,
  targetPort: string,
  mode: 'workflow' | 'architecture'
): ValidationResult => {
  // Common rules
  if (sourceNode.id === targetNode.id) {
    return { valid: false, reason: 'Self-connections not allowed' }
  }
  
  // Mode-specific rules
  if (mode === 'workflow') {
    // Single input constraint in workflow mode
    if (hasExistingInputConnection(targetNode.id, targetPort)) {
      return { valid: false, reason: 'Input port already connected' }
    }
    
    // Prevent circular dependencies
    if (wouldCreateCycle(sourceNode.id, targetNode.id)) {
      return { valid: false, reason: 'Would create circular dependency' }
    }
  } else {
    // Architecture mode allows multiple connections
    // but validates port compatibility
    if (!arePortsCompatible(sourcePort, targetPort)) {
      return { valid: false, reason: 'Incompatible port types' }
    }
  }
  
  return { valid: true }
}
```

### 2. Connection Grouping

For architecture mode with multiple connections:

```typescript
interface ConnectionGroup {
  key: string
  sourceNodeId: string
  targetNodeId: string
  connections: Connection[]
  count: number
  label?: string
}

function groupConnections(
  connections: Connection[]
): Map<string, ConnectionGroup> {
  const groups = new Map<string, ConnectionGroup>()
  
  connections.forEach(connection => {
    const key = generateConnectionGroupKey(
      connection.sourceNodeId,
      connection.targetNodeId,
      connection.sourcePortId,
      connection.targetPortId
    )
    
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        sourceNodeId: connection.sourceNodeId,
        targetNodeId: connection.targetNodeId,
        connections: [],
        count: 0
      })
    }
    
    const group = groups.get(key)!
    group.connections.push(connection)
    group.count++
    
    // Add label for multiple connections
    if (group.count > 1) {
      group.label = `${group.count}x`
    }
  })
  
  return groups
}
```

## 🖼️ Visual Rendering

### 1. D3.js Integration

```typescript
function renderConnections(
  container: SVGElement,
  connections: Connection[],
  paths: Map<string, string>,
  mode: 'workflow' | 'architecture'
): void {
  const selection = d3.select(container)
    .selectAll('.connection')
    .data(connections, d => d.id)
  
  // Enter selection - new connections
  const enter = selection.enter()
    .append('g')
    .attr('class', 'connection')
  
  enter.append('path')
    .attr('class', 'connection-path')
    .attr('fill', 'none')
    .attr('stroke', mode === 'workflow' ? '#3b82f6' : '#6b7280')
    .attr('stroke-width', 2)
  
  // Add arrow markers for architecture mode
  if (mode === 'architecture') {
    enter.append('defs').append('marker')
      .attr('id', d => `arrow-${d.id}`)
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 5)
      .attr('refY', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#6b7280')
  }
  
  // Update selection - existing connections
  selection.merge(enter)
    .select('.connection-path')
    .attr('d', d => paths.get(d.id) || '')
    .attr('marker-end', mode === 'architecture' ? d => `url(#arrow-${d.id})` : null)
  
  // Exit selection - removed connections
  selection.exit().remove()
}
```

### 2. Interactive Features

```typescript
const ConnectionInteraction = {
  // Hover effects
  onHover: (connectionId: string) => {
    d3.select(`#connection-${connectionId}`)
      .transition()
      .duration(200)
      .attr('stroke-width', 3)
      .attr('stroke', '#60a5fa')
  },
  
  // Click to select
  onClick: (connectionId: string) => {
    // Show connection details
    showConnectionDetails(connectionId)
    
    // Highlight connected nodes
    highlightConnectedNodes(connectionId)
  },
  
  // Context menu
  onRightClick: (connectionId: string, event: MouseEvent) => {
    event.preventDefault()
    showContextMenu({
      items: [
        { label: 'Delete Connection', action: () => deleteConnection(connectionId) },
        { label: 'Edit Properties', action: () => editConnection(connectionId) },
        { label: 'Add Label', action: () => addConnectionLabel(connectionId) }
      ],
      position: { x: event.clientX, y: event.clientY }
    })
  }
}
```

## 🎯 Best Practices

### 1. Performance Guidelines

```typescript
// DO: Use cached paths during animations
const animatedPaths = useMemo(() => {
  return connections.map(conn => ({
    id: conn.id,
    path: pathCache.get(conn.id) || generatePath(conn)
  }))
}, [connections, pathCache])

// DON'T: Regenerate paths on every render
const paths = connections.map(conn => generatePath(conn)) // ❌ Expensive

// DO: Batch connection updates
const updateMultipleConnections = (updates: ConnectionUpdate[]) => {
  batchUpdate(() => {
    updates.forEach(update => {
      connections.set(update.id, update.connection)
    })
  })
  requestAnimationFrame(() => rerenderConnections())
}

// DON'T: Update connections individually in a loop
updates.forEach(update => {
  updateConnection(update) // ❌ Triggers multiple rerenders
})
```

### 2. Error Handling

```typescript
const safePathGeneration = (
  sourceNode: WorkflowNode,
  targetNode: WorkflowNode,
  connection: Connection
): string => {
  try {
    // Validate inputs
    if (!validatePathInputs(sourceNode, targetNode)) {
      console.warn('Invalid path inputs, using fallback')
      return generateFallbackPath(sourceNode, targetNode)
    }
    
    // Generate path with error boundary
    const path = generatePath(sourceNode, targetNode, connection)
    
    // Validate output
    if (!isValidSVGPath(path)) {
      throw new Error('Invalid SVG path generated')
    }
    
    return path
  } catch (error) {
    console.error('Path generation failed:', error)
    // Return simple straight line as fallback
    return `M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`
  }
}
```

## 📊 Metrics and Monitoring

```typescript
interface ConnectionMetrics {
  pathGenerationTime: number
  cacheHitRate: number
  averagePathComplexity: number
  connectionCount: number
  rerenderCount: number
}

const ConnectionMonitor = {
  metrics: {
    pathGenerations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalGenerationTime: 0
  },
  
  trackPathGeneration: (startTime: number) => {
    const duration = performance.now() - startTime
    ConnectionMonitor.metrics.totalGenerationTime += duration
    ConnectionMonitor.metrics.pathGenerations++
  },
  
  getCacheHitRate: () => {
    const total = ConnectionMonitor.metrics.cacheHits + 
                  ConnectionMonitor.metrics.cacheMisses
    return total > 0 
      ? ConnectionMonitor.metrics.cacheHits / total 
      : 0
  },
  
  getAverageGenerationTime: () => {
    return ConnectionMonitor.metrics.pathGenerations > 0
      ? ConnectionMonitor.metrics.totalGenerationTime / 
        ConnectionMonitor.metrics.pathGenerations
      : 0
  }
}
```

## 🔮 Future Enhancements

### Planned Improvements

1. **Advanced Routing Algorithms**
   - A* pathfinding for complex obstacle avoidance
   - Spline interpolation for smoother curves
   - Force-directed edge bundling for many connections

2. **Performance Optimizations**
   - WebGL rendering for large graphs (1000+ connections)
   - Web Workers for path calculation
   - Virtual scrolling for viewport culling

3. **Enhanced Features**
   - Connection animations and flow visualization
   - Connection strength/weight visualization
   - Interactive connection editing (drag to reroute)
   - Connection templates and styles

4. **Developer Experience**
   - Connection debugging tools
   - Performance profiler integration
   - Visual connection validator

---

**Related Documentation**:
- [Workflow Features](./04-workflow-features.md)
- [Architecture Features](./05-architecture-features.md)
- [Component System](./02-component-system.md)