import { useCallback, useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useWorkflowContext } from '../contexts/WorkflowContext'
import { getNodeHeight } from '../utils/node-utils'
import type { WorkflowNode } from './useNodeSelection'

export interface CanvasTransform {
  x: number
  y: number
  k: number
}

export function useWorkflowCanvas() {
  const { state, svgRef, dispatch } = useWorkflowContext()
  const canvasTransformRef = useRef<CanvasTransform>(state.canvasTransform)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  // Sync ref with state
  useEffect(() => {
    canvasTransformRef.current = state.canvasTransform
  }, [state.canvasTransform])

  // Register zoom behavior for programmatic control
  const registerZoomBehavior = useCallback((zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>) => {
    zoomBehaviorRef.current = zoomBehavior
  }, [])

  // Canvas transform operations - following useCanvasTransform pattern
  const saveCanvasTransform = useCallback((transform: CanvasTransform) => {
    canvasTransformRef.current = transform
    dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: transform })
    
    // Save to localStorage with consistent key pattern
    try {
      localStorage.setItem(`workflow-canvas-transform-${state.workflowName}`, JSON.stringify(transform))
    } catch (error) {
      console.warn('Failed to save canvas transform to localStorage:', error)
    }
  }, [dispatch, state.workflowName])

  const getInitialCanvasTransform = useCallback((): CanvasTransform => {
    const saved = localStorage.getItem(`workflow-canvas-transform-${state.workflowName}`)
    if (saved) {
      try {
        const { x, y, k } = JSON.parse(saved)
        return { x: x || 0, y: y || 0, k: k || 1 }
      } catch (e) {
        console.warn('Failed to parse saved canvas transform:', e)
      }
    }
    return { x: 0, y: 0, k: 1 }
  }, [state.workflowName])


  const resetCanvasPosition = useCallback((nodes?: WorkflowNode[], getNodeHeightFn = getNodeHeight) => {
    const nodesToUse = nodes || state.nodes
    
    if (!svgRef.current) {
      console.warn('SVG ref not available')
      return
    }

    if (!zoomBehaviorRef.current) {
      console.warn('Zoom behavior not available yet')
      return
    }

    const svg = d3.select(svgRef.current)
    const rect = svgRef.current.getBoundingClientRect()
    const viewportWidth = rect.width
    const viewportHeight = rect.height

    if (nodesToUse.length === 0) {
      // No nodes: reset to center with 100% zoom
      const resetTransform = { x: 0, y: 0, k: 1 }
      
      // Only dispatch if transform actually changed
      const currentTransform = state.canvasTransform
      if (currentTransform.x !== 0 || currentTransform.y !== 0 || currentTransform.k !== 1) {
        dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: resetTransform })
      }
      
      // Apply reset transform with transition
      const transition = svg.transition().duration(500).ease(d3.easeQuadOut)
      transition.call(zoomBehaviorRef.current.transform, d3.zoomIdentity)
      return
    }

    // Find the leftmost node
    const leftmostNode = nodesToUse.reduce((leftmost, current) => 
      current.x < leftmost.x ? current : leftmost
    )

    // Focus on the center of the leftmost node
    const centerX = leftmostNode.x
    const centerY = leftmostNode.y

    // Reset to 100% zoom (scale = 1) and center the content
    const scale = 1

    // Calculate translation to center content at 100% zoom
    const translateX = viewportWidth / 2 - centerX * scale
    const translateY = viewportHeight / 2 - centerY * scale

    const newTransform = { x: translateX, y: translateY, k: scale }
    
    // Only dispatch if transform actually changed
    const currentTransform = state.canvasTransform
    if (currentTransform.x !== translateX || currentTransform.y !== translateY || currentTransform.k !== scale) {
      dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: newTransform })
    }

    // Apply transform to SVG with transition
    const transition = svg.transition().duration(250).ease(d3.easeQuadOut)
    transition.call(zoomBehaviorRef.current.transform, d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale))
  }, [state.nodes, state.canvasTransform, svgRef, dispatch])

  const fitToScreen = useCallback((nodes?: WorkflowNode[], getNodeHeightFn = getNodeHeight) => {
    const nodesToUse = nodes || state.nodes
    
    console.log('🔍 fitToScreen called with', nodesToUse.length, 'nodes')
    
    if (!svgRef.current) {
      console.warn('SVG ref not available')
      return
    }

    if (!zoomBehaviorRef.current) {
      console.warn('Zoom behavior not available yet')
      return
    }

    const svg = d3.select(svgRef.current)
    const rect = svgRef.current.getBoundingClientRect()
    const viewportWidth = rect.width
    const viewportHeight = rect.height

    if (nodesToUse.length === 0) {
      // No nodes: reset to center with 100% zoom
      const resetTransform = { x: 0, y: 0, k: 1 }
      
      // Only dispatch if transform actually changed
      const currentTransform = state.canvasTransform
      if (currentTransform.x !== 0 || currentTransform.y !== 0 || currentTransform.k !== 1) {
        dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: resetTransform })
      }
      
      // Apply reset transform with transition
      const transition = svg.transition().duration(500).ease(d3.easeQuadOut)
      transition.call(zoomBehaviorRef.current.transform, d3.zoomIdentity)
      return
    }

    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    nodesToUse.forEach(node => {
      const nodeHeight = getNodeHeightFn(node)
      const nodeWidth = 200 // Default node width
      
      const left = node.x - nodeWidth / 2
      const right = node.x + nodeWidth / 2
      const top = node.y - nodeHeight / 2
      const bottom = node.y + nodeHeight / 2
      
      minX = Math.min(minX, left)
      maxX = Math.max(maxX, right)
      minY = Math.min(minY, top)
      maxY = Math.max(maxY, bottom)
    })

    // Add padding
    const padding = 100
    minX -= padding
    minY -= padding
    maxX += padding
    maxY += padding

    // Calculate center and scale to fit content
    const boundingWidth = maxX - minX
    const boundingHeight = maxY - minY
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // Calculate scale to fit content with some margin
    const scaleX = viewportWidth / boundingWidth
    const scaleY = viewportHeight / boundingHeight
    const scale = Math.max(0.1, Math.min(scaleX, scaleY, 3)) // Min scale of 0.1, max scale of 3

    console.log('🔍 fitToScreen calculations:', {
      viewport: { width: viewportWidth, height: viewportHeight },
      bounding: { width: boundingWidth, height: boundingHeight },
      scales: { scaleX, scaleY, final: scale },
      center: { centerX, centerY }
    })

    // Calculate translation to center content
    const translateX = viewportWidth / 2 - centerX * scale
    const translateY = viewportHeight / 2 - centerY * scale

    const newTransform = { x: translateX, y: translateY, k: scale }
    
    console.log('🔍 fitToScreen transform:', newTransform)
    
    // Only dispatch if transform actually changed
    const currentTransform = state.canvasTransform
    if (currentTransform.x !== translateX || currentTransform.y !== translateY || currentTransform.k !== scale) {
      dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: newTransform })
    }

    // Apply transform to SVG with transition
    const transition = svg.transition().duration(250).ease(d3.easeQuadOut)
    transition.call(zoomBehaviorRef.current.transform, d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale))
  }, [state.nodes, state.canvasTransform, svgRef, dispatch])

  const zoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) {
      console.warn('Zoom behavior not available yet')
      return
    }
    
    // Use d3 zoom behavior for proper event handling
    const svg = d3.select(svgRef.current)
    const currentScale = canvasTransformRef.current.k
    const newScale = Math.min(currentScale * 1.2, 3)
    
    if (Math.abs(newScale - currentScale) < 0.001) return
    
    const transition = svg.transition().duration(150)
    transition.call(zoomBehaviorRef.current.scaleBy, newScale / currentScale)
  }, [svgRef])

  const zoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) {
      console.warn('Zoom behavior not available yet')
      return
    }
    
    // Use d3 zoom behavior for proper event handling
    const svg = d3.select(svgRef.current)
    const currentScale = canvasTransformRef.current.k
    const newScale = Math.max(currentScale / 1.2, 0.2)
    
    if (Math.abs(newScale - currentScale) < 0.001) return
    
    const transition = svg.transition().duration(150)
    transition.call(zoomBehaviorRef.current.scaleBy, newScale / currentScale)
  }, [svgRef])

  const setZoomLevel = useCallback((zoomLevel: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) {
      console.warn('Zoom behavior not available yet')
      return
    }
    
    // Use d3 zoom behavior for proper event handling
    const currentTransform = canvasTransformRef.current
    const newScale = Math.max(0.2, Math.min(3, zoomLevel))
    
    if (Math.abs(newScale - currentTransform.k) < 0.001) return
    
    const svg = d3.select(svgRef.current)
    const transition = svg.transition().duration(200)
    transition.call(zoomBehaviorRef.current.scaleTo, newScale)
  }, [svgRef])

  // Load saved transform on mount - only run when workflowName changes
  useEffect(() => {
    if (state.workflowName) {
      const initialTransform = getInitialCanvasTransform()
      if (initialTransform.x !== 0 || initialTransform.y !== 0 || initialTransform.k !== 1) {
        dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: initialTransform })
      }
    }
  }, [state.workflowName, getInitialCanvasTransform, dispatch])

  return {
    // State
    zoomLevel: state.canvasTransform.k,
    canvasTransformRef,
    canvasTransform: state.canvasTransform,
    
    // Operations
    zoomIn,
    zoomOut,
    fitToScreen,
    resetCanvasPosition,
    saveCanvasTransform,
    setZoomLevel,
    
    // Zoom behavior registration
    registerZoomBehavior,
    
    // Utils
    getInitialCanvasTransform
  }
}