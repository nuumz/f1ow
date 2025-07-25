import { useState, useRef, useCallback } from 'react'
import * as d3 from 'd3'

export interface CanvasTransform {
  x: number
  y: number
  k: number
}

export interface UseCanvasTransformProps {
  workflowName: string
  svgRef: React.RefObject<SVGSVGElement>
}

export interface UseCanvasTransformReturn {
  // State
  zoomLevel: number
  canvasTransformRef: React.RefObject<CanvasTransform>
  
  // Operations
  zoomIn: () => void
  zoomOut: () => void
  fitToScreen: (nodes: any[]) => void
  resetCanvasPosition: (nodes: any[], getNodeHeight: (node: any) => number) => void
  saveCanvasTransform: (transform: CanvasTransform) => void
  
  // Utils
  getInitialCanvasTransform: () => CanvasTransform
}

export function useCanvasTransform({
  workflowName,
  svgRef
}: UseCanvasTransformProps): UseCanvasTransformReturn {
  
  const getInitialCanvasTransform = useCallback((): CanvasTransform => {
    const saved = localStorage.getItem(`workflow-canvas-transform-${workflowName}`)
    if (saved) {
      try {
        const { x, y, k } = JSON.parse(saved)
        return { x: x || 0, y: y || 0, k: k || 1 }
      } catch (e) {
        console.warn('Failed to parse saved canvas transform:', e)
      }
    }
    return { x: 0, y: 0, k: 1 }
  }, [workflowName])

  const [zoomLevel, setZoomLevel] = useState(1)
  const canvasTransformRef = useRef<CanvasTransform>(getInitialCanvasTransform())

  const saveCanvasTransform = useCallback((transform: CanvasTransform) => {
    canvasTransformRef.current = transform
    localStorage.setItem(`workflow-canvas-transform-${workflowName}`, JSON.stringify(transform))
  }, [workflowName])

  const zoomIn = useCallback(() => {
    if (!svgRef.current) return
    
    const svg = d3.select(svgRef.current)
    const currentTransform = canvasTransformRef.current
    const newScale = Math.min(currentTransform.k * 1.2, 3)
    
    // Calculate zoom around viewport center
    const rect = svgRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    // Convert center to world coordinates using current transform
    const worldCenterX = (centerX - currentTransform.x) / currentTransform.k
    const worldCenterY = (centerY - currentTransform.y) / currentTransform.k
    
    // Calculate new position to keep center point stable
    const newX = centerX - worldCenterX * newScale
    const newY = centerY - worldCenterY * newScale
    
    const newTransform = d3.zoomIdentity.translate(newX, newY).scale(newScale)
    
    // Update state immediately for instant feedback
    const transformObj = {
      x: newTransform.x,
      y: newTransform.y,
      k: newTransform.k
    }
    
    canvasTransformRef.current = transformObj
    saveCanvasTransform(transformObj)
    setZoomLevel(newTransform.k)
    
    // Apply transform with transition
    svg.transition()
      .duration(200)
      .call(d3.zoom<SVGSVGElement, unknown>().transform, newTransform)
  }, [svgRef, saveCanvasTransform])

  const zoomOut = useCallback(() => {
    if (!svgRef.current) return
    
    const svg = d3.select(svgRef.current)
    const currentTransform = canvasTransformRef.current
    const newScale = Math.max(currentTransform.k / 1.2, 0.2)
    
    // Calculate zoom around viewport center
    const rect = svgRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    // Convert center to world coordinates using current transform
    const worldCenterX = (centerX - currentTransform.x) / currentTransform.k
    const worldCenterY = (centerY - currentTransform.y) / currentTransform.k
    
    // Calculate new position to keep center point stable
    const newX = centerX - worldCenterX * newScale
    const newY = centerY - worldCenterY * newScale
    
    const newTransform = d3.zoomIdentity.translate(newX, newY).scale(newScale)
    
    // Update state immediately for instant feedback
    const transformObj = {
      x: newTransform.x,
      y: newTransform.y,
      k: newTransform.k
    }
    
    canvasTransformRef.current = transformObj
    saveCanvasTransform(transformObj)
    setZoomLevel(newTransform.k)
    
    // Apply transform with transition
    svg.transition()
      .duration(200)
      .call(d3.zoom<SVGSVGElement, unknown>().transform, newTransform)
  }, [svgRef, saveCanvasTransform])

  const fitToScreen = useCallback((nodes: any[]) => {
    if (!svgRef.current || nodes.length === 0) return
    
    const svg = d3.select(svgRef.current)
    const bounds = {
      minX: Math.min(...nodes.map(n => n.x)) - 100,
      minY: Math.min(...nodes.map(n => n.y)) - 100,
      maxX: Math.max(...nodes.map(n => n.x)) + 100,
      maxY: Math.max(...nodes.map(n => n.y)) + 100
    }
    
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const boundsWidth = bounds.maxX - bounds.minX
    const boundsHeight = bounds.maxY - bounds.minY
    
    const scale = Math.min(width / boundsWidth, height / boundsHeight) * 0.9
    const translateX = width / 2 - (bounds.minX + boundsWidth / 2) * scale
    const translateY = height / 2 - (bounds.minY + boundsHeight / 2) * scale
    const newTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    
    // Update state and refs instantly
    const transformObj = {
      x: newTransform.x,
      y: newTransform.y,
      k: newTransform.k
    }
    
    canvasTransformRef.current = transformObj
    saveCanvasTransform(transformObj)
    setZoomLevel(newTransform.k)
    
    svg.transition()
      .duration(500)
      .ease(d3.easeQuadOut)
      .call(d3.zoom<SVGSVGElement, unknown>().transform, newTransform)
  }, [svgRef, saveCanvasTransform])

  const resetCanvasPosition = useCallback((nodes: any[], getNodeHeight: (node: any) => number) => {
    if (!svgRef.current) return
    
    const svg = d3.select(svgRef.current)
    
    if (nodes.length > 0) {
      // Find the leftmost node
      const leftmostNode = nodes.reduce((leftmost, node) => 
        node.x < leftmost.x ? node : leftmost
      )
      
      // Calculate canvas dimensions
      const width = svgRef.current.clientWidth
      const height = svgRef.current.clientHeight
      
      // Use center of leftmost node as reference point
      const nodeCenterX = leftmostNode.x
      const nodeCenterY = leftmostNode.y + getNodeHeight(leftmostNode) / 2
      
      // Position node center at center of screen with 100% zoom
      const translateX = width / 2 - nodeCenterX
      const translateY = height / 2 - nodeCenterY
      
      const transform = d3.zoomIdentity.translate(translateX, translateY).scale(1)
      
      // Update state and refs instantly
      const transformObj = { x: translateX, y: translateY, k: 1 }
      canvasTransformRef.current = transformObj
      saveCanvasTransform(transformObj)
      setZoomLevel(1)
      
      svg.transition()
        .duration(300)
        .ease(d3.easeQuadOut)
        .call(d3.zoom<SVGSVGElement, unknown>().transform, transform)
    } else {
      // Fallback: No nodes, just reset to origin
      const transform = d3.zoomIdentity.translate(0, 0).scale(1)
      
      const transformObj = { x: 0, y: 0, k: 1 }
      canvasTransformRef.current = transformObj
      saveCanvasTransform(transformObj)
      setZoomLevel(1)
      
      svg.transition()
        .duration(300)
        .ease(d3.easeQuadOut)
        .call(d3.zoom<SVGSVGElement, unknown>().transform, transform)
    }
  }, [svgRef, saveCanvasTransform])

  return {
    // State
    zoomLevel,
    canvasTransformRef,
    
    // Operations
    zoomIn,
    zoomOut,
    fitToScreen,
    resetCanvasPosition,
    saveCanvasTransform,
    
    // Utils
    getInitialCanvasTransform
  }
}