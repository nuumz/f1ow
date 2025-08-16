/**
 * Marker utilities for connection rendering
 * Centralizes marker id resolution across modes and states.
 */

export type MarkerState = 'default' | 'selected' | 'hover'

export function getArrowMarkerForMode(isWorkflowMode: boolean, state: MarkerState): string {
  if (isWorkflowMode) {
    switch (state) {
      case 'selected':
        return 'url(#arrowhead-workflow-selected)'
      case 'hover':
        return 'url(#arrowhead-workflow-hover)'
      default:
        return 'url(#arrowhead-workflow)'
    }
  }
  switch (state) {
    case 'selected':
      return 'url(#arrowhead-architecture-selected)'
    case 'hover':
      return 'url(#arrowhead-architecture-hover)'
    default:
      return 'url(#arrowhead-architecture)'
  }
}

export function getLeftArrowMarker(state: MarkerState): string {
  switch (state) {
    case 'selected':
      return 'url(#arrowhead-left-selected)'
    case 'hover':
      return 'url(#arrowhead-left-hover)'
    default:
      return 'url(#arrowhead-left)'
  }
}

export function getModeAwareConnectionMarker(modeId: string | undefined, state: MarkerState = 'default'): string {
  const isWorkflowMode = modeId === 'workflow'
  return getArrowMarkerForMode(isWorkflowMode, state)
}
