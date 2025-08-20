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

// Type aliases for better code readability
type BoxSide = 'left' | 'right' | 'top' | 'bottom' | 'none'
type Orientation = 'horizontal' | 'vertical' | 'none'

// Centralized fixed lead length (was previously duplicated as 30 / 50)
// Keep existing current visual of 50px leads for orthogonal styles to avoid regression.
export const FIXED_LEAD_LENGTH = 50

/**
 * Calculate adaptive lead length based on total available distance for nearby nodes
 */
function getAdaptiveLeadLength(totalDistance: number, requestedFixed: number): number {
  // If total distance is less than 2 * FIXED_LEAD_LENGTH, distribute proportionally
  if (totalDistance < requestedFixed * 2) {
    // Use 25% of total distance for each lead, but minimum 10px
    return Math.max(10, totalDistance * 0.25)
  }
  return requestedFixed
}

// ---------------------------------------------------------------------------
// Shared internal helpers
// ---------------------------------------------------------------------------


/** Project a point that is inside a box to the nearest side facing the toward point */
function projectPointToBoxSide(
  point: PortPosition,
  box: { x: number; y: number; width: number; height: number },
  toward: PortPosition,
  radius: number
): PortPosition {
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

  // Add extra clearance for arrow markers to prevent overlap
  const arrowClearance = 8; // Slightly increased space for arrow marker to avoid overlap

  if (absDx >= absDy) {
    if (dx >= 0) {
      return { x: box.x + box.width + arrowClearance, y: Math.min(box.y + box.height - pad, Math.max(box.y + pad, point.y)) }
    }
    return { x: box.x - arrowClearance, y: Math.min(box.y + box.height - pad, Math.max(box.y + pad, point.y)) }
  }
  if (dy >= 0) {
    return { y: box.y + box.height + arrowClearance, x: Math.min(box.x + box.width - pad, Math.max(box.x + pad, point.x)) }
  }
  return { y: box.y - arrowClearance, x: Math.min(box.x + box.width - pad, Math.max(box.x + pad, point.x)) }
}

/** Build a sharp orthogonal (Manhattan) SVG path from ordered waypoints */
function buildSharpOrthogonalPath(points: PortPosition[]): string {
  if (points.length < 2) { return '' }
  return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
}

/** Build an orthogonal SVG path with rounded corners from ordered waypoints */
function buildRoundedOrthogonalPath(points: PortPosition[], radius = 10, minSegment = 10): string {
  if (points.length < 2) { return '' }
  if (points.length === 2) {
    // No bends – straight line
    const [a, b] = points
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`
  }

  const cmds: string[] = []
  const first = points[0]
  cmds.push(`M ${first.x} ${first.y}`)

  // Track the last point we emitted (after the previous corner's exit)
  let lastOut: PortPosition | null = null

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]

    const isPrevVert = prev.x === corner.x
    const isPrevHorz = prev.y === corner.y
    const isNextVert = next.x === corner.x
    const isNextHorz = next.y === corner.y

    // If any segment is not axis-aligned, fallback to sharp path for safety
    if ((!isPrevVert && !isPrevHorz) || (!isNextVert && !isNextHorz)) {
      return buildSharpOrthogonalPath(points)
    }

    const inLen = isPrevVert ? Math.abs(corner.y - prev.y) : Math.abs(corner.x - prev.x)
    const outLen = isNextVert ? Math.abs(next.y - corner.y) : Math.abs(next.x - corner.x)
    // Effective radius limited by segment lengths to avoid overshoot
    const effR = Math.max(0, Math.min(radius, Math.max(0, inLen / 2 - 1), Math.max(0, outLen / 2 - 1)))

    // If segments are too short, emit a sharp corner
    if (effR < Math.max(2, minSegment / 4)) {
      // Ensure continuous line from previous emission
      const moveFrom: PortPosition = lastOut ?? prev
      if (!(moveFrom.x === corner.x && moveFrom.y === corner.y)) {
        cmds.push(`L ${corner.x} ${corner.y}`)
      }
      lastOut = corner
      continue
    }

    // Entry point by retracting effR from corner along inbound axis
    let entry: PortPosition
    if (isPrevVert) {
      const dir = Math.sign(corner.y - prev.y) || 1
      entry = { x: corner.x, y: corner.y - dir * effR }
    } else { // inbound horizontal
      const dir = Math.sign(corner.x - prev.x) || 1
      entry = { x: corner.x - dir * effR, y: corner.y }
    }

    // Exit point by advancing effR from corner along outbound axis
    let exit: PortPosition
    if (isNextVert) {
      const dir = Math.sign(next.y - corner.y) || 1
      exit = { x: corner.x, y: corner.y + dir * effR }
    } else { // outbound horizontal
      const dir = Math.sign(next.x - corner.x) || 1
      exit = { x: corner.x + dir * effR, y: corner.y }
    }

    // Draw line up to entry, then a quadratic curve at the corner to exit
    const moveFrom: PortPosition = lastOut ?? prev
    if (!(moveFrom.x === entry.x && moveFrom.y === entry.y)) {
      cmds.push(`L ${entry.x} ${entry.y}`)
    }
    cmds.push(`Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`)
    lastOut = exit
  }

  const last = points[points.length - 1]
  // Continue from lastOut (if any) to last point
  const tailFrom = lastOut ?? points[points.length - 2]
  if (!(tailFrom.x === last.x && tailFrom.y === last.y)) {
    cmds.push(`L ${last.x} ${last.y}`)
  }

  return cmds.join(' ')
}

// Public lightweight facade so callers with explicit waypoints (e.g., U-shape) can reuse identical rounding
export function buildRoundedPathFromPoints(points: PortPosition[], radius = 10): string {
  return buildRoundedOrthogonalPath(points, radius)
}

/** Enforce adaptive lead segments based on total available distance for nearby nodes */
function enforceFixedSegments(
  pts: PortPosition[],
  fixed = FIXED_LEAD_LENGTH,
  enforceEnd = true
): PortPosition[] {
  if (pts.length < 3) { return pts }
  const cloned = pts.map(p => ({ ...p }))
  const start = cloned[0]
  const first = cloned[1]
  const preEnd = cloned[cloned.length - 2]
  const end = cloned[cloned.length - 1]

  // Use shared adaptive lead length calculation

  // Start segment normalization
  if (start.x === first.x) { // vertical
    const dir = Math.sign(first.y - start.y) || 1
    const totalLen = Math.abs(end.y - start.y)
    const adaptiveFixed = getAdaptiveLeadLength(totalLen, fixed)
    const len = Math.abs(first.y - start.y)
    if (len > adaptiveFixed) { first.y = start.y + dir * adaptiveFixed }
  } else if (start.y === first.y) { // horizontal
    const dir = Math.sign(first.x - start.x) || 1
    const totalLen = Math.abs(end.x - start.x)
    const adaptiveFixed = getAdaptiveLeadLength(totalLen, fixed)
    const len = Math.abs(first.x - start.x)
    if (len > adaptiveFixed) { first.x = start.x + dir * adaptiveFixed }
  }

  if (enforceEnd && cloned.length > 3) {
    if (preEnd.x === end.x) { // vertical end approach
      const dir = Math.sign(preEnd.y - end.y) || 1
      const totalLen = Math.abs(end.y - start.y)
      const adaptiveFixed = getAdaptiveLeadLength(totalLen, fixed)
      const len = Math.abs(end.y - preEnd.y)
      if (len > adaptiveFixed) { preEnd.y = end.y + dir * adaptiveFixed }
    } else if (preEnd.y === end.y) { // horizontal end approach
      const dir = Math.sign(preEnd.x - end.x) || 1
      const totalLen = Math.abs(end.x - start.x)
      const adaptiveFixed = getAdaptiveLeadLength(totalLen, fixed)
      const len = Math.abs(end.x - preEnd.x)
      if (len > adaptiveFixed) { preEnd.x = end.x + dir * adaptiveFixed }
    }
  }
  return cloned
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

/**
 * Generates an orthogonal (Manhattan) SVG path with rounded 90° corners between two points.
 * Useful for schematic or blueprint-style connections, supporting single or double bends.
 *
 * @param source - The starting port position.
 * @param target - The ending port position.
 * @param radius - The corner radius for rounded bends.
 * @param options - Additional options for routing and box projections.
 * @returns SVG path string for the orthogonal rounded connection.
 */
export function generateOrthogonalRoundedPath(
  source: PortPosition,
  target: PortPosition,
  radius = 14,
  options?: OrthogonalPathOptions
): string {
  const fixedLead = FIXED_LEAD_LENGTH
  const opts: Required<Pick<OrthogonalPathOptions, 'strategy' | 'allowDoubleBend' | 'minSegment'>> = {
    strategy: options?.strategy || 'auto',
    allowDoubleBend: options?.allowDoubleBend ?? false,
    minSegment: options?.minSegment ?? 12
  }

  const start = options?.sourceBox ? projectPointToBoxSide(source, options.sourceBox, target, radius) : source
  const end = options?.targetBox ? projectPointToBoxSide(target, options.targetBox, start, radius) : target

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
    const axisSpan = horizontalFirst ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y)
    const straightSegmentLength = clampLeadLength(axisSpan, radius, fixedLead)

    // Calculate intermediate points with fixed straight segments
    let startExtended: PortPosition
    let endExtended: PortPosition

    if (horizontalFirst) {
      // For horizontal-first: extend horizontally from start, then extend horizontally to end
      startExtended = { x: start.x + Math.sign(dx) * straightSegmentLength, y: start.y }
      endExtended = { x: end.x - Math.sign(dx) * straightSegmentLength, y: end.y }
    } else {
      // For vertical-first: extend vertically from start, then extend vertically to end
      startExtended = { x: start.x, y: start.y + Math.sign(dy) * straightSegmentLength }
      endExtended = { x: end.x, y: end.y - Math.sign(dy) * straightSegmentLength }
    }

    // Corner point between the extended segments
    const corner = horizontalFirst ? { x: endExtended.x, y: startExtended.y } : { x: startExtended.x, y: endExtended.y }

    // Compute effective radius limited by segment lengths
    const seg1Len = horizontalFirst ? Math.abs(corner.x - startExtended.x) : Math.abs(corner.y - startExtended.y)
    const seg2Len = horizontalFirst ? Math.abs(endExtended.y - corner.y) : Math.abs(endExtended.x - corner.x)
    const r = Math.max(4, Math.min(radius, seg1Len / 2, seg2Len / 2))

    // Entry & exit points around corner
    let entry: PortPosition
    let exit: PortPosition
    if (horizontalFirst) {
      const cornerDx = corner.x - startExtended.x
      const cornerDy = endExtended.y - corner.y
      entry = { x: corner.x - Math.sign(cornerDx) * r, y: corner.y }
      exit = { x: corner.x, y: corner.y + Math.sign(cornerDy) * r }
    } else {
      const cornerDy = corner.y - startExtended.y
      const cornerDx = endExtended.x - corner.x
      entry = { x: corner.x, y: corner.y - Math.sign(cornerDy) * r }
      exit = { x: corner.x + Math.sign(cornerDx) * r, y: corner.y }
    }

    return [
      `M ${start.x} ${start.y}`,
      `L ${startExtended.x} ${startExtended.y}`,
      `L ${entry.x} ${entry.y}`,
      `Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`,
      `L ${endExtended.x} ${endExtended.y}`,
      `L ${end.x} ${end.y}`
    ].join(' ')
  }

  // Double-bend legacy style (original implementation) ------------------
  const originalSource = start
  const originalTarget = end
  dx = originalTarget.x - originalSource.x
  dy = originalTarget.y - originalSource.y
  // Fixed straight segments from start and end with clamping similar to single-bend
  const axisSpan = horizontalFirst ? Math.abs(originalTarget.x - originalSource.x) : Math.abs(originalTarget.y - originalSource.y)
  const straightSegmentLength = clampLeadLength(axisSpan, radius, fixedLead)

  // Calculate extended points with 50px straight segments
  let startExtended: PortPosition
  let endExtended: PortPosition

  if (horizontalFirst) {
    startExtended = { x: originalSource.x + Math.sign(dx) * straightSegmentLength, y: originalSource.y }
    endExtended = { x: originalTarget.x - Math.sign(dx) * straightSegmentLength, y: originalTarget.y }
  } else {
    startExtended = { x: originalSource.x, y: originalSource.y + Math.sign(dy) * straightSegmentLength }
    endExtended = { x: originalTarget.x, y: originalTarget.y - Math.sign(dy) * straightSegmentLength }
  }

  // Calculate midpoint between extended segments
  const extendedDx = endExtended.x - startExtended.x
  const extendedDy = endExtended.y - startExtended.y
  const midPrimary = horizontalFirst ? startExtended.x + extendedDx / 2 : startExtended.y + extendedDy / 2
  const p1 = horizontalFirst ? { x: midPrimary, y: startExtended.y } : { x: startExtended.x, y: midPrimary }
  const p2 = horizontalFirst ? { x: midPrimary, y: endExtended.y } : { x: endExtended.x, y: midPrimary }

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
    `L ${startExtended.x} ${startExtended.y}`,
    cornerSegment(startExtended, p1, p2),
    cornerSegment(p1, p2, endExtended),
    `L ${endExtended.x} ${endExtended.y}`,
    `L ${originalTarget.x} ${originalTarget.y}`
  ].join(' ')
}

// Adaptive multi-bend router -------------------------------------------------
export interface AdaptivePathOptions extends OrthogonalPathOptions {
  obstacles?: Array<{ x: number; y: number; width: number; height: number }>
  clearance?: number // extra spacing around obstacles
  maxBends?: number // safety cap
  // Overrides to force initial/final segment orientation without projecting to box sides
  startOrientationOverride?: Orientation
  endOrientationOverride?: Orientation
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
    if (x < rect.x || x > rect.x + rect.width) { return false }
    const y1 = Math.min(a.y, b.y)
    const y2 = Math.max(a.y, b.y)
    return !(y2 < rect.y || y1 > rect.y + rect.height)
  } else if (a.y === b.y) {
    // horizontal segment
    const y = a.y
    if (y < rect.y || y > rect.y + rect.height) { return false }
    const x1 = Math.min(a.x, b.x)
    const x2 = Math.max(a.x, b.x)
    return !(x2 < rect.x || x1 > rect.x + rect.width)
  }
  return false
}

function inflateRect(r: { x: number; y: number; width: number; height: number }, pad: number) {
  return { x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 }
}

// Rounded path helper reinstated for adaptive variant per spec (FR-ARCH-ROUTING)

export function generateAdaptiveOrthogonalRoundedPath(
  source: PortPosition,
  target: PortPosition,
  radius = 10,
  options?: AdaptivePathOptions
): string {
  // Reuse shared helpers and emit rounded-corner orthogonal paths

  const obstacles = (options?.obstacles || [])
    .map(o => options?.clearance ? inflateRect(o, options.clearance) : o)
  const maxBends = options?.maxBends ?? 4

  // Derive anchor points via existing projection if boxes provided
  let start = source
  let end = target
  if (options?.sourceBox) { start = projectPointToBoxSide(start, options.sourceBox, target, radius) }
  if (options?.targetBox) { end = projectPointToBoxSide(end, options.targetBox, start, radius) }

  // Determine which side of the boxes we exited/entered (if boxes provided) so we can decide bend count.
  const startSide = detectBoxSide(start, options?.sourceBox)
  const endSide = detectBoxSide(end, options?.targetBox)
  const startOrientation = options?.startOrientationOverride ?? getOrientationFromSide(startSide)
  const endOrientation = options?.endOrientationOverride ?? getOrientationFromSide(endSide)

  // Base attempt: single bend
  const candidatePoints = generateCandidatePoints(start, end, startOrientation, endOrientation)

  if (!hasObstacleIntersection(candidatePoints, obstacles)) {
    // Custom rule: if start port exits from left/right side (horizontal orientation) enforce first fixed horizontal segment.
    const FIXED = FIXED_LEAD_LENGTH
    const orientedPoints = handleOrientedRouting(start, end, startOrientation, endOrientation, FIXED)
    if (orientedPoints) {
      return buildRoundedOrthogonalPath(orientedPoints, radius)
    }

    // General case (non-horizontal start) keeps previous behavior with fixed length enforcement.
    if (candidatePoints.length >= 3) {
      return buildRoundedOrthogonalPath(enforceFixedSegments(candidatePoints, FIXED_LEAD_LENGTH, true), radius)
    }
    return buildRoundedOrthogonalPath(candidatePoints, radius)
  }

  // Introduce dogleg: push path outward along primary axis
  const horizontalFirst = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
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
      for (let i = 0; i < doglegPoints.length - 1; i++) {
        const a = doglegPoints[i]; const b = doglegPoints[i + 1]
        for (const ob of obstacles) { if (rectIntersectsSegment(ob, a, b)) { return true } }
      }
      return false
    }
    if (!intersects()) { return true }
    if (maxBends <= 3) { return false }
    const extraOffset = offset * 1.6
    if (horizontalFirst) {
      const extraX = start.x + dirX * extraOffset
      doglegPoints.splice(1, 0, { x: extraX, y: start.y })
      doglegPoints.splice(doglegPoints.length - 1, 0, { x: extraX, y: end.y })
    } else {
      const extraY = start.y + dirY * extraOffset
      doglegPoints.splice(1, 0, { x: start.x, y: extraY })
      doglegPoints.splice(doglegPoints.length - 1, 0, { x: end.x, y: extraY })
    }
    return !intersects()
  }
  checkAndMaybeSecondary()

  if (doglegPoints.length >= 3) {
    return buildRoundedOrthogonalPath(enforceFixedSegments(doglegPoints, FIXED_LEAD_LENGTH, true), radius)
  }
  return buildRoundedOrthogonalPath(doglegPoints, radius)
}

/**
 * Smart wrapper: try with 2 bends, escalate to 3 when intersecting target box or obstacles.
 * Preserves provided start/end orientation overrides and does not require projecting to box sides.
 */
export function generateAdaptiveOrthogonalRoundedPathSmart(
  source: PortPosition,
  target: PortPosition,
  radius = 16,
  options?: AdaptivePathOptions & { targetBox?: { x: number; y: number; width: number; height: number } }
): string {
  // Determine orientations based on overrides or boxes (only for orientation hints)
  const startSide = detectBoxSide(source, options?.sourceBox)
  const endSide = detectBoxSide(target, options?.targetBox)
  const startOrientation = options?.startOrientationOverride ?? getOrientationFromSide(startSide)
  const endOrientation = options?.endOrientationOverride ?? getOrientationFromSide(endSide)

  // Build 2-bend candidate and check intersections
  const candidatePoints = generateCandidatePoints(source, target, startOrientation, endOrientation)
  let intersects = false
  // Check intersection with explicit target box if provided
  if (options?.targetBox) {
    const tbox = options.clearance ? inflateRect(options.targetBox, options.clearance) : options.targetBox
    for (let i = 0; i < candidatePoints.length - 1; i++) {
      if (rectIntersectsSegment(tbox, candidatePoints[i], candidatePoints[i + 1])) {
        intersects = true
        break
      }
    }
  }

  const maxBends = intersects ? 3 : 2
  // Avoid projecting to box sides in the inner call by nulling boxes
  return generateAdaptiveOrthogonalRoundedPath(source, target, radius, {
    ...options,
    sourceBox: undefined,
    targetBox: undefined,
    maxBends
  })
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

/** Clamp desired lead length to available axis span given radius; ensures minimum 4px */
function clampLeadLength(axisSpan: number, radius: number, desired: number): number {
  const minNeeded = 2 * desired + 2 * radius + 2
  if (axisSpan >= minNeeded) { return desired }
  const shrinkLead = Math.max(4, (axisSpan - (2 * radius + 2)) / 2)
  return isFinite(shrinkLead) && shrinkLead > 0 ? shrinkLead : 4
}

/** Detect which side of a box a point exits from */
function detectBoxSide(pt: PortPosition, box?: { x: number; y: number; width: number; height: number }): BoxSide {
  if (!box) { return 'none' }
  const eps = 0.5
  if (Math.abs(pt.x - box.x) < eps) { return 'left' }
  if (Math.abs(pt.x - (box.x + box.width)) < eps) { return 'right' }
  if (Math.abs(pt.y - box.y) < eps) { return 'top' }
  if (Math.abs(pt.y - (box.y + box.height)) < eps) { return 'bottom' }
  return 'none'
}

/** Get orientation from box side */
function getOrientationFromSide(side: BoxSide): Orientation {
  if (side === 'left' || side === 'right') { return 'horizontal' }
  if (side === 'top' || side === 'bottom') { return 'vertical' }
  return 'none'
}

/** Generate 3-bend pattern for horizontal→vertical transitions */
function generateHorizontalToVertical3Bend(
  start: PortPosition,
  end: PortPosition,
  FIXED: number
): PortPosition[] {
  const dirX = Math.sign(end.x - start.x) || 1
  const dirY = Math.sign(end.y - start.y) || 1
  const firstPoint: PortPosition = { x: start.x + dirX * FIXED, y: start.y }

  const totalY = end.y - start.y
  let midY = start.y + totalY / 2
  const minGap = FIXED * 1.2
  if (Math.abs(midY - start.y) < minGap) { midY = start.y + dirY * minGap }
  if (Math.abs(end.y - midY) < minGap) { midY = end.y - dirY * minGap }

  const approachDirY = dirY
  let preEndY = end.y - approachDirY * FIXED
  if (Math.abs(end.y - start.y) < FIXED * 3) {
    preEndY = end.y - approachDirY * Math.max(8, Math.abs(end.y - start.y) / 4)
  }

  const points = [
    start,
    firstPoint,
    { x: firstPoint.x, y: midY },
    { x: end.x, y: midY }
  ]

  if (preEndY !== end.y) { points.push({ x: end.x, y: preEndY }) }
  points.push(end)

  return points
}

/** Generate 3-bend pattern for vertical→horizontal transitions */
/** Generate candidate points for basic routing */
function generateCandidatePoints(
  start: PortPosition,
  end: PortPosition,
  startOrientation: Orientation,
  endOrientation: Orientation
): PortPosition[] {
  const horizontalFirst = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)

  // If both orientations are the same (both horizontal exits or both vertical) and positions require change on the orthogonal axis,
  // we prefer a TWO-BEND path: start -> mid dogleg -> turn -> end, yielding two rounded corners for clearer schematic shape.
  if (startOrientation !== 'none' && startOrientation === endOrientation) {
    if (startOrientation === 'horizontal') {
      if (Math.abs(start.y - end.y) < 0.5) {
        return [start, end]
      } else {
        // For nearby nodes, use adaptive positioning instead of simple midpoint
        const totalDistX = Math.abs(end.x - start.x)
        let midX: number

        if (totalDistX < FIXED_LEAD_LENGTH * 2) {
          // When nodes are close, position the dogleg to avoid overlapping
          const minLead = Math.max(10, totalDistX * 0.25)
          const dirX = Math.sign(end.x - start.x) || 1
          midX = start.x + dirX * minLead
        } else {
          midX = (start.x + end.x) / 2
        }

        return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
      }
    } else { // vertical orientation
      if (Math.abs(start.x - end.x) < 0.5) {
        return [start, end]
      } else {
        // For nearby nodes, use adaptive positioning instead of simple midpoint
        const totalDistY = Math.abs(end.y - start.y)
        let midY: number

        if (totalDistY < FIXED_LEAD_LENGTH * 2) {
          // When nodes are close, position the dogleg to avoid overlapping
          const minLead = Math.max(10, totalDistY * 0.25)
          const dirY = Math.sign(end.y - start.y) || 1
          midY = start.y + dirY * minLead
        } else {
          midY = (start.y + end.y) / 2
        }

        return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
      }
    }
  }

  // If not filled (different orientation or boxes missing), fallback to single-corner L-shape candidate.
  const corner = horizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y }
  return [start, corner, end]
}

/** Check if candidate points intersect with obstacles */
function hasObstacleIntersection(
  candidatePoints: PortPosition[],
  obstacles: Array<{ x: number; y: number; width: number; height: number }>
): boolean {
  for (let i = 0; i < candidatePoints.length - 1; i++) {
    const a = candidatePoints[i]
    const b = candidatePoints[i + 1]
    for (const ob of obstacles) {
      if (rectIntersectsSegment(ob, a, b)) { return true }
    }
  }
  return false
}

/** Handle oriented routing with adaptive leads for nearby nodes */
function handleOrientedRouting(
  start: PortPosition,
  end: PortPosition,
  startOrientation: Orientation,
  endOrientation: Orientation,
  FIXED: number
): PortPosition[] | null {
  // Use shared adaptive lead length calculation

  if (startOrientation === 'horizontal') {
    const totalDistX = Math.abs(end.x - start.x)
    const adaptiveFixed = getAdaptiveLeadLength(totalDistX, FIXED)
    const dirX = Math.sign(end.x - start.x) || 1
    const firstPoint: PortPosition = { x: start.x + dirX * adaptiveFixed, y: start.y }

    if (endOrientation === 'horizontal') {
      const dirEndX = Math.sign(end.x - start.x) || 1
      const preEnd: PortPosition = { x: end.x - dirEndX * adaptiveFixed, y: end.y }
      if (Math.abs(firstPoint.x - preEnd.x) < 1) {
        return [start, firstPoint, { x: firstPoint.x, y: end.y }, end]
      } else {
        return [start, firstPoint, { x: firstPoint.x, y: end.y }, preEnd, end]
      }
    } else if (endOrientation === 'vertical') {
      return generateHorizontalToVertical3Bend(start, end, adaptiveFixed)
    } else {
      return [start, firstPoint, { x: firstPoint.x, y: end.y }, end]
    }
  } else if (startOrientation === 'vertical') {
    const totalDistY = Math.abs(end.y - start.y)
    const adaptiveFixed = getAdaptiveLeadLength(totalDistY, FIXED)
    const dirY = Math.sign(end.y - start.y) || 1
    const firstPoint: PortPosition = { x: start.x, y: start.y + dirY * adaptiveFixed }

    if (endOrientation === 'vertical') {
      const dirEndY = Math.sign(end.y - start.y) || 1
      const preEnd: PortPosition = { x: end.x, y: end.y - dirEndY * adaptiveFixed }
      if (Math.abs(firstPoint.y - preEnd.y) < 1) {
        return [start, firstPoint, { x: end.x, y: firstPoint.y }, end]
      } else {
        return [start, firstPoint, { x: end.x, y: firstPoint.y }, preEnd, end]
      }
    } else if (endOrientation === 'horizontal') {
      return generateVerticalToHorizontal3Bend(start, end, adaptiveFixed)
    } else {
      return [start, firstPoint, { x: end.x, y: firstPoint.y }, end]
    }
  }
  return null
}

function generateVerticalToHorizontal3Bend(
  start: PortPosition,
  end: PortPosition,
  FIXED: number
): PortPosition[] {
  const dirY = Math.sign(end.y - start.y) || 1
  const dirX = Math.sign(end.x - start.x) || 1
  const firstPoint: PortPosition = { x: start.x, y: start.y + dirY * FIXED }

  const totalX = end.x - start.x
  let midX = start.x + totalX / 2
  const minGap = FIXED * 1.2
  if (Math.abs(midX - start.x) < minGap) { midX = start.x + dirX * minGap }
  if (Math.abs(end.x - midX) < minGap) { midX = end.x - dirX * minGap }

  const approachDirX = dirX
  let preEndX = end.x - approachDirX * FIXED
  if (Math.abs(end.x - start.x) < FIXED * 3) {
    preEndX = end.x - approachDirX * Math.max(8, Math.abs(end.x - start.x) / 4)
  }

  const points = [
    start,
    firstPoint,
    { x: midX, y: firstPoint.y },
    { x: midX, y: end.y }
  ]

  if (preEndX !== end.x) { points.push({ x: preEndX, y: end.y }) }
  points.push(end)

  return points
}