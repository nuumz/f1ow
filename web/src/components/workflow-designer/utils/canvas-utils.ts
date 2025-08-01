import * as d3 from 'd3'
import type { WorkflowNode } from '../hooks/useNodeSelection'
import type { Connection } from '../hooks/useConnections'

export interface Point {
  x: number
  y: number
}

export interface CanvasTransform {
  x: number
  y: number
  k: number
}

export interface NodeBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/**
 * Convert screen coordinates to canvas coordinates using current transform
 */
export function screenToCanvas(
  screenPoint: Point,
  svgElement: SVGSVGElement
): Point {
  const transform = d3.zoomTransform(svgElement)
  const [x, y] = transform.invert([screenPoint.x, screenPoint.y])
  return { x, y }
}

/**
 * Convert canvas coordinates to screen coordinates using current transform
 */
export function canvasToScreen(
  canvasPoint: Point,
  transform: CanvasTransform
): Point {
  return {
    x: canvasPoint.x * transform.k + transform.x,
    y: canvasPoint.y * transform.k + transform.y
  }
}

/**
 * Calculate the bounding box of all nodes
 */
export function calculateNodeBounds(nodes: WorkflowNode[], padding = 100): NodeBounds {
  if (nodes.length === 0) {
    return {
      minX: -padding,
      minY: -padding,
      maxX: padding,
      maxY: padding,
      width: padding * 2,
      height: padding * 2
    }
  }

  const minX = Math.min(...nodes.map(n => n.x)) - padding
  const minY = Math.min(...nodes.map(n => n.y)) - padding
  const maxX = Math.max(...nodes.map(n => n.x)) + padding
  const maxY = Math.max(...nodes.map(n => n.y)) + padding

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Calculate optimal zoom and position to fit all nodes in viewport
 */
export function calculateFitTransform(
  nodes: WorkflowNode[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 100
): CanvasTransform {
  const bounds = calculateNodeBounds(nodes, padding)
  
  const scale = Math.min(
    viewportWidth / bounds.width,
    viewportHeight / bounds.height
  ) * 0.9 // 90% to leave some margin

  const centerX = bounds.minX + bounds.width / 2
  const centerY = bounds.minY + bounds.height / 2

  const translateX = viewportWidth / 2 - centerX * scale
  const translateY = viewportHeight / 2 - centerY * scale

  return {
    x: translateX,
    y: translateY,
    k: Math.max(0.4, Math.min(3, scale)) // Clamp between min/max zoom
  }
}

/**
 * Generate smooth connection path between two points
 */
export function generateConnectionPath(
  startPoint: Point,
  endPoint: Point,
  controlOffset = 80
): string {
  const dx = endPoint.x - startPoint.x
  const dy = endPoint.y - startPoint.y
  
  // Calculate control points for smooth curve
  const offset = Math.max(Math.abs(dx) / 2, controlOffset)
  
  const cp1x = startPoint.x + offset
  const cp1y = startPoint.y + dy * 0.05
  const cp2x = endPoint.x - offset
  const cp2y = endPoint.y - dy * 0.05

  return `M ${startPoint.x} ${startPoint.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${endPoint.x} ${endPoint.y}`
}

/**
 * Calculate connection path for a workflow connection
 */
export function generateWorkflowConnectionPath(
  connection: Connection,
  nodes: WorkflowNode[],
  nodeWidth: number = 200
): string {
  const sourceNode = nodes.find(n => n.id === connection.sourceNodeId)
  const targetNode = nodes.find(n => n.id === connection.targetNodeId)
  
  if (!sourceNode || !targetNode) return ""

  const sourcePort = sourceNode.outputs.find(p => p.id === connection.sourcePortId)
  const targetPort = targetNode.inputs.find(p => p.id === connection.targetPortId)
  
  if (!sourcePort || !targetPort) return ""

  const sourceIndex = sourceNode.outputs.indexOf(sourcePort)
  const targetIndex = targetNode.inputs.indexOf(targetPort)

  // Calculate port positions
  const startPoint: Point = {
    x: sourceNode.x + nodeWidth / 2,
    y: sourceNode.y + 40 + sourceIndex * 30
  }

  const endPoint: Point = {
    x: targetNode.x - nodeWidth / 2,
    y: targetNode.y + 40 + targetIndex * 30
  }

  return generateConnectionPath(startPoint, endPoint)
}

/**
 * Check if a point is inside a rectangle
 */
export function isPointInRect(
  point: Point,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

/**
 * Check if two rectangles intersect
 */
export function rectIntersects(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  )
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(point1: Point, point2: Point): number {
  const dx = point2.x - point1.x
  const dy = point2.y - point1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Snap a point to grid
 */
export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize
  }
}

/**
 * Calculate visible area bounds in canvas coordinates
 */
export function getVisibleCanvasBounds(
  transform: CanvasTransform,
  viewportWidth: number,
  viewportHeight: number,
  padding = 500
): NodeBounds {
  const scale = transform.k
  const minX = -transform.x / scale - padding
  const minY = -transform.y / scale - padding
  const maxX = (viewportWidth - transform.x) / scale + padding
  const maxY = (viewportHeight - transform.y) / scale + padding

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}