/**
 * Mode-Aware Workflow Canvas Component
 * 
 * This enhanced canvas component integrates the new mode system with the existing
 * WorkflowCanvas, providing dramatic visual distinctions between modes while
 * maintaining backward compatibility and following SOLID principles.
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { useModeSystem, useModeBehavior } from '../hooks/useModeSystem'
import type { WorkflowCanvasProps } from './WorkflowCanvas'
import { getPortPositions } from '../utils/node-utils'
import { generateModeAwareConnectionPath } from '../utils/connection-utils'

/**
 * Mode-aware canvas props extending the original canvas props
 */
export interface ModeAwareWorkflowCanvasProps extends WorkflowCanvasProps {
  // Mode system integration
  enableModeSystem?: boolean
  onModeChange?: (modeId: string) => void
  
  // Enhanced visual features
  enableModeTransitions?: boolean
  showModeIndicator?: boolean
  enablePerformanceMode?: boolean
  
  // Debug features
  showDebugInfo?: boolean
  enableModeDebugOverlay?: boolean
}

/**
 * Enhanced Workflow Canvas with integrated mode system
 */
const ModeAwareWorkflowCanvas = React.memo<ModeAwareWorkflowCanvasProps>((props) => {
  const {
    svgRef,
    nodes,
    connections,
    showGrid,
    canvasTransform,
    selectedNodes,
    selectedConnection,
    isConnecting,
    onCanvasClick,
    onCanvasMouseMove,
    // Mode system props
    enableModeSystem = true,
    onModeChange,
    enableModeTransitions = true,
    showModeIndicator = false,
    enablePerformanceMode = false,
    showDebugInfo = false,
    enableModeDebugOverlay = false
  } = props
  // Mode system integration
  const {
    currentMode,
    isTransitioning,
    renderingStrategy,
    applyModeTheme,
    getModeCustomProperties,
    addEventListener
  } = useModeSystem({
    enableTransitions: enableModeTransitions,
    debugMode: showDebugInfo,
    onModeChange: onModeChange ? (mode) => onModeChange(mode.id) : undefined
  })

  // Mode-specific behavior
  const modeBehavior = useModeBehavior()

  // Refs for mode system integration
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const modeTransitionRef = useRef<boolean>(false)
  const performanceTimerRef = useRef<number>(0)

  // Memoized mode-aware connection data
  const modeAwareConnections = useMemo(() => {
    const modeId = currentMode?.id || 'workflow'
    return connections.map(conn => {
      const path = generateModeAwareConnectionPath(
        {
          sourceNodeId: conn.sourceNodeId,
          sourcePortId: conn.sourcePortId,
          targetNodeId: conn.targetNodeId,
          targetPortId: conn.targetPortId
        },
        nodes,
        undefined,
        modeId
      ) || ''
      return {
        id: conn.id,
        path,
        isSelected: selectedConnection?.id === conn.id,
        isHovered: false
      }
    })
  }, [connections, nodes, selectedConnection, currentMode])

  // Memoized mode-aware port data
  const modeAwarePorts = useMemo(() => {
    if (!enableModeSystem) return []

    const ports: Array<{ 
      id: string; 
      x: number; 
      y: number; 
      type: string; 
      isConnected: boolean; 
      isHovered: boolean;
      nodeId: string;
    }> = []

    nodes.forEach(node => {
      const inputPositions = getPortPositions(node, 'input')
      const outputPositions = getPortPositions(node, 'output')

      node.inputs?.forEach((input, index) => {
        const position = inputPositions[index]
        if (!position) return
        ports.push({
          id: `${node.id}-input-${input.id}`,
          x: node.x + position.x,
          y: node.y + position.y,
          type: input.type,
          isConnected: connections.some(conn => conn.targetNodeId === node.id && conn.targetPortId === input.id),
          isHovered: false,
          nodeId: node.id
        })
      })

      node.outputs?.forEach((output, index) => {
        const position = outputPositions[index]
        if (!position) return
        ports.push({
          id: `${node.id}-output-${output.id}`,
          x: node.x + position.x,
          y: node.y + position.y,
          type: output.type,
          isConnected: connections.some(conn => conn.sourceNodeId === node.id && conn.sourcePortId === output.id),
          isHovered: false,
          nodeId: node.id
        })
      })
    })

    return ports
  }, [nodes, connections, enableModeSystem])

  // Apply mode theme to canvas container
  useEffect(() => {
    if (enableModeSystem && currentMode && canvasContainerRef.current) {
      applyModeTheme(canvasContainerRef.current)
    }
  }, [currentMode, applyModeTheme, enableModeSystem])

  // Apply mode theme to SVG element
  useEffect(() => {
    if (enableModeSystem && currentMode && svgRef.current) {
      applyModeTheme(svgRef.current)
    }
  }, [currentMode, applyModeTheme, enableModeSystem, svgRef])

  // Handle mode transitions
  useEffect(() => {
    if (!enableModeSystem) return

    modeTransitionRef.current = isTransitioning

    if (canvasContainerRef.current) {
      if (isTransitioning) {
        canvasContainerRef.current.classList.add('mode-switching')
      } else {
        canvasContainerRef.current.classList.remove('mode-switching')
        canvasContainerRef.current.classList.add('mode-entering')
        
        // Remove entering class after animation
        setTimeout(() => {
          if (canvasContainerRef.current) {
            canvasContainerRef.current.classList.remove('mode-entering')
          }
        }, enableModeTransitions ? 600 : 0)
      }
    }
  }, [isTransitioning, enableModeSystem, enableModeTransitions])

  // Performance monitoring
  useEffect(() => {
    if (!enablePerformanceMode || !showDebugInfo) return

    const startTime = performance.now()
    performanceTimerRef.current = startTime

    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime
      if (renderTime > 16) { // More than one frame at 60fps
        console.warn(`[ModeAwareCanvas] Slow render detected: ${renderTime.toFixed(2)}ms`)
      }
    }
  })

  // Mode system event listener
  useEffect(() => {
    if (!enableModeSystem) return

    const unsubscribe = addEventListener((event) => {
      if (showDebugInfo) {
        console.log('[ModeAwareCanvas] Mode system event:', event)
      }

      // Handle mode-specific events
      if (event.type === 'MODE_SWITCH_STARTED' && canvasContainerRef.current) {
        canvasContainerRef.current.style.setProperty('--mode-transition-active', '1')
      }
      
      if (event.type === 'MODE_SWITCH_COMPLETED' && canvasContainerRef.current) {
        canvasContainerRef.current.style.setProperty('--mode-transition-active', '0')
      }
    })

    return unsubscribe
  }, [enableModeSystem, addEventListener, showDebugInfo])

  // Enhanced interaction handlers that respect mode behavior
  // (Removed unused handleNodeClick / handlePortClick to satisfy lint)

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    if (!modeBehavior.enableDragAndDrop) {
      event.dataTransfer.dropEffect = 'none'
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [modeBehavior.enableDragAndDrop])

  // Custom SVG rendering with mode-specific elements
  const renderModeSpecificElements = useCallback(() => {
    if (!enableModeSystem || !renderingStrategy || !svgRef.current) {
      return null
    }

    const svg = d3.select(svgRef.current)
    
    // Clear existing mode-specific elements
    svg.select('.mode-specific-elements').remove()
    
    // Create container for mode-specific elements
    const modeGroup = svg.append('g').attr('class', 'mode-specific-elements')
    
    // Render connections with mode-specific strategy
    if (currentMode) {
      // If strategy exposes batch render helpers use them; else fallback to individual creation
      // @ts-expect-error - runtime feature detection
      if (typeof renderingStrategy.renderConnections === 'function') {
        // @ts-expect-error dynamic call
        const connectionsHTML = renderingStrategy.renderConnections(
          modeAwareConnections,
          currentMode.theme.connections
        )
        // @ts-expect-error dynamic call
        const portsHTML = renderingStrategy.renderPorts(
          modeAwarePorts,
            currentMode.theme.ports
        )
        modeGroup.html((connectionsHTML || '') + (portsHTML || ''))
      }
    }
  }, [enableModeSystem, renderingStrategy, currentMode, modeAwareConnections, modeAwarePorts, svgRef])

  // Render mode-specific elements when data changes
  useEffect(() => {
    if (enableModeSystem && !isTransitioning) {
      renderModeSpecificElements()
    }
  }, [enableModeSystem, isTransitioning, renderModeSpecificElements])

  // Debug overlay rendering
  const renderDebugOverlay = useCallback(() => {
    if (!showDebugInfo || !enableModeDebugOverlay || !currentMode) {
      return null
    }

    return (
      <div className="mode-debug-overlay">
        <div className="debug-info">
          <h4>Mode Debug Info</h4>
          <div>Current Mode: {currentMode.name}</div>
          <div>Transitioning: {isTransitioning ? 'Yes' : 'No'}</div>
          <div>Nodes: {nodes.length}</div>
          <div>Connections: {connections.length}</div>
          <div>Selected: {selectedNodes.size}</div>
          <div>Can Create Nodes: {modeBehavior.canCreateNodes ? 'Yes' : 'No'}</div>
          <div>Can Create Connections: {modeBehavior.canCreateConnections ? 'Yes' : 'No'}</div>
          <div>Auto Layout: {modeBehavior.autoLayout ? 'Yes' : 'No'}</div>
          <div>Snap to Grid: {modeBehavior.snapToGrid ? 'Yes' : 'No'}</div>
        </div>
      </div>
    )
  }, [showDebugInfo, enableModeDebugOverlay, currentMode, isTransitioning, nodes.length, connections.length, selectedNodes.size, modeBehavior])

  // Mode indicator rendering
  const renderModeIndicator = useCallback(() => {
    if (!showModeIndicator || !currentMode) {
      return null
    }

    return (
      <div className="mode-indicator">
        <div className="mode-indicator-badge" style={{
          backgroundColor: currentMode.theme.customProperties?.['--mode-primary-color'] || currentMode.theme.primary,
          color: currentMode.theme.customProperties?.['--mode-text-color'] || currentMode.theme.foreground || '#ffffff'
        }}>
          {currentMode.name}
        </div>
      </div>
    )
  }, [showModeIndicator, currentMode])

  return (
    <div 
      ref={canvasContainerRef}
  className={`canvas-container ${enableModeSystem && currentMode ? (currentMode.theme.cssClassName || '') : ''}`}
      onDragOver={handleCanvasDragOver}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...(enableModeSystem && currentMode ? getModeCustomProperties() : {})
      }}
    >
      <svg 
        ref={svgRef} 
        className={`workflow-canvas ${enableModeSystem && currentMode ? `${currentMode.id}-canvas` : ''}`}
        width="100%" 
        height="100%"
        style={{
          cursor: isConnecting ? 'crosshair' : 'grab',
          transition: enableModeTransitions ? 'all 0.3s ease' : 'none'
        }}
        onClick={onCanvasClick}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.k
          const y = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.k
          onCanvasMouseMove(x, y)
        }}
      >
        {/* SVG Definitions for mode-specific markers and filters */}
        <defs>
          {enableModeSystem && currentMode && (
            <>
              {/* Mode-specific arrow markers */}
              <marker
                id={`arrowhead-${currentMode.id}`}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path
                  d="M0,0 L0,6 L9,3 z"
                  fill={currentMode.theme.connections?.defaultColor || currentMode.theme.primary}
                />
              </marker>
              
              <marker
                id={`arrowhead-${currentMode.id}-hover`}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path
                  d="M0,0 L0,6 L9,3 z"
                  fill={currentMode.theme.connections?.hoverColor || currentMode.theme.secondary || currentMode.theme.primary}
                />
              </marker>
              
              <marker
                id={`arrowhead-${currentMode.id}-selected`}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path
                  d="M0,0 L0,6 L9,3 z"
                  fill={currentMode.theme.connections?.selectedColor || currentMode.theme.success || currentMode.theme.primary}
                />
              </marker>

              {/* Mode-specific filters */}
              <filter id={`drop-shadow-${currentMode.id}`}>
                <feDropShadow 
                  dx="0" 
                  dy="2" 
                  stdDeviation="4" 
                  floodColor={currentMode.theme.connections?.defaultColor || currentMode.theme.primary} 
                  floodOpacity="0.3"
                />
              </filter>
              
              <filter id={`glow-${currentMode.id}`}>
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </>
          )}
        </defs>

        {/* Grid pattern */}
        {showGrid && (
          <defs>
            <pattern 
              id="grid" 
              width="20" 
              height="20" 
              patternUnits="userSpaceOnUse"
              opacity={currentMode?.theme.canvas?.gridOpacity || 0.5}
            >
              <path 
                d="M 20 0 L 0 0 0 20" 
                fill="none" 
                stroke={currentMode?.theme.canvas?.gridColor || '#e5e7eb'} 
                strokeWidth="1"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </defs>
        )}
        
        {/* Canvas content group with transform */}
        <g transform={`translate(${canvasTransform.x},${canvasTransform.y}) scale(${canvasTransform.k})`}>
          {/* Mode-specific rendering will be handled by the effect above */}
        </g>
      </svg>

      {/* Mode indicator */}
      {renderModeIndicator()}

      {/* Debug overlay */}
      {renderDebugOverlay()}

      {/* Transition overlay */}
      {isTransitioning && enableModeTransitions && (
        <div className="mode-transition-overlay">
          <div className="mode-transition-spinner">
            Switching modes...
          </div>
        </div>
      )}
    </div>
  )
})

ModeAwareWorkflowCanvas.displayName = 'ModeAwareWorkflowCanvas'

export default ModeAwareWorkflowCanvas