import { useCallback, useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useWorkflowContext } from '../contexts/WorkflowContext'
import { getNodeHeight, NODE_WIDTH } from '../utils/node-utils'
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


  const resetCanvasPosition = useCallback((nodes?: WorkflowNode[]) => {
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
      current.x < leftmost.x ? current : leftmost, nodesToUse[0]
    )

    // Focus on the center of the leftmost node
    const centerX = leftmostNode.x
    const centerY = leftmostNode.y

    // Reset to 100% zoom (scale = 1) and position the content based on node count
    const scale = 1

    // Calculate translation based on number of nodes
    let translateX: number, translateY: number
    
    if (nodesToUse.length === 1) {
      // Single node: focus at center (50%, 50%)
      const focusX = viewportWidth * 0.5   // 50% from left (center)
      const focusY = viewportHeight * 0.5  // 50% from top (center)
      translateX = focusX - centerX * scale
      translateY = focusY - centerY * scale
    } else {
      // Multiple nodes: focus at 30% from left, 40% from top
      const focusX = viewportWidth * 0.3   // 30% from left
      const focusY = viewportHeight * 0.4  // 40% from top
      translateX = focusX - centerX * scale
      translateY = focusY - centerY * scale
    }

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

  const ARCH_SIZE = 56
    const isArchitecture = state.designerMode === 'architecture'
    nodesToUse.forEach(node => {
      const nodeWidth = isArchitecture ? ARCH_SIZE : NODE_WIDTH
      const nodeHeight = isArchitecture ? ARCH_SIZE : getNodeHeightFn(node)
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

    // Calculate translation to center content (fitToScreen always centers)
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
  }, [state.nodes, state.canvasTransform, state.designerMode, svgRef, dispatch])

  const zoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) {
      console.warn('Zoom behavior not available yet')
      return
    }
    
    // Calculate new scale
    const currentTransform = state.canvasTransform
    const newScale = Math.min(currentTransform.k * 1.2, 3)
    
    if (Math.abs(newScale - currentTransform.k) < 0.001) {
      return
    }
    
    try {
      // Create new transform preserving position but adjusting for zoom center
      const svg = d3.select(svgRef.current)
      const rect = svgRef.current.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      
      // Calculate new position to zoom towards center
      const scaleRatio = newScale / currentTransform.k
      const newX = centerX - (centerX - currentTransform.x) * scaleRatio
      const newY = centerY - (centerY - currentTransform.y) * scaleRatio
      
      const newTransform = d3.zoomIdentity
        .translate(newX, newY)
        .scale(newScale)
      
      // Apply transform without transition first
      svg.call(zoomBehaviorRef.current.transform, newTransform)
      
    } catch (error) {
      console.error('🔍 zoomIn - error:', error)
    }
  }, [state.canvasTransform, svgRef])

  const zoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) {
      console.warn('Zoom behavior not available yet')
      return
    }
    
    // Calculate new scale
    const currentTransform = state.canvasTransform
    const newScale = Math.max(currentTransform.k / 1.2, 0.4)
    
    if (Math.abs(newScale - currentTransform.k) < 0.001) {
      return
    }
    
    try {
      // Create new transform preserving position but adjusting for zoom center
      const svg = d3.select(svgRef.current)
      const rect = svgRef.current.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      
      // Calculate new position to zoom towards center
      const scaleRatio = newScale / currentTransform.k
      const newX = centerX - (centerX - currentTransform.x) * scaleRatio
      const newY = centerY - (centerY - currentTransform.y) * scaleRatio
      
      const newTransform = d3.zoomIdentity
        .translate(newX, newY)
        .scale(newScale)
      
      // Apply transform without transition first
      svg.call(zoomBehaviorRef.current.transform, newTransform)
      
    } catch (error) {
      console.error('🔍 zoomOut - error:', error)
    }
  }, [state.canvasTransform, svgRef])

  const setZoomLevel = useCallback((zoomLevel: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) {
      console.warn('Zoom behavior not available yet')
      return
    }
    
    // Use d3 zoom behavior for proper event handling
    const currentTransform = canvasTransformRef.current
    const newScale = Math.max(0.4, Math.min(3, zoomLevel))
    
    if (Math.abs(newScale - currentTransform.k) < 0.001) {return}
    
    const svg = d3.select(svgRef.current)
    const transition = svg.transition().duration(200)
    transition.call(zoomBehaviorRef.current.scaleTo, newScale)
  }, [svgRef])

  // Load saved transform on mount - only run when workflowName changes
  useEffect(() => {
    if (state.workflowName) {
      // Inline the localStorage loading to avoid dependency on getInitialCanvasTransform
      const saved = localStorage.getItem(`workflow-canvas-transform-${state.workflowName}`)
      if (saved) {
        try {
          const { x, y, k } = JSON.parse(saved)
          const initialTransform = { x: x || 0, y: y || 0, k: k || 1 }
          if (initialTransform.x !== 0 || initialTransform.y !== 0 || initialTransform.k !== 1) {
            dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: initialTransform })
          }
        } catch (e) {
          console.warn('Failed to parse saved canvas transform:', e)
        }
      }
    }
  }, [state.workflowName, dispatch])

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