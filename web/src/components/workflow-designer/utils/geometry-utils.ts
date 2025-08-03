/**
 * Geometry Utilities Module
 * Mathematical calculations for 2D geometry operations used in connection rendering
 */

import type { PortPosition } from '../types'

/**
 * Vector representation for 2D calculations
 */
export interface Vector2D {
  x: number
  y: number
}

/**
 * Rectangle bounds interface
 */
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Line segment interface
 */
export interface LineSegment {
  start: PortPosition
  end: PortPosition
}

/**
 * Calculates the distance between two points
 */
export function calculateDistance(point1: PortPosition, point2: PortPosition): number {
  const dx = point2.x - point1.x
  const dy = point2.y - point1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculates the squared distance between two points (faster when only comparing distances)
 */
export function calculateDistanceSquared(point1: PortPosition, point2: PortPosition): number {
  const dx = point2.x - point1.x
  const dy = point2.y - point1.y
  return dx * dx + dy * dy
}

/**
 * Calculates the midpoint between two points
 */
export function calculateMidpoint(point1: PortPosition, point2: PortPosition): PortPosition {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  }
}

/**
 * Calculates the angle between two points in radians
 */
export function calculateAngle(from: PortPosition, to: PortPosition): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

/**
 * Calculates the angle between two points in degrees
 */
export function calculateAngleDegrees(from: PortPosition, to: PortPosition): number {
  return calculateAngle(from, to) * (180 / Math.PI)
}

/**
 * Normalizes a vector to unit length
 */
export function normalizeVector(vector: Vector2D): Vector2D {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y)
  if (length === 0) {
    return { x: 0, y: 0 }
  }
  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

/**
 * Calculates a vector from point A to point B
 */
export function calculateVector(from: PortPosition, to: PortPosition): Vector2D {
  return {
    x: to.x - from.x,
    y: to.y - from.y
  }
}

/**
 * Calculates the length (magnitude) of a vector
 */
export function vectorLength(vector: Vector2D): number {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y)
}

/**
 * Scales a vector by a scalar value
 */
export function scaleVector(vector: Vector2D, scale: number): Vector2D {
  return {
    x: vector.x * scale,
    y: vector.y * scale
  }
}

/**
 * Adds two vectors
 */
export function addVectors(v1: Vector2D, v2: Vector2D): Vector2D {
  return {
    x: v1.x + v2.x,
    y: v1.y + v2.y
  }
}

/**
 * Subtracts two vectors
 */
export function subtractVectors(v1: Vector2D, v2: Vector2D): Vector2D {
  return {
    x: v1.x - v2.x,
    y: v1.y - v2.y
  }
}

/**
 * Calculates the dot product of two vectors
 */
export function dotProduct(v1: Vector2D, v2: Vector2D): number {
  return v1.x * v2.x + v1.y * v2.y
}

/**
 * Calculates a point at a given distance along a line from start towards end
 */
export function interpolateAlongLine(
  start: PortPosition,
  end: PortPosition,
  distance: number
): PortPosition {
  const totalDistance = calculateDistance(start, end)
  
  if (totalDistance === 0) {
    return start
  }
  
  const ratio = distance / totalDistance
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio
  }
}

/**
 * Calculates a point at a given percentage along a line (0.0 to 1.0)
 */
export function interpolateAlongLinePercent(
  start: PortPosition,
  end: PortPosition,
  percent: number
): PortPosition {
  return {
    x: start.x + (end.x - start.x) * percent,
    y: start.y + (end.y - start.y) * percent
  }
}

/**
 * Calculates the perpendicular vector to a given vector (rotated 90 degrees)
 */
export function perpendicularVector(vector: Vector2D): Vector2D {
  return {
    x: -vector.y,
    y: vector.x
  }
}

/**
 * Rotates a vector by a given angle in radians
 */
export function rotateVector(vector: Vector2D, angleRadians: number): Vector2D {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  }
}

/**
 * Checks if a point is within a rectangular bounds
 */
export function isPointInBounds(point: PortPosition, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

/**
 * Calculates the closest point on a line segment to a given point
 */
export function closestPointOnLineSegment(
  point: PortPosition,
  lineStart: PortPosition,
  lineEnd: PortPosition
): PortPosition {
  const lineVector = calculateVector(lineStart, lineEnd)
  const pointVector = calculateVector(lineStart, point)
  
  const lineLength = vectorLength(lineVector)
  
  if (lineLength === 0) {
    return lineStart
  }
  
  const normalizedLine = normalizeVector(lineVector)
  const projection = dotProduct(pointVector, normalizedLine)
  
  // Clamp to line segment
  const clampedProjection = Math.max(0, Math.min(lineLength, projection))
  
  return {
    x: lineStart.x + normalizedLine.x * clampedProjection,
    y: lineStart.y + normalizedLine.y * clampedProjection
  }
}

/**
 * Calculates the distance from a point to a line segment
 */
export function distanceToLineSegment(
  point: PortPosition,
  lineStart: PortPosition,
  lineEnd: PortPosition
): number {
  const closestPoint = closestPointOnLineSegment(point, lineStart, lineEnd)
  return calculateDistance(point, closestPoint)
}

/**
 * Calculates bounds that encompass all given points
 */
export function calculateBoundingBox(points: PortPosition[]): Bounds {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y
  
  for (let i = 1; i < points.length; i++) {
    const point = points[i]
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Checks if two line segments intersect
 */
export function lineSegmentsIntersect(
  line1Start: PortPosition,
  line1End: PortPosition,
  line2Start: PortPosition,
  line2End: PortPosition
): boolean {
  const d1 = calculateCrossProduct(
    subtractVectors(line2End, line2Start),
    subtractVectors(line1Start, line2Start)
  )
  const d2 = calculateCrossProduct(
    subtractVectors(line2End, line2Start),
    subtractVectors(line1End, line2Start)
  )
  const d3 = calculateCrossProduct(
    subtractVectors(line1End, line1Start),
    subtractVectors(line2Start, line1Start)
  )
  const d4 = calculateCrossProduct(
    subtractVectors(line1End, line1Start),
    subtractVectors(line2End, line1Start)
  )
  
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  
  return false
}

/**
 * Calculates the cross product of two 2D vectors (returns scalar)
 */
export function calculateCrossProduct(v1: Vector2D, v2: Vector2D): number {
  return v1.x * v2.y - v1.y * v2.x
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/**
 * Smooth step interpolation (ease in/out)
 */
export function smoothStep(start: number, end: number, t: number): number {
  const clamped = clamp(t, 0, 1)
  const smooth = clamped * clamped * (3 - 2 * clamped)
  return lerp(start, end, smooth)
}

/**
 * Validates that all numeric values in a position are finite
 */
export function validatePosition(position: PortPosition): boolean {
  return isFinite(position.x) && isFinite(position.y)
}

/**
 * Validates that all numeric values in multiple positions are finite
 */
export function validatePositions(positions: PortPosition[]): boolean {
  return positions.every(validatePosition)
}