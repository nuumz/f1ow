/**
 * Path Generation Module
 * Pure functions for generating SVG connection paths between nodes
 */

import type { PortPosition } from '../types'

/**
 * Configuration for path generation
 */
export interface PathConfig {
  arrowOffset?: number
  controlOffsetMin?: number
  smoothingFactor?: number
}

/**
 * Default path configuration
 */
const DEFAULT_PATH_CONFIG: Required<PathConfig> = {
  arrowOffset: 7,
  controlOffsetMin: 60,
  smoothingFactor: 2.5
}

/**
 * Types of connection flows for different path algorithms
 */
export type ConnectionFlow = 'horizontal' | 'vertical' | 'bottom-to-input'

/**
 * Determines the connection flow type based on port types
 */
export function getConnectionFlow(
  isSourceBottomPort: boolean
): ConnectionFlow {
  if (isSourceBottomPort) {
    return 'bottom-to-input'
  }
  return 'horizontal'
}

/**
 * Calculates adjusted target position accounting for arrow markers
 */
export function calculateArrowAdjustedPosition(
  source: PortPosition,
  target: PortPosition,
  arrowOffset: number = DEFAULT_PATH_CONFIG.arrowOffset
): PortPosition {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (distance === 0) {
    return target
  }
  
  const offsetRatio = arrowOffset / distance
  return {
    x: target.x - (dx * offsetRatio),
    y: target.y - (dy * offsetRatio)
  }
}

/**
 * Generates control points for horizontal flow connections
 */
export function generateHorizontalControlPoints(
  source: PortPosition,
  target: PortPosition,
  config: Required<PathConfig>
): { cp1: PortPosition; cp2: PortPosition } {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const controlOffset = Math.max(Math.abs(dx) / config.smoothingFactor, config.controlOffsetMin)
  
  return {
    cp1: {
      x: source.x + controlOffset,
      y: source.y + dy * 0.1
    },
    cp2: {
      x: target.x - controlOffset,
      y: target.y - dy * 0.1
    }
  }
}

/**
 * Generates control points for bottom port to input connections
 */
export function generateBottomToInputControlPoints(
  source: PortPosition,
  target: PortPosition,
  config: Required<PathConfig>
): { cp1: PortPosition; cp2: PortPosition } {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const controlOffset = Math.max(Math.abs(dy) / config.smoothingFactor, config.controlOffsetMin)
  
  return {
    cp1: {
      x: source.x, // Keep same x position (straight down)
      y: source.y + controlOffset
    },
    cp2: {
      x: target.x,
      y: target.y - Math.max(Math.abs(dx) / config.smoothingFactor, 40)
    }
  }
}

/**
 * Generates a cubic Bezier curve SVG path
 */
export function generateCubicBezierPath(
  source: PortPosition,
  target: PortPosition,
  cp1: PortPosition,
  cp2: PortPosition
): string {
  return `M ${source.x} ${source.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${target.x} ${target.y}`
}

/**
 * Core path generation function with flow-specific algorithms
 */
export function generateConnectionPath(
  sourcePos: PortPosition,
  targetPos: PortPosition,
  flow: ConnectionFlow,
  config: PathConfig = {}
): string {
  const fullConfig = { ...DEFAULT_PATH_CONFIG, ...config }
  
  // Calculate arrow-adjusted target position
  const adjustedTarget = calculateArrowAdjustedPosition(sourcePos, targetPos, fullConfig.arrowOffset)
  
  // Generate control points based on flow type
  let controlPoints: { cp1: PortPosition; cp2: PortPosition }
  
  switch (flow) {
    case 'bottom-to-input':
      controlPoints = generateBottomToInputControlPoints(sourcePos, adjustedTarget, fullConfig)
      break
    case 'horizontal':
    default:
      controlPoints = generateHorizontalControlPoints(sourcePos, adjustedTarget, fullConfig)
      break
  }
  
  return generateCubicBezierPath(sourcePos, adjustedTarget, controlPoints.cp1, controlPoints.cp2)
}

/**
 * Generates an orthogonal (Manhattan) path with rounded 90° corners between two points.
 * Used primarily in architecture mode for a blueprint / schematic feel.
 * Algorithm assumptions:
 *  - Axis-aligned L or Z shape with at most two bends
 *  - We pick horizontal-first if |dx| > |dy| else vertical-first to reduce crossings
 *  - Each corner replaced by a quarter-circle (implemented via quadratic Bézier for simplicity)
 */
export interface OrthogonalPathOptions {
  sourceBox?: { x: number; y: number; width: number; height: number }
  targetBox?: { x: number; y: number; width: number; height: number }
  strategy?: 'auto' | 'horizontal-first' | 'vertical-first'
  allowDoubleBend?: boolean // fallback to old two-corner style when true
  minSegment?: number // minimum straight segment length before corner
}

export function generateOrthogonalRoundedPath(
  source: PortPosition,
  target: PortPosition,
  radius = 14,
  options?: OrthogonalPathOptions
): string {
  const opts: Required<Pick<OrthogonalPathOptions, 'strategy' | 'allowDoubleBend' | 'minSegment'>> = {
    strategy: options?.strategy || 'auto',
    allowDoubleBend: options?.allowDoubleBend ?? false,
    minSegment: options?.minSegment ?? 12
  }

  // If node boxes provided and source/target are inside, project to nearest side facing the other point
  const projectPointToBoxSide = (
    point: PortPosition,
    box: { x: number; y: number; width: number; height: number },
    toward: PortPosition
  ): PortPosition => {
    // If already outside box, return as-is
    if (point.x < box.x || point.x > box.x + box.width || point.y < box.y || point.y > box.y + box.height) {
      return point
    }
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const dx = toward.x - cx
    const dy = toward.y - cy
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const pad = Math.min(Math.max(radius, 4), Math.min(box.width, box.height) / 2)
    if (absDx >= absDy) {
      // Exit left or right
      if (dx >= 0) {
        return { x: box.x + box.width, y: Math.min(box.y + box.height - pad, Math.max(box.y + pad, point.y)) }
      } else {
        return { x: box.x, y: Math.min(box.y + box.height - pad, Math.max(box.y + pad, point.y)) }
      }
    } else {
      // Exit top or bottom
      if (dy >= 0) {
        return { y: box.y + box.height, x: Math.min(box.x + box.width - pad, Math.max(box.x + pad, point.x)) }
      } else {
        return { y: box.y, x: Math.min(box.x + box.width - pad, Math.max(box.x + pad, point.x)) }
      }
    }
  }

  let start = source
  let end = target
  if (options?.sourceBox) start = projectPointToBoxSide(source, options.sourceBox, target)
  if (options?.targetBox) end = projectPointToBoxSide(target, options.targetBox, start)

  let dx = end.x - start.x
  let dy = end.y - start.y

  // Degenerate line
  if (dx === 0 || dy === 0) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  }

  let horizontalFirst: boolean
  switch (opts.strategy) {
    case 'horizontal-first':
      horizontalFirst = true; break
    case 'vertical-first':
      horizontalFirst = false; break
    default:
      horizontalFirst = Math.abs(dx) >= Math.abs(dy)
  }

  // Single-corner path (preferred) or double-bend fallback
  if (!opts.allowDoubleBend) {
    // Corner point
    const corner = horizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y }
    // Compute effective radius limited by segment lengths
    const seg1Len = horizontalFirst ? Math.abs(corner.x - start.x) : Math.abs(corner.y - start.y)
    const seg2Len = horizontalFirst ? Math.abs(end.y - corner.y) : Math.abs(end.x - corner.x)
    let r = Math.min(radius, seg1Len / 2, seg2Len / 2)
    if (r < 4) r = Math.min(4, radius)

    // Entry & exit points around corner
    let entry: PortPosition
    let exit: PortPosition
    if (horizontalFirst) {
      entry = { x: corner.x - Math.sign(dx) * r, y: corner.y }
      exit = { x: corner.x, y: corner.y + Math.sign(dy) * r }
    } else {
      entry = { x: corner.x, y: corner.y - Math.sign(dy) * r }
      exit = { x: corner.x + Math.sign(dx) * r, y: corner.y }
    }
    return [
      `M ${start.x} ${start.y}`,
      horizontalFirst ? `L ${entry.x} ${entry.y}` : `L ${entry.x} ${entry.y}`,
      `Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`,
      `L ${end.x} ${end.y}`
    ].join(' ')
  }

  // Double-bend legacy style (original implementation) ------------------
  const originalSource = start
  const originalTarget = end
  dx = originalTarget.x - originalSource.x
  dy = originalTarget.y - originalSource.y
  const midPrimary = horizontalFirst ? originalSource.x + dx / 2 : originalSource.y + dy / 2
  const p1 = horizontalFirst ? { x: midPrimary, y: originalSource.y } : { x: originalSource.x, y: midPrimary }
  const p2 = horizontalFirst ? { x: midPrimary, y: originalTarget.y } : { x: originalTarget.x, y: midPrimary }

  function cornerSegment(prev: PortPosition, corner: PortPosition, next: PortPosition): string {
    const vxIn = Math.sign(corner.x - prev.x)
    const vyIn = Math.sign(corner.y - prev.y)
    const vxOut = Math.sign(next.x - corner.x)
    const vyOut = Math.sign(next.y - corner.y)
    const segInLen = Math.abs(corner.x - prev.x) + Math.abs(corner.y - prev.y)
    const segOutLen = Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y)
    const effR = Math.min(radius, segInLen / 2, segOutLen / 2)
    const entry: PortPosition = {
      x: corner.x - vxIn * effR * (vxIn !== 0 ? 1 : 0),
      y: corner.y - vyIn * effR * (vyIn !== 0 ? 1 : 0)
    }
    const exit: PortPosition = {
      x: corner.x + vxOut * effR * (vxOut !== 0 ? 1 : 0),
      y: corner.y + vyOut * effR * (vyOut !== 0 ? 1 : 0)
    }
    return `L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`
  }
  return [
    `M ${originalSource.x} ${originalSource.y}`,
    cornerSegment(originalSource, p1, p2),
    cornerSegment(p1, p2, originalTarget),
    `L ${originalTarget.x} ${originalTarget.y}`
  ].join(' ')
}

// Adaptive multi-bend router -------------------------------------------------
export interface AdaptivePathOptions extends OrthogonalPathOptions {
  obstacles?: Array<{ x: number; y: number; width: number; height: number }>
  clearance?: number // extra spacing around obstacles
  maxBends?: number // safety cap
}

function rectIntersectsSegment(
  rect: { x: number; y: number; width: number; height: number },
  a: PortPosition,
  b: PortPosition
): boolean {
  // Axis-aligned only (we only produce horizontal / vertical segments)
  if (a.x === b.x) {
    // vertical segment
    const x = a.x
    if (x < rect.x || x > rect.x + rect.width) return false
    const y1 = Math.min(a.y, b.y)
    const y2 = Math.max(a.y, b.y)
    return !(y2 < rect.y || y1 > rect.y + rect.height)
  } else if (a.y === b.y) {
    // horizontal segment
    const y = a.y
    if (y < rect.y || y > rect.y + rect.height) return false
    const x1 = Math.min(a.x, b.x)
    const x2 = Math.max(a.x, b.x)
    return !(x2 < rect.x || x1 > rect.x + rect.width)
  }
  return false
}

function inflateRect(r: {x:number;y:number;width:number;height:number}, pad: number) {
  return { x: r.x - pad, y: r.y - pad, width: r.width + pad*2, height: r.height + pad*2 }
}

function buildRoundedPath(points: PortPosition[], radius: number): string {
  if (points.length < 2) return ''
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i-1]
    const corner = points[i]
    const next = points[i+1]
    const vxIn = Math.sign(corner.x - prev.x)
    const vyIn = Math.sign(corner.y - prev.y)
    const vxOut = Math.sign(next.x - corner.x)
    const vyOut = Math.sign(next.y - corner.y)
    const segInLen = Math.abs(corner.x - prev.x) + Math.abs(corner.y - prev.y)
    const segOutLen = Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y)
    const r = Math.min(radius, segInLen/2, segOutLen/2)
    const entry: PortPosition = { x: corner.x - vxIn * r * (vxIn!==0?1:0), y: corner.y - vyIn * r * (vyIn!==0?1:0) }
    const exit: PortPosition = { x: corner.x + vxOut * r * (vxOut!==0?1:0), y: corner.y + vyOut * r * (vyOut!==0?1:0) }
    parts.push(`L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`)
  }
  const last = points[points.length - 1]
  parts.push(`L ${last.x} ${last.y}`)
  return parts.join(' ')
}

export function generateAdaptiveOrthogonalRoundedPath(
  source: PortPosition,
  target: PortPosition,
  radius = 14,
  options?: AdaptivePathOptions
): string {
  const obstacles = (options?.obstacles || [])
    .map(o => options?.clearance ? inflateRect(o, options.clearance) : o)
  const maxBends = options?.maxBends ?? 4

  // Derive anchor points via existing projection if boxes provided
  let start = source
  let end = target
  if (options?.sourceBox) {
    start = generateOrthogonalRoundedPath(source, target, radius, { ...options, allowDoubleBend: false })
      ? source : source // placeholder (reuse projection util below instead of parsing path)
  }
  // We'll reuse project logic by calling internal projection from previous function: replicate minimal part
  const project = (
    point: PortPosition,
    box?: {x:number;y:number;width:number;height:number},
    toward?: PortPosition
  ) => {
    if (!box || !toward) return point
    if (point.x < box.x || point.x > box.x+box.width || point.y < box.y || point.y > box.y+box.height) return point
    const cx = box.x + box.width/2
    const cy = box.y + box.height/2
    const dx = toward.x - cx
    const dy = toward.y - cy
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const pad = Math.min(Math.max(radius,4), Math.min(box.width, box.height)/2)
    if (absDx >= absDy) {
      if (dx >= 0) return { x: box.x + box.width, y: Math.min(box.y+box.height-pad, Math.max(box.y+pad, point.y)) }
      return { x: box.x, y: Math.min(box.y+box.height-pad, Math.max(box.y+pad, point.y)) }
    } else {
      if (dy >= 0) return { y: box.y + box.height, x: Math.min(box.x+box.width-pad, Math.max(box.x+pad, point.x)) }
      return { y: box.y, x: Math.min(box.x+box.width-pad, Math.max(box.x+pad, point.x)) }
    }
  }
  if (options?.sourceBox) start = project(start, options.sourceBox, target)
  if (options?.targetBox) end = project(end, options.targetBox, start)

  // Determine which side of the boxes we exited/entered (if boxes provided) so we can decide bend count.
  type Side = 'left' | 'right' | 'top' | 'bottom' | 'none'
  const detectSide = (pt: PortPosition, box?: {x:number;y:number;width:number;height:number}): Side => {
    if (!box) return 'none'
    const eps = 0.5
    if (Math.abs(pt.x - box.x) < eps) return 'left'
    if (Math.abs(pt.x - (box.x + box.width)) < eps) return 'right'
    if (Math.abs(pt.y - box.y) < eps) return 'top'
    if (Math.abs(pt.y - (box.y + box.height)) < eps) return 'bottom'
    return 'none'
  }
  const startSide = detectSide(start, options?.sourceBox)
  const endSide = detectSide(end, options?.targetBox)
  const startOrientation: 'horizontal' | 'vertical' | 'none' = (startSide === 'left' || startSide === 'right') ? 'horizontal' : (startSide === 'top' || startSide === 'bottom') ? 'vertical' : 'none'
  const endOrientation: 'horizontal' | 'vertical' | 'none' = (endSide === 'left' || endSide === 'right') ? 'horizontal' : (endSide === 'top' || endSide === 'bottom') ? 'vertical' : 'none'

  // Base attempt: single bend
  const horizontalFirst = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
  let candidatePoints: PortPosition[] = []

  // If both orientations are the same (both horizontal exits or both vertical) and positions require change on the orthogonal axis,
  // we prefer a TWO-BEND path: start -> mid dogleg -> turn -> end, yielding two rounded corners for clearer schematic shape.
  if (startOrientation !== 'none' && startOrientation === endOrientation) {
    if (startOrientation === 'horizontal') {
      if (Math.abs(start.y - end.y) < 0.5) {
        // Aligned horizontally, straight line is fine
        candidatePoints = [start, end]
      } else {
        const midX = (start.x + end.x) / 2
        candidatePoints = [
          start,
          { x: midX, y: start.y },
          { x: midX, y: end.y },
          end
        ]
      }
    } else { // vertical orientation
      if (Math.abs(start.x - end.x) < 0.5) {
        candidatePoints = [start, end]
      } else {
        const midY = (start.y + end.y) / 2
        candidatePoints = [
          start,
          { x: start.x, y: midY },
          { x: end.x, y: midY },
          end
        ]
      }
    }
  }

  // If not filled (different orientation or boxes missing), fallback to single-corner L-shape candidate.
  if (candidatePoints.length === 0) {
    candidatePoints = [start]
    const corner = horizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y }
    candidatePoints.push(corner)
    candidatePoints.push(end)
  }

  const hasObstacleIntersection = () => {
    for (let i = 0; i < candidatePoints.length -1; i++) {
      const a = candidatePoints[i]
      const b = candidatePoints[i+1]
      for (const ob of obstacles) {
        if (rectIntersectsSegment(ob, a, b)) return true
      }
    }
    return false
  }

  if (!hasObstacleIntersection()) {
    return buildRoundedPath(candidatePoints, radius)
  }

  // Introduce dogleg: push path outward along primary axis
  const dirX = Math.sign(end.x - start.x) || 1
  const dirY = Math.sign(end.y - start.y) || 1
  const offset = Math.max(40, radius * 3)
  const doglegPoints: PortPosition[] = [start]
  if (horizontalFirst) {
    const midX = start.x + dirX * offset
    doglegPoints.push({ x: midX, y: start.y })
    doglegPoints.push({ x: midX, y: end.y })
  } else {
    const midY = start.y + dirY * offset
    doglegPoints.push({ x: start.x, y: midY })
    doglegPoints.push({ x: end.x, y: midY })
  }
  doglegPoints.push(end)

  // If still intersecting and allowed more bends, attempt secondary lateral shift
  const checkAndMaybeSecondary = () => {
    const intersects = () => {
      for (let i=0;i<doglegPoints.length-1;i++) {
        const a = doglegPoints[i]; const b = doglegPoints[i+1]
        for (const ob of obstacles) if (rectIntersectsSegment(ob,a,b)) return true
      }
      return false
    }
    if (!intersects()) return true
    if (maxBends <= 3) return false
    const extraOffset = offset * 1.6
    if (horizontalFirst) {
      const extraX = start.x + dirX * extraOffset
      doglegPoints.splice(1,0,{ x: extraX, y: start.y })
      doglegPoints.splice(doglegPoints.length-1,0,{ x: extraX, y: end.y })
    } else {
      const extraY = start.y + dirY * extraOffset
      doglegPoints.splice(1,0,{ x: start.x, y: extraY })
      doglegPoints.splice(doglegPoints.length-1,0,{ x: end.x, y: extraY })
    }
    return !intersects()
  }
  checkAndMaybeSecondary()

  return buildRoundedPath(doglegPoints, radius)
}

/**
 * Generates path for connection preview (mouse following)
 */
export function generatePreviewPath(
  sourcePos: PortPosition,
  previewPos: PortPosition,
  flow: ConnectionFlow,
  config: PathConfig = {}
): string {
  return generateConnectionPath(sourcePos, previewPos, flow, config)
}

/**
 * Generates offset path for multiple connections
 */
export function generateOffsetPath(
  sourcePos: PortPosition,
  targetPos: PortPosition,
  offsetY: number,
  config: PathConfig = {}
): string {
  const fullConfig = { ...DEFAULT_PATH_CONFIG, ...config }
  
  // Apply offset to both positions
  const offsetSource: PortPosition = { x: sourcePos.x, y: sourcePos.y + offsetY }
  const offsetTarget: PortPosition = { x: targetPos.x, y: targetPos.y + offsetY }
  
  // Use horizontal flow for offset connections
  return generateConnectionPath(offsetSource, offsetTarget, 'horizontal', fullConfig)
}

/**
 * Calculates Y offset for multiple connections
 */
export function calculateConnectionOffset(
  connectionIndex: number,
  totalConnections: number,
  spacing: number = 15
): number {
  if (totalConnections <= 1) {
    return 0
  }
  
  if (totalConnections === 2) {
    // For 2 connections: one above center, one below center
    return connectionIndex === 0 ? -spacing / 2 : spacing / 2
  }
  
  // For 3+ connections: spread them out evenly
  const totalSpacing = spacing * (totalConnections - 1)
  return (connectionIndex * spacing) - (totalSpacing / 2)
}

/**
 * Validates path generation inputs
 */
export function validatePathInputs(source: PortPosition, target: PortPosition): boolean {
  return (
    isFinite(source.x) && isFinite(source.y) &&
    isFinite(target.x) && isFinite(target.y)
  )
}