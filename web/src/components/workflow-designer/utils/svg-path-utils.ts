/**
 * SVG path helpers for measurement and label placement.
 */

export function getPathMidpointWithOrientation(
  pathD: string
): { x: number; y: number; orientation: 'horizontal' | 'vertical' } | null {
  try {
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    tempSvg.setAttribute('width', '1')
    tempSvg.setAttribute('height', '1')
    tempSvg.style.position = 'absolute'
    tempSvg.style.visibility = 'hidden'

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', pathD)
    tempSvg.appendChild(path)
    document.body.appendChild(tempSvg)

    const totalLength = path.getTotalLength()
    const midPoint = path.getPointAtLength(totalLength / 2)
    const nearBefore = path.getPointAtLength(Math.max(0, totalLength / 2 - 1))
    const nearAfter = path.getPointAtLength(Math.min(totalLength, totalLength / 2 + 1))

    const dx = nearAfter.x - nearBefore.x
    const dy = nearAfter.y - nearBefore.y
    const orientation = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'

    document.body.removeChild(tempSvg)
    return { x: midPoint.x, y: midPoint.y, orientation }
  } catch {
    return null
  }
}

export function getLabelOffsetForOrientation(orientation: 'horizontal' | 'vertical') {
  if (orientation === 'horizontal') return { x: 10, y: 0 }
  return { x: 0, y: -6 }
}
