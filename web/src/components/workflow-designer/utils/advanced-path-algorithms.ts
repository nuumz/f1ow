/**
 * Advanced D3.js Path Generation Algorithms
 * Professional-grade connection rendering for workflow designers
 * 
 * Features:
 * - Intelligent Bézier curve generation with d3.path()
 * - Collision avoidance algorithms
 * - Quadtree spatial partitioning
 * - Force-directed path optimization
 * - Bundled edge routing
 * - Magnetic snap points
 */

import * as d3 from 'd3'
import type { WorkflowNode, Connection, PortPosition } from '../types'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface PathPoint {
  x: number
  y: number
}

export interface PathSegment {
  start: PathPoint
  end: PathPoint
  controlPoints: PathPoint[]
  curve?: d3.CurveFactory
}

export interface ConnectionPath {
  id: string
  sourceNode: WorkflowNode
  targetNode: WorkflowNode
  sourcePort: PortPosition
  targetPort: PortPosition
  pathData: string
  segments: PathSegment[]
  metadata: {
    length: number
    collisions: number
    optimization: 'smooth' | 'direct' | 'bundled' | 'routed'
    performance: number
  }
}

export interface PathConfiguration {
  algorithm: 'bezier' | 'smooth' | 'orthogonal' | 'bundled' | 'force-directed'
  curveTension: number
  avoidCollisions: boolean
  snapToGrid: boolean
  bundleThreshold: number
  smoothingFactor: number
  optimizePerformance: boolean
}

export interface SpatialQuadTree {
  nodes: Map<string, WorkflowNode>
  connections: Map<string, ConnectionPath>
  obstacles: PathPoint[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

// ============================================================================
// ADVANCED BÉZIER CURVE ALGORITHMS
// ============================================================================

/**
 * Generate intelligent Bézier curves using D3's curve factories
 * This replaces the manual control point calculation with professional algorithms
 */
export class AdvancedBezierGenerator {
  private static instance: AdvancedBezierGenerator
  private curveBasis = d3.curveBasis
  private curveCardinal = d3.curveCardinal
  private curveMonotoneX = d3.curveMonotoneX

  static getInstance(): AdvancedBezierGenerator {
    if (!AdvancedBezierGenerator.instance) {
      AdvancedBezierGenerator.instance = new AdvancedBezierGenerator()
    }
    return AdvancedBezierGenerator.instance
  }

  /**
   * Generate smooth Bézier path using d3.path() API
   */
  generateSmoothPath(
    sourcePos: PortPosition,
    targetPos: PortPosition,
    config: Partial<PathConfiguration> = {}
  ): string {
    const path = d3.path()
    const tension = config.curveTension || 0.4

    // Calculate intelligent control points based on port positions and node orientations
    const controlPoints = this.calculateIntelligentControlPoints(sourcePos, targetPos, tension)

    path.moveTo(sourcePos.x, sourcePos.y)

    if (controlPoints.length === 2) {
      // Cubic Bézier curve
      path.bezierCurveTo(
        controlPoints[0].x, controlPoints[0].y,
        controlPoints[1].x, controlPoints[1].y,
        targetPos.x, targetPos.y
      )
    } else {
      // Quadratic Bézier curve as fallback
      const cp = controlPoints[0] || this.getMidpoint(sourcePos, targetPos)
      path.quadraticCurveTo(cp.x, cp.y, targetPos.x, targetPos.y)
    }

    return path.toString()
  }

  /**
   * Generate path using D3's curve factories for different visual styles
   */
  generateCurveFactoryPath(
    points: PathPoint[],
    curveType: 'basis' | 'cardinal' | 'monotone' | 'linear' = 'basis'
  ): string {
    const line = d3.line<PathPoint>()
      .x(d => d.x)
      .y(d => d.y)

    switch (curveType) {
      case 'basis':
        line.curve(this.curveBasis)
        break
      case 'cardinal':
        line.curve(this.curveCardinal.tension(0.5))
        break
      case 'monotone':
        line.curve(this.curveMonotoneX)
        break
      case 'linear':
        line.curve(d3.curveLinear)
        break
    }

    return line(points) || ''
  }

  /**
   * Calculate intelligent control points based on node shapes and orientations
   */
  private calculateIntelligentControlPoints(
    source: PortPosition,
    target: PortPosition,
    tension: number
  ): PathPoint[] {
    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Adaptive control point distance based on connection length
    const baseControlDistance = Math.min(distance * 0.4, 150)
    const controlDistance = baseControlDistance * (1 + tension)

    // Calculate direction vectors
    const sourceDirection = this.getPortDirection(source, target)
    const targetDirection = this.getPortDirection(target, source)

    // First control point (from source)
    const cp1: PathPoint = {
      x: source.x + sourceDirection.x * controlDistance,
      y: source.y + sourceDirection.y * controlDistance
    }

    // Second control point (to target)
    const cp2: PathPoint = {
      x: target.x + targetDirection.x * controlDistance,
      y: target.y + targetDirection.y * controlDistance
    }

    return [cp1, cp2]
  }

  /**
   * Get port direction vector for intelligent curve generation
   */
  private getPortDirection(from: PortPosition, to: PortPosition): PathPoint {
    const dx = to.x - from.x
    const dy = to.y - from.y

    // Prefer horizontal flow for side ports, vertical for top/bottom ports
    if (Math.abs(dx) > Math.abs(dy)) {
      return { x: dx > 0 ? 1 : -1, y: 0 }
    } else {
      return { x: 0, y: dy > 0 ? 1 : -1 }
    }
  }

  private getMidpoint(p1: PathPoint, p2: PathPoint): PathPoint {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    }
  }
}

// ============================================================================
// SPATIAL PARTITIONING WITH QUADTREE
// ============================================================================

/**
 * Quadtree implementation for efficient collision detection and path optimization
 */
export class SpatialQuadTree {
  private quadtree: d3.Quadtree<any>
  private bounds: { minX: number; minY: number; maxX: number; maxY: number }

  constructor(bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
    this.bounds = bounds
    this.quadtree = d3.quadtree()
      .extent([[bounds.minX, bounds.minY], [bounds.maxX, bounds.maxY]])
      .x(d => d.x)
      .y(d => d.y)
  }

  /**
   * Add obstacles (nodes, existing paths) to the quadtree
   */
  addObstacles(obstacles: Array<{ x: number; y: number; width?: number; height?: number; id?: string }>) {
    obstacles.forEach(obstacle => {
      this.quadtree.add({
        x: obstacle.x,
        y: obstacle.y,
        width: obstacle.width || 20,
        height: obstacle.height || 20,
        id: obstacle.id
      })
    })
  }

  /**
   * Find potential collisions for a path segment
   */
  findCollisions(segment: { start: PathPoint; end: PathPoint }, margin: number = 10): any[] {
    const minX = Math.min(segment.start.x, segment.end.x) - margin
    const minY = Math.min(segment.start.y, segment.end.y) - margin
    const maxX = Math.max(segment.start.x, segment.end.x) + margin
    const maxY = Math.max(segment.start.y, segment.end.y) + margin

    const collisions: any[] = []
    this.quadtree.visit((node, x1, y1, x2, y2) => {
      if (!node.length) {
        // Leaf node
        if (node.data) {
          const obstacle = node.data
          if (this.lineIntersectsRectangle(segment, {
            x: obstacle.x - obstacle.width / 2,
            y: obstacle.y - obstacle.height / 2,
            width: obstacle.width,
            height: obstacle.height
          })) {
            collisions.push(obstacle)
          }
        }
      }
      return x1 > maxX || y1 > maxY || x2 < minX || y2 < minY
    })

    return collisions
  }

  /**
   * Check if a line segment intersects with a rectangle
   */
  private lineIntersectsRectangle(
    line: { start: PathPoint; end: PathPoint },
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    // Simple line-rectangle intersection test
    const { start, end } = line
    const { x, y, width, height } = rect

    // Check if either endpoint is inside the rectangle
    if ((start.x >= x && start.x <= x + width && start.y >= y && start.y <= y + height) ||
        (end.x >= x && end.x <= x + width && end.y >= y && end.y <= y + height)) {
      return true
    }

    // Check if line intersects any edge of the rectangle
    return (
      this.lineIntersectsLine(start, end, { x, y }, { x: x + width, y }) ||
      this.lineIntersectsLine(start, end, { x: x + width, y }, { x: x + width, y: y + height }) ||
      this.lineIntersectsLine(start, end, { x: x + width, y: y + height }, { x, y: y + height }) ||
      this.lineIntersectsLine(start, end, { x, y: y + height }, { x, y })
    )
  }

  /**
   * Check if two line segments intersect
   */
  private lineIntersectsLine(p1: PathPoint, p2: PathPoint, p3: PathPoint, p4: PathPoint): boolean {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y)
    if (denom === 0) return false

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1
  }

  /**
   * Clear all data from the quadtree
   */
  clear() {
    this.quadtree = d3.quadtree()
      .extent([[this.bounds.minX, this.bounds.minY], [this.bounds.maxX, this.bounds.maxY]])
      .x(d => d.x)
      .y(d => d.y)
  }
}

// ============================================================================
// COLLISION AVOIDANCE ALGORITHMS
// ============================================================================

/**
 * Advanced collision avoidance for connection paths
 */
export class CollisionAvoidanceEngine {
  private quadtree: SpatialQuadTree
  private avoidanceStrength: number = 50

  constructor(canvasBounds: { minX: number; minY: number; maxX: number; maxY: number }) {
    this.quadtree = new SpatialQuadTree(canvasBounds)
  }

  /**
   * Generate collision-free path using A* pathfinding algorithm
   */
  generateCollisionFreePath(
    sourcePos: PortPosition,
    targetPos: PortPosition,
    obstacles: WorkflowNode[]
  ): PathPoint[] {
    // Add obstacles to quadtree
    this.quadtree.clear()
    this.quadtree.addObstacles(obstacles.map(node => ({
      x: node.x,
      y: node.y,
      width: 200, // Node width
      height: 80,  // Node height
      id: node.id
    })))

    // Use simplified A* algorithm for pathfinding
    return this.aStarPathfinding(sourcePos, targetPos)
  }

  /**
   * Apply magnetic snap points for better visual alignment
   */
  applyMagneticSnapping(
    pathPoints: PathPoint[],
    snapStrength: number = 10,
    gridSize: number = 20
  ): PathPoint[] {
    return pathPoints.map(point => {
      const snappedX = Math.round(point.x / gridSize) * gridSize
      const snappedY = Math.round(point.y / gridSize) * gridSize

      const snapDistanceX = Math.abs(point.x - snappedX)
      const snapDistanceY = Math.abs(point.y - snappedY)

      return {
        x: snapDistanceX <= snapStrength ? snappedX : point.x,
        y: snapDistanceY <= snapStrength ? snappedY : point.y
      }
    })
  }

  /**
   * Simplified A* pathfinding implementation
   */
  private aStarPathfinding(start: PathPoint, end: PathPoint): PathPoint[] {
    // For performance, we'll use a simplified approach with waypoints
    const waypoints: PathPoint[] = [start]

    // Check for direct path first
    const directPath = { start, end }
    const collisions = this.quadtree.findCollisions(directPath, 20)

    if (collisions.length === 0) {
      waypoints.push(end)
      return waypoints
    }

    // Add waypoints to avoid collisions
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2
    }

    // Try going around the obstacle
    const avoidanceOffset = this.avoidanceStrength
    const perpendicular = this.getPerpendicularVector(start, end)

    const waypoint1 = {
      x: midpoint.x + perpendicular.x * avoidanceOffset,
      y: midpoint.y + perpendicular.y * avoidanceOffset
    }

    const waypoint2 = {
      x: midpoint.x - perpendicular.x * avoidanceOffset,
      y: midpoint.y - perpendicular.y * avoidanceOffset
    }

    // Choose the waypoint with fewer collisions
    const path1Collisions = this.quadtree.findCollisions({ start, end: waypoint1 }, 10).length +
                           this.quadtree.findCollisions({ start: waypoint1, end }, 10).length

    const path2Collisions = this.quadtree.findCollisions({ start, end: waypoint2 }, 10).length +
                           this.quadtree.findCollisions({ start: waypoint2, end }, 10).length

    const chosenWaypoint = path1Collisions <= path2Collisions ? waypoint1 : waypoint2

    waypoints.push(chosenWaypoint)
    waypoints.push(end)

    return waypoints
  }

  /**
   * Get perpendicular vector for avoidance calculations
   */
  private getPerpendicularVector(start: PathPoint, end: PathPoint): PathPoint {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.sqrt(dx * dx + dy * dy)

    if (length === 0) return { x: 0, y: 1 }

    return {
      x: -dy / length,
      y: dx / length
    }
  }
}

// ============================================================================
// BUNDLED EDGE ROUTING
// ============================================================================

/**
 * Bundled edge routing for cleaner layouts with multiple connections
 */
export class BundledEdgeRouter {
  private bundleThreshold: number = 50
  private bundleStrength: number = 0.8

  /**
   * Group connections that can be bundled together
   */
  groupConnectionsForBundling(connections: Connection[], nodes: Map<string, WorkflowNode>): Map<string, Connection[]> {
    const bundles = new Map<string, Connection[]>()

    connections.forEach(connection => {
      const sourceNode = nodes.get(connection.sourceNodeId)
      const targetNode = nodes.get(connection.targetNodeId)

      if (!sourceNode || !targetNode) return

      // Create bundle key based on general direction
      const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x)
      const normalizedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4) // Snap to 8 directions

      const bundleKey = `${sourceNode.id}-${normalizedAngle.toFixed(2)}`

      if (!bundles.has(bundleKey)) {
        bundles.set(bundleKey, [])
      }

      bundles.get(bundleKey)!.push(connection)
    })

    // Filter out bundles with only one connection
    bundles.forEach((connectionList, key) => {
      if (connectionList.length < 2) {
        bundles.delete(key)
      }
    })

    return bundles
  }

  /**
   * Generate bundled paths for multiple connections
   */
  generateBundledPaths(
    connectionBundle: Connection[],
    nodes: Map<string, WorkflowNode>
  ): Map<string, string> {
    const paths = new Map<string, string>()

    if (connectionBundle.length < 2) {
      // Not enough connections to bundle, use regular paths
      connectionBundle.forEach(connection => {
        const sourceNode = nodes.get(connection.sourceNodeId)
        const targetNode = nodes.get(connection.targetNodeId)
        if (sourceNode && targetNode) {
          const bezierGen = AdvancedBezierGenerator.getInstance()
          const path = bezierGen.generateSmoothPath(
            { x: sourceNode.x, y: sourceNode.y },
            { x: targetNode.x, y: targetNode.y }
          )
          paths.set(connection.id, path)
        }
      })
      return paths
    }

    // Calculate bundle control point
    const bundleControlPoint = this.calculateBundleControlPoint(connectionBundle, nodes)

    // Generate individual paths that converge toward the bundle point
    connectionBundle.forEach((connection, index) => {
      const sourceNode = nodes.get(connection.sourceNodeId)
      const targetNode = nodes.get(connection.targetNodeId)

      if (!sourceNode || !targetNode) return

      const bundlePath = this.generateBundledConnectionPath(
        { x: sourceNode.x, y: sourceNode.y },
        { x: targetNode.x, y: targetNode.y },
        bundleControlPoint,
        index,
        connectionBundle.length
      )

      paths.set(connection.id, bundlePath)
    })

    return paths
  }

  /**
   * Calculate the control point where bundled connections should converge
   */
  private calculateBundleControlPoint(
    connections: Connection[],
    nodes: Map<string, WorkflowNode>
  ): PathPoint {
    let sumX = 0
    let sumY = 0
    let count = 0

    connections.forEach(connection => {
      const sourceNode = nodes.get(connection.sourceNodeId)
      const targetNode = nodes.get(connection.targetNodeId)

      if (sourceNode && targetNode) {
        sumX += (sourceNode.x + targetNode.x) / 2
        sumY += (sourceNode.y + targetNode.y) / 2
        count++
      }
    })

    return {
      x: count > 0 ? sumX / count : 0,
      y: count > 0 ? sumY / count : 0
    }
  }

  /**
   * Generate a path for a single connection within a bundle
   */
  private generateBundledConnectionPath(
    source: PathPoint,
    target: PathPoint,
    bundlePoint: PathPoint,
    index: number,
    totalConnections: number
  ): string {
    const path = d3.path()

    // Calculate offset for this specific connection within the bundle
    const bundleOffset = (index - (totalConnections - 1) / 2) * 5

    // Offset the bundle point slightly for each connection
    const offsetBundlePoint = {
      x: bundlePoint.x + bundleOffset,
      y: bundlePoint.y + bundleOffset * 0.5
    }

    // Generate path through the bundle point
    path.moveTo(source.x, source.y)

    // First curve to bundle point
    const cp1 = {
      x: source.x + (offsetBundlePoint.x - source.x) * 0.6,
      y: source.y + (offsetBundlePoint.y - source.y) * 0.3
    }

    const cp2 = {
      x: offsetBundlePoint.x - (offsetBundlePoint.x - source.x) * 0.3,
      y: offsetBundlePoint.y - (offsetBundlePoint.y - source.y) * 0.6
    }

    path.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, offsetBundlePoint.x, offsetBundlePoint.y)

    // Second curve from bundle point to target
    const cp3 = {
      x: offsetBundlePoint.x + (target.x - offsetBundlePoint.x) * 0.3,
      y: offsetBundlePoint.y + (target.y - offsetBundlePoint.y) * 0.6
    }

    const cp4 = {
      x: target.x - (target.x - offsetBundlePoint.x) * 0.6,
      y: target.y - (target.y - offsetBundlePoint.y) * 0.3
    }

    path.bezierCurveTo(cp3.x, cp3.y, cp4.x, cp4.y, target.x, target.y)

    return path.toString()
  }
}

// ============================================================================
// FORCE-DIRECTED PATH OPTIMIZATION
// ============================================================================

/**
 * Force-directed algorithms for optimal path placement
 */
export class ForceDirectedPathOptimizer {
  private simulation: d3.Simulation<any, any> | null = null

  /**
   * Apply force-directed layout to optimize connection paths
   */
  optimizeConnectionPaths(
    connections: Connection[],
    nodes: Map<string, WorkflowNode>
  ): Map<string, PathPoint[]> {
    const pathPoints = new Map<string, PathPoint[]>()
    const simulationNodes: any[] = []

    // Create intermediate points for each connection
    connections.forEach(connection => {
      const sourceNode = nodes.get(connection.sourceNodeId)
      const targetNode = nodes.get(connection.targetNodeId)

      if (!sourceNode || !targetNode) return

      // Create intermediate control points
      const midPoint1 = {
        id: `${connection.id}-mid1`,
        connectionId: connection.id,
        x: sourceNode.x + (targetNode.x - sourceNode.x) * 0.33,
        y: sourceNode.y + (targetNode.y - sourceNode.y) * 0.33,
        fx: null,
        fy: null
      }

      const midPoint2 = {
        id: `${connection.id}-mid2`,
        connectionId: connection.id,
        x: sourceNode.x + (targetNode.x - sourceNode.x) * 0.67,
        y: sourceNode.y + (targetNode.y - sourceNode.y) * 0.67,
        fx: null,
        fy: null
      }

      simulationNodes.push(midPoint1, midPoint2)

      pathPoints.set(connection.id, [
        { x: sourceNode.x, y: sourceNode.y },
        midPoint1,
        midPoint2,
        { x: targetNode.x, y: targetNode.y }
      ])
    })

    // Create force simulation
    this.simulation = d3.forceSimulation(simulationNodes)
      .force('collision', d3.forceCollide(20))
      .force('charge', d3.forceManyBody().strength(-30))
      .force('center', d3.forceCenter(0, 0).strength(0.1))
      .alphaDecay(0.1)
      .velocityDecay(0.8)

    // Run simulation for a limited number of ticks
    for (let i = 0; i < 100; i++) {
      this.simulation.tick()
    }

    // Update path points with optimized positions
    simulationNodes.forEach(node => {
      const connectionPath = pathPoints.get(node.connectionId)
      if (connectionPath) {
        const pointIndex = node.id.includes('mid1') ? 1 : 2
        connectionPath[pointIndex] = { x: node.x, y: node.y }
      }
    })

    this.simulation.stop()
    this.simulation = null

    return pathPoints
  }

  /**
   * Stop the force simulation
   */
  stopSimulation() {
    if (this.simulation) {
      this.simulation.stop()
      this.simulation = null
    }
  }
}

// ============================================================================
// MAIN PATH GENERATION FACTORY
// ============================================================================

/**
 * Main factory class that orchestrates all advanced path generation algorithms
 */
export class AdvancedPathFactory {
  private bezierGenerator: AdvancedBezierGenerator
  private collisionEngine: CollisionAvoidanceEngine
  private bundledRouter: BundledEdgeRouter
  private forceOptimizer: ForceDirectedPathOptimizer

  constructor(canvasBounds: { minX: number; minY: number; maxX: number; maxY: number }) {
    this.bezierGenerator = AdvancedBezierGenerator.getInstance()
    this.collisionEngine = new CollisionAvoidanceEngine(canvasBounds)
    this.bundledRouter = new BundledEdgeRouter()
    this.forceOptimizer = new ForceDirectedPathOptimizer()
  }

  /**
   * Generate advanced connection path with all professional features
   */
  generateAdvancedConnectionPath(
    connection: Connection,
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    sourcePort: PortPosition,
    targetPort: PortPosition,
    allNodes: WorkflowNode[],
    allConnections: Connection[],
    config: Partial<PathConfiguration> = {}
  ): ConnectionPath {
    const defaultConfig: PathConfiguration = {
      algorithm: 'bezier',
      curveTension: 0.4,
      avoidCollisions: true,
      snapToGrid: false,
      bundleThreshold: 50,
      smoothingFactor: 0.8,
      optimizePerformance: true
    }

    const finalConfig = { ...defaultConfig, ...config }

    let pathData: string
    let segments: PathSegment[]
    let collisionCount = 0

    switch (finalConfig.algorithm) {
      case 'smooth':
        pathData = this.bezierGenerator.generateSmoothPath(sourcePort, targetPort, finalConfig)
        segments = [{ start: sourcePort, end: targetPort, controlPoints: [] }]
        break

      case 'orthogonal':
        const waypoints = this.generateOrthogonalWaypoints(sourcePort, targetPort)
        pathData = this.bezierGenerator.generateCurveFactoryPath(waypoints, 'monotone')
        segments = this.waypointsToSegments(waypoints)
        break

      case 'bundled':
        // This would typically be handled at a higher level for multiple connections
        pathData = this.bezierGenerator.generateSmoothPath(sourcePort, targetPort, finalConfig)
        segments = [{ start: sourcePort, end: targetPort, controlPoints: [] }]
        break

      case 'force-directed':
        const optimizedPoints = this.forceOptimizer.optimizeConnectionPaths(
          [connection],
          new Map([[sourceNode.id, sourceNode], [targetNode.id, targetNode]])
        )
        const points = optimizedPoints.get(connection.id) || [sourcePort, targetPort]
        pathData = this.bezierGenerator.generateCurveFactoryPath(points, 'basis')
        segments = this.waypointsToSegments(points)
        break

      default: // 'bezier'
        if (finalConfig.avoidCollisions) {
          const avoidancePath = this.collisionEngine.generateCollisionFreePath(
            sourcePort,
            targetPort,
            allNodes.filter(n => n.id !== sourceNode.id && n.id !== targetNode.id)
          )
          collisionCount = avoidancePath.length - 2 // Waypoints added for avoidance
          pathData = this.bezierGenerator.generateCurveFactoryPath(avoidancePath, 'basis')
          segments = this.waypointsToSegments(avoidancePath)
        } else {
          pathData = this.bezierGenerator.generateSmoothPath(sourcePort, targetPort, finalConfig)
          segments = [{ start: sourcePort, end: targetPort, controlPoints: [] }]
        }
        break
    }

    // Calculate path metadata
    const pathLength = this.calculatePathLength(pathData)
    const performance = this.calculatePerformanceScore(pathLength, collisionCount, segments.length)

    return {
      id: connection.id,
      sourceNode,
      targetNode,
      sourcePort,
      targetPort,
      pathData,
      segments,
      metadata: {
        length: pathLength,
        collisions: collisionCount,
        optimization: finalConfig.algorithm === 'bezier' && finalConfig.avoidCollisions ? 'routed' : 
                     finalConfig.algorithm === 'bundled' ? 'bundled' :
                     finalConfig.algorithm === 'smooth' ? 'smooth' : 'direct',
        performance
      }
    }
  }

  /**
   * Generate orthogonal waypoints for right-angle connections
   */
  private generateOrthogonalWaypoints(source: PortPosition, target: PortPosition): PathPoint[] {
    const waypoints: PathPoint[] = [source]

    // Simple L-shaped path
    if (Math.abs(target.x - source.x) > Math.abs(target.y - source.y)) {
      // Horizontal first
      waypoints.push({ x: target.x, y: source.y })
    } else {
      // Vertical first
      waypoints.push({ x: source.x, y: target.y })
    }

    waypoints.push(target)
    return waypoints
  }

  /**
   * Convert waypoints to path segments
   */
  private waypointsToSegments(waypoints: PathPoint[]): PathSegment[] {
    const segments: PathSegment[] = []

    for (let i = 0; i < waypoints.length - 1; i++) {
      segments.push({
        start: waypoints[i],
        end: waypoints[i + 1],
        controlPoints: []
      })
    }

    return segments
  }

  /**
   * Calculate approximate path length
   */
  private calculatePathLength(pathData: string): number {
    // Simplified calculation - in a real implementation, you'd use SVG path parsing
    const commands = pathData.match(/[ML]\s*[\d.-]+\s*[\d.-]+/g) || []
    let length = 0

    for (let i = 1; i < commands.length; i++) {
      const prev = commands[i - 1].match(/[\d.-]+/g)?.map(Number) || [0, 0]
      const curr = commands[i].match(/[\d.-]+/g)?.map(Number) || [0, 0]

      if (prev.length >= 2 && curr.length >= 2) {
        const dx = curr[0] - prev[0]
        const dy = curr[1] - prev[1]
        length += Math.sqrt(dx * dx + dy * dy)
      }
    }

    return length
  }

  /**
   * Calculate performance score for the path
   */
  private calculatePerformanceScore(length: number, collisions: number, segments: number): number {
    // Lower scores are better
    const lengthScore = length / 1000 // Normalize length
    const collisionPenalty = collisions * 2
    const complexityPenalty = segments * 0.5

    return Math.max(0, 10 - lengthScore - collisionPenalty - complexityPenalty)
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.forceOptimizer.stopSimulation()
  }
}