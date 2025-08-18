/**
 * Shape rendering utilities for different node types
 * Provides functions to generate SVG paths and dimensions for various node shapes
 */

import type { NodeShape } from '../types'

export interface ShapeDimensions {
  width: number
  height: number
  iconOffset: { x: number; y: number }
  labelOffset: { x: number; y: number }
  portOffsets: {
    input: { x: number; y: number }
    output: { x: number; y: number }
  }
  portRadius: number
  iconSize?: number
  fontSize?: number
}

export interface ShapePathData {
  d: string // SVG path data
  transform?: string // Optional transform for the shape
}

/**
 * Get shape-specific dimensions and offsets
 */
export function getShapeDimensions(
  shape: NodeShape, 
  baseWidth: number, 
  baseHeight: number
): ShapeDimensions {
  switch (shape) {
    case 'circle':
      const radius = Math.min(baseWidth, baseHeight) / 2.5 // Reduced radius significantly
      return {
        width: radius * 2,
        height: radius * 2,
        iconOffset: { x: 0, y: 3 },
        labelOffset: { x: 0, y: radius + 15 }, // Move label below the circle
        portOffsets: {
          input: { x: -radius, y: 0 },
          output: { x: radius, y: 0 }
        },
        portRadius: 6, // Smaller port radius for smaller circles
        iconSize: 32, // Smaller icon size
        fontSize: 12 // Smaller font size
      }

    case 'diamond':
      return {
        width: baseWidth,
        height: baseHeight,
        iconOffset: { x: 0, y: -5 },
        labelOffset: { x: 0, y: 15 },
        portOffsets: {
          input: { x: -baseWidth / 2, y: 0 },
          output: { x: baseWidth / 2, y: 0 }
        },
        portRadius: 6,
        iconSize: 18,
        fontSize: 12
      }

    case 'square':
      const size = Math.min(baseWidth, baseHeight) * 1.2
      const actualSquareSize = size * 0.8 // Match the path generation: halfSize = size/2 * 0.8
      return {
        width: size,
        height: size,
        iconOffset: { x: 0, y: 3 },
        labelOffset: { x: 0, y: actualSquareSize/2 + 20 }, // Move label below square
        portOffsets: {
          input: { x: -actualSquareSize / 2, y: 0 }, // Position ports inside the actual square boundary
          output: { x: actualSquareSize / 2, y: 0 }   // Position ports inside the actual square boundary
        },
        portRadius: 5,
        iconSize: 32,
        fontSize: 10
      }

    case 'rectangle':
    default:
      return {
        width: baseWidth,
        height: baseHeight,
        iconOffset: { x: 0, y: -8 },
        labelOffset: { x: 0, y: 15 },
        portOffsets: {
          input: { x: -baseWidth / 2, y: 0 },
          output: { x: baseWidth / 2, y: 0 }
        },
        portRadius: 6,
        iconSize: 18,
        fontSize: 12
      }
  }
}

/**
 * Generate SVG path data for different shapes
 */
export function getShapePath(
  shape: NodeShape, 
  width: number, 
  height: number,
  rx: number | { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number } = 8
): ShapePathData {
  const halfWidth = width / 2
  const halfHeight = height / 2

  switch (shape) {
    case 'circle':
      const radius = Math.max(width, height) / 2
      return {
        d: `M ${-radius} 0 A ${radius} ${radius} 0 1 1 ${radius} 0 A ${radius} ${radius} 0 1 1 ${-radius} 0`
      }

    case 'diamond':
      return {
        d: `M 0 ${-halfHeight * 0.75} L ${halfWidth} 0 L 0 ${halfHeight* 0.75} L ${-halfWidth} 0 Z`
      }

    case 'square':
      const halfSize = Math.max(width, height) / 2 * 0.8
      
      // Handle both uniform and asymmetric border radius
      let topLeftR = 0, topRightR = 0, bottomLeftR = 0, bottomRightR = 0
      
      if (typeof rx === 'number') {
        topLeftR = topRightR = bottomLeftR = bottomRightR = rx
      } else if (rx && typeof rx === 'object') {
        topLeftR = rx.topLeft || 0
        topRightR = rx.topRight || 0
        bottomLeftR = rx.bottomLeft || 0
        bottomRightR = rx.bottomRight || 0
      }
      
      if (topLeftR > 0 || topRightR > 0 || bottomLeftR > 0 || bottomRightR > 0) {
        return {
          d: `M ${-halfSize + topLeftR} ${-halfSize} 
              L ${halfSize - topRightR} ${-halfSize} 
              ${topRightR > 0 ? `Q ${halfSize} ${-halfSize} ${halfSize} ${-halfSize + topRightR}` : `L ${halfSize} ${-halfSize}`}
              L ${halfSize} ${halfSize - bottomRightR} 
              ${bottomRightR > 0 ? `Q ${halfSize} ${halfSize} ${halfSize - bottomRightR} ${halfSize}` : `L ${halfSize} ${halfSize}`}
              L ${-halfSize + bottomLeftR} ${halfSize} 
              ${bottomLeftR > 0 ? `Q ${-halfSize} ${halfSize} ${-halfSize} ${halfSize - bottomLeftR}` : `L ${-halfSize} ${halfSize}`}
              L ${-halfSize} ${-halfSize + topLeftR} 
              ${topLeftR > 0 ? `Q ${-halfSize} ${-halfSize} ${-halfSize + topLeftR} ${-halfSize}` : `L ${-halfSize} ${-halfSize}`} Z`
        }
      } else {
        return {
          d: `M ${-halfSize} ${-halfSize} L ${halfSize} ${-halfSize} L ${halfSize} ${halfSize} L ${-halfSize} ${halfSize} Z`
        }
      }

    case 'rectangle':
    default:
      // Handle both uniform and asymmetric border radius for rectangles
      let rectTopLeftR = 0, rectTopRightR = 0, rectBottomLeftR = 0, rectBottomRightR = 0
      
      if (typeof rx === 'number') {
        rectTopLeftR = rectTopRightR = rectBottomLeftR = rectBottomRightR = rx
      } else if (rx && typeof rx === 'object') {
        rectTopLeftR = rx.topLeft || 0
        rectTopRightR = rx.topRight || 0
        rectBottomLeftR = rx.bottomLeft || 0
        rectBottomRightR = rx.bottomRight || 0
      }
      
      if (rectTopLeftR > 0 || rectTopRightR > 0 || rectBottomLeftR > 0 || rectBottomRightR > 0) {
        return {
          d: `M ${-halfWidth + rectTopLeftR} ${-halfHeight} 
              L ${halfWidth - rectTopRightR} ${-halfHeight} 
              ${rectTopRightR > 0 ? `Q ${halfWidth} ${-halfHeight} ${halfWidth} ${-halfHeight + rectTopRightR}` : `L ${halfWidth} ${-halfHeight}`}
              L ${halfWidth} ${halfHeight - rectBottomRightR} 
              ${rectBottomRightR > 0 ? `Q ${halfWidth} ${halfHeight} ${halfWidth - rectBottomRightR} ${halfHeight}` : `L ${halfWidth} ${halfHeight}`}
              L ${-halfWidth + rectBottomLeftR} ${halfHeight} 
              ${rectBottomLeftR > 0 ? `Q ${-halfWidth} ${halfHeight} ${-halfWidth} ${halfHeight - rectBottomLeftR}` : `L ${-halfWidth} ${halfHeight}`}
              L ${-halfWidth} ${-halfHeight + rectTopLeftR} 
              ${rectTopLeftR > 0 ? `Q ${-halfWidth} ${-halfHeight} ${-halfWidth + rectTopLeftR} ${-halfHeight}` : `L ${-halfWidth} ${-halfHeight}`} Z`
        }
      } else {
        return {
          d: `M ${-halfWidth} ${-halfHeight} L ${halfWidth} ${-halfHeight} L ${halfWidth} ${halfHeight} L ${-halfWidth} ${halfHeight} Z`
        }
      }
  }
}

/**
 * Get the node shape from node type or default to rectangle
 */
export function getNodeShape(_nodeType: string, nodeTypeInfo?: { shape?: NodeShape }): NodeShape {
  return nodeTypeInfo?.shape || 'rectangle'
}

/**
 * Calculate port positions based on shape and port configuration
 */
export function getPortPositions(
  shape: NodeShape,
  dimensions: ShapeDimensions,
  portCount: number,
  portType: 'input' | 'output'
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = []
  const baseOffset = dimensions.portOffsets[portType]

  if (portCount === 0) {return positions}

  switch (shape) {
    case 'circle':
      // For circles, distribute ports around the perimeter
      const radius = dimensions.width / 2
      const angleStep = (Math.PI / 3) / Math.max(1, portCount - 1) // 60 degrees spread
      const startAngle = portType === 'input' ? Math.PI : 0 // Left side for input, right for output
      
      for (let i = 0; i < portCount; i++) {
        const angle = startAngle + (angleStep * i) - (angleStep * (portCount - 1) / 2)
        positions.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius
        })
      }
      break

    case 'diamond':
      // For diamonds, place ports along the slanted left/right edges
      // NOTE: The diamond path uses a vertical scale of 0.75 (see getShapePath),
      // so we must use the same effective height here to avoid visual mismatch.
      {
        const halfWidth = dimensions.width / 2
        const halfHeight = dimensions.height / 2
        const effectiveHalfHeight = halfHeight * 0.75

        // Distribute ports vertically, capped at 25px spacing, within the visible diamond height
        const effectiveHeight = effectiveHalfHeight * 2
        const spacing = Math.min(25, effectiveHeight / (portCount + 1))
        const startY = -(portCount - 1) * spacing / 2

        for (let i = 0; i < portCount; i++) {
          const y = startY + i * spacing
          // Edge X at vertical offset y for a diamond defined by |x|/halfWidth + |y|/effectiveHalfHeight = 1
          const widthAtY = Math.max(0, halfWidth * (1 - Math.min(1, Math.abs(y) / Math.max(1e-6, effectiveHalfHeight))))
          const xOnEdge = (portType === 'input' ? -1 : 1) * widthAtY

          positions.push({ x: xOnEdge, y })
        }
      }
      break

    case 'square':
    case 'rectangle':
    default:
      // For rectangles and squares, distribute vertically on sides
      const rectSpacing = Math.min(25, dimensions.height / (portCount + 1))
      const rectStartY = -(portCount - 1) * rectSpacing / 2
      
      for (let i = 0; i < portCount; i++) {
        positions.push({
          x: baseOffset.x,
          y: rectStartY + i * rectSpacing
        })
      }
      break
  }

  return positions
}

/**
 * Check if a point is inside a shape (for hit testing)
 */
export function isPointInShape(
  shape: NodeShape,
  point: { x: number; y: number },
  dimensions: ShapeDimensions,
  center: { x: number; y: number } = { x: 0, y: 0 }
): boolean {
  const relativeX = point.x - center.x
  const relativeY = point.y - center.y
  
  switch (shape) {
    case 'circle':
      const radius = dimensions.width / 2
      return Math.sqrt(relativeX * relativeX + relativeY * relativeY) <= radius

    case 'diamond':
  const halfWidth = dimensions.width / 2
  const halfHeight = dimensions.height / 2
  // Match getShapePath vertical scale (0.75) so hit-test equals visual diamond
  const effectiveHalfHeight = halfHeight * 0.75
  return Math.abs(relativeX / halfWidth) + Math.abs(relativeY / effectiveHalfHeight) <= 1

    case 'square':
    case 'rectangle':
    default:
      const halfW = dimensions.width / 2
      const halfH = dimensions.height / 2
      return Math.abs(relativeX) <= halfW && Math.abs(relativeY) <= halfH
  }
}