import { useEffect, useState } from 'react'

/**
 * Lightweight performance inspector hook for workflow canvas adaptive batching.
 * Exposes live adaptive budgets & last frame durations for visual & connection update loops.
 * Dev-only: In production builds returns static frozen snapshot.
 */
export interface PerformanceInspectorMetrics {
  visualBudget: number
  visualLast: number
  connectionBudget: number
  connectionLast: number
  timestamp: number
}

export function usePerformanceInspector(pollMs = 1000): PerformanceInspectorMetrics {
  const [metrics, setMetrics] = useState<PerformanceInspectorMetrics>(() => ({
    visualBudget: (window as any).__wfAdaptive?.vBudget ?? 4,
    visualLast: (window as any).__wfAdaptive?.lastDuration ?? 0,
    connectionBudget: (window as any).__wfConnAdaptive?.cBudget ?? 8,
    connectionLast: (window as any).__wfConnAdaptive?.lastDuration ?? 0,
    timestamp: Date.now()
  }))

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      // In production do a single snapshot (avoid interval overhead)
      setMetrics(prev => ({ ...prev, timestamp: Date.now() }))
      return
    }
    const id = setInterval(() => {
      setMetrics({
        visualBudget: (window as any).__wfAdaptive?.vBudget ?? metrics.visualBudget,
        visualLast: (window as any).__wfAdaptive?.lastDuration ?? metrics.visualLast,
        connectionBudget: (window as any).__wfConnAdaptive?.cBudget ?? metrics.connectionBudget,
        connectionLast: (window as any).__wfConnAdaptive?.lastDuration ?? metrics.connectionLast,
        timestamp: Date.now()
      })
    }, pollMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs])

  return metrics
}

/** Optional utility to log metrics periodically (dev only). */
export function usePerformanceLogging(intervalMs = 5000) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const id = setInterval(() => {
      const v = (window as any).__wfAdaptive
      const c = (window as any).__wfConnAdaptive
      if (v || c) {
        // eslint-disable-next-line no-console
        console.log('[CanvasPerf]', {
          visualBudget: v?.vBudget, visualLast: v?.lastDuration,
          connectionBudget: c?.cBudget, connectionLast: c?.lastDuration
        })
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
