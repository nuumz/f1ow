/**
 * Enhanced Workflow Canvas Integration Example
 * 
 * This example demonstrates how to integrate the advanced D3.js connection features
 * into the existing WorkflowCanvas component with minimal changes to the existing codebase.
 * 
 * Features demonstrated:
 * - Professional path generation with Bézier curves
 * - Collision avoidance and bundled edge routing
 * - Smooth animations and transitions
 * - Performance optimizations with culling
 * - Advanced visual effects and markers
 */

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import * as d3 from 'd3'
import type { WorkflowNode, Connection, NodeVariant } from '../types'

// Import enhanced connection utilities
import {
  initializeEnhancedConnections,
  getEnhancedConnectionManager,
  generateEnhancedVariantAwareConnectionPath,
  generateEnhancedMultipleConnectionPath,
  type EnhancedConnectionConfig
} from '../utils/enhanced-connection-system'

// Import original utilities for fallback
import {
  getConnectionGroupInfo,
  isLegacyEndpoint
} from '../utils/connection-utils'

// ============================================================================
// ENHANCED WORKFLOW CANVAS PROPS
// ============================================================================

export interface EnhancedWorkflowCanvasProps {
  // All existing props from WorkflowCanvas
  svgRef: React.RefObject<SVGSVGElement>
  nodes: WorkflowNode[]
  connections: Connection[]
  showGrid: boolean
  canvasTransform: { x: number; y: number; k: number }
  nodeVariant?: NodeVariant
  selectedNodes: Set<string>
  selectedConnection: Connection | null
  isNodeSelected: (nodeId: string) => boolean
  isConnecting: boolean
  connectionStart: { nodeId: string; portId: string; type: 'input' | 'output' } | null
  connectionPreview: { x: number; y: number } | null
  
  // Event handlers
  onNodeClick: (node: WorkflowNode, ctrlKey: boolean) => void
  onNodeDoubleClick: (node: WorkflowNode) => void
  onNodeDrag: (nodeId: string, x: number, y: number) => void
  onConnectionClick: (connection: Connection) => void
  onPortClick: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onCanvasClick: () => void
  onCanvasMouseMove: (x: number, y: number) => void
  onPortDragStart: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDrag: (x: number, y: number) => void
  onPortDragEnd: (targetNodeId?: string, targetPortId?: string) => void
  canDropOnPort: (targetNodeId: string, targetPortId: string, targetPortType?: 'input' | 'output') => boolean
  canDropOnNode: (targetNodeId: string) => boolean
  onPlusButtonClick?: (nodeId: string, portId: string) => void
  onTransformChange: (transform: d3.ZoomTransform) => void
  onZoomLevelChange?: (zoomLevel: number) => void
  onRegisterZoomBehavior?: (zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>) => void

  // Enhanced features configuration
  enhancedFeatures?: {
    enabled: boolean
    config?: Partial<EnhancedConnectionConfig>
    showPerformanceMetrics?: boolean
    enableAdvancedAnimations?: boolean
  }
}

// ============================================================================
// ENHANCED WORKFLOW CANVAS COMPONENT
// ============================================================================

const EnhancedWorkflowCanvas = React.memo(function EnhancedWorkflowCanvas({
  svgRef,
  nodes,
  connections,
  showGrid,
  canvasTransform,
  nodeVariant = 'standard',
  selectedNodes,
  selectedConnection,
  isNodeSelected,
  isConnecting,
  connectionStart,
  connectionPreview,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDrag,
  onConnectionClick,
  onPortClick,
  onCanvasClick,
  onCanvasMouseMove,
  onPortDragStart,
  onPortDrag,
  onPortDragEnd,
  canDropOnPort,
  canDropOnNode,
  onPlusButtonClick,
  onTransformChange,
  onZoomLevelChange,
  onRegisterZoomBehavior,
  enhancedFeatures = { enabled: true }
}: EnhancedWorkflowCanvasProps) {

  // Enhanced features state
  const [isEnhancedInitialized, setIsEnhancedInitialized] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)
  const enhancedManagerRef = useRef<any>(null)

  // Node map for performance
  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>()
    nodes.forEach(node => map.set(node.id, node))
    return map
  }, [nodes])

  // ============================================================================
  // ENHANCED INITIALIZATION
  // ============================================================================

  useEffect(() => {
    if (!enhancedFeatures.enabled || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    const defs = svg.select('defs')

    if (defs.empty()) {
      svg.insert('defs', ':first-child')
    }

    // Calculate viewport bounds
    const rect = svgRef.current.getBoundingClientRect()
    const viewportBounds = {
      minX: -canvasTransform.x / canvasTransform.k,
      minY: -canvasTransform.y / canvasTransform.k,
      maxX: (-canvasTransform.x + rect.width) / canvasTransform.k,
      maxY: (-canvasTransform.y + rect.height) / canvasTransform.k,
      width: rect.width / canvasTransform.k,
      height: rect.height / canvasTransform.k
    }

    // Initialize enhanced connection system
    const enhancedManager = initializeEnhancedConnections(
      viewportBounds,
      svg.select('defs'),
      enhancedFeatures.config
    )

    enhancedManagerRef.current = enhancedManager
    setIsEnhancedInitialized(true)

    // Performance metrics update
    if (enhancedFeatures.showPerformanceMetrics) {
      const updateMetrics = () => {
        setPerformanceMetrics(enhancedManager.getPerformanceMetrics())
      }

      const metricsInterval = setInterval(updateMetrics, 1000)
      return () => clearInterval(metricsInterval)
    }
  }, [enhancedFeatures.enabled, svgRef.current])

  // Update viewport when transform changes
  useEffect(() => {
    if (!isEnhancedInitialized || !enhancedManagerRef.current || !svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const viewportBounds = {
      minX: -canvasTransform.x / canvasTransform.k,
      minY: -canvasTransform.y / canvasTransform.k,
      maxX: (-canvasTransform.x + rect.width) / canvasTransform.k,
      maxY: (-canvasTransform.y + rect.height) / canvasTransform.k,
      width: rect.width / canvasTransform.k,
      height: rect.height / canvasTransform.k
    }

    enhancedManagerRef.current.updateViewport(viewportBounds)
  }, [canvasTransform, isEnhancedInitialized])

  // ============================================================================
  // ENHANCED CONNECTION RENDERING
  // ============================================================================

  /**
   * Generate enhanced connection path
   */
  const getEnhancedConnectionPath = useCallback((connection: Connection): string => {
    const sourceNode = nodeMap.get(connection.sourceNodeId)
    const targetNode = nodeMap.get(connection.targetNodeId)

    if (!sourceNode || !targetNode) {
      return 'M 0 0' // Fallback path
    }

    // Get connection group info for multiple connections
    const groupInfo = getConnectionGroupInfo(connection.id, connections)

    if (enhancedFeatures.enabled && isEnhancedInitialized) {
      if (groupInfo.isMultiple) {
        return generateEnhancedMultipleConnectionPath(
          sourceNode,
          connection.sourcePortId,
          targetNode,
          connection.targetPortId,
          groupInfo.index,
          groupInfo.total,
          nodeVariant,
          true // Enable enhanced features
        )
      } else {
        return generateEnhancedVariantAwareConnectionPath(
          sourceNode,
          connection.sourcePortId,
          targetNode,
          connection.targetPortId,
          nodeVariant,
          true // Enable enhanced features
        )
      }
    }

    // Fallback to original implementation
    if (groupInfo.isMultiple) {
      return generateEnhancedMultipleConnectionPath(
        sourceNode,
        connection.sourcePortId,
        targetNode,
        connection.targetPortId,
        groupInfo.index,
        groupInfo.total,
        nodeVariant,
        false // Disable enhanced features
      )
    } else {
      return generateEnhancedVariantAwareConnectionPath(
        sourceNode,
        connection.sourcePortId,
        targetNode,
        connection.targetPortId,
        nodeVariant,
        false // Disable enhanced features
      )
    }
  }, [connections, nodeMap, nodeVariant, enhancedFeatures.enabled, isEnhancedInitialized])

  /**
   * Apply enhanced visual effects to connection
   */
  const applyEnhancedConnectionEffects = useCallback((
    connectionElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    pathElement: SVGPathElement,
    connection: Connection,
    state: 'default' | 'hover' | 'selected' = 'default'
  ) => {
    if (!enhancedFeatures.enabled || !isEnhancedInitialized || !enhancedManagerRef.current) {
      return
    }

    enhancedManagerRef.current.applyEnhancedEffects(
      connectionElement,
      pathElement,
      connection,
      state
    )
  }, [enhancedFeatures.enabled, isEnhancedInitialized])

  /**
   * Animate connection path changes
   */
  const animateConnectionPathChange = useCallback(async (
    connectionId: string,
    pathElement: SVGPathElement,
    newPath: string
  ) => {
    if (!enhancedFeatures.enabled || !isEnhancedInitialized || !enhancedManagerRef.current) {
      pathElement.setAttribute('d', newPath)
      return
    }

    if (enhancedFeatures.enableAdvancedAnimations) {
      await enhancedManagerRef.current.animatePathChange(
        connectionId,
        pathElement,
        newPath,
        'SMOOTH_TRANSITION'
      )
    } else {
      pathElement.setAttribute('d', newPath)
    }
  }, [enhancedFeatures.enabled, enhancedFeatures.enableAdvancedAnimations, isEnhancedInitialized])

  // ============================================================================
  // PERFORMANCE OPTIMIZED CONNECTION RENDERING
  // ============================================================================

  /**
   * Get optimized connections for rendering
   */
  const getOptimizedConnections = useMemo(() => {
    if (!enhancedFeatures.enabled || !isEnhancedInitialized || !enhancedManagerRef.current) {
      // Return all connections with high detail level
      const renderLevel = new Map<string, 'high' | 'medium' | 'low'>()
      connections.forEach(conn => renderLevel.set(conn.id, 'high'))
      return { visible: connections, renderLevel }
    }

    return enhancedManagerRef.current.getOptimizedConnections(
      connections,
      nodeMap,
      canvasTransform.k
    )
  }, [connections, nodeMap, canvasTransform.k, enhancedFeatures.enabled, isEnhancedInitialized])

  // ============================================================================
  // CONNECTION RENDERING LOGIC
  // ============================================================================

  const renderConnections = useCallback(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const connectionLayer = svg.select('.connection-layer')

    if (connectionLayer.empty()) return

    const { visible: visibleConnections, renderLevel } = getOptimizedConnections

    // Bind data to connection groups
    const connectionGroups = connectionLayer
      .selectAll('.connection-group')
      .data(visibleConnections, (d: any) => d.id)

    // Remove old connections
    connectionGroups.exit().remove()

    // Add new connection groups
    const connectionEnter = connectionGroups.enter()
      .append('g')
      .attr('class', 'connection-group')
      .attr('data-connection-id', (d: any) => d.id)

    // Add hitbox (invisible but wide for better hover detection)
    connectionEnter.append('path')
      .attr('class', 'connection-hitbox')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 12)
      .attr('fill', 'none')
      .style('cursor', 'pointer')
      .on('click', (event: any, d: Connection) => {
        event.stopPropagation()
        onConnectionClick(d)
      })
      .on('mouseenter', function(this: any, event: any, d: Connection) {
        const connectionGroup = d3.select(this.parentNode)
        const pathElement = connectionGroup.select('.connection-path').node() as SVGPathElement
        
        if (pathElement && enhancedFeatures.enabled) {
          applyEnhancedConnectionEffects(connectionGroup, pathElement, d, 'hover')
        } else {
          // Fallback hover effect
          connectionGroup.select('.connection-path')
            .attr('stroke', '#1976D2')
            .attr('stroke-width', 3)
        }
      })
      .on('mouseleave', function(this: any, event: any, d: Connection) {
        const connectionGroup = d3.select(this.parentNode)
        const pathElement = connectionGroup.select('.connection-path').node() as SVGPathElement
        const isSelected = selectedConnection?.id === d.id
        
        if (!isSelected) {
          if (pathElement && enhancedFeatures.enabled) {
            applyEnhancedConnectionEffects(connectionGroup, pathElement, d, 'default')
          } else {
            // Fallback default effect
            connectionGroup.select('.connection-path')
              .attr('stroke', 'white')
              .attr('stroke-width', 2)
          }
        }
      })

    // Add visible connection path
    connectionEnter.append('path')
      .attr('class', 'connection-path')
      .attr('fill', 'none')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none')

    // Update all connections (enter + existing)
    const allConnections = connectionEnter.merge(connectionGroups as any)

    // Update paths with enhanced or fallback rendering
    allConnections.each(function(this: any, d: Connection) {
      const connectionGroup = d3.select(this)
      const hitboxPath = connectionGroup.select('.connection-hitbox')
      const visiblePath = connectionGroup.select('.connection-path')
      const pathElement = visiblePath.node() as SVGPathElement

      const newPath = getEnhancedConnectionPath(d)
      const currentPath = pathElement.getAttribute('d')

      // Update hitbox
      hitboxPath.attr('d', newPath)

      // Update visible path with animation if enabled
      if (currentPath && currentPath !== newPath && enhancedFeatures.enableAdvancedAnimations) {
        animateConnectionPathChange(d.id, pathElement, newPath)
      } else {
        visiblePath.attr('d', newPath)
      }

      // Apply enhanced effects based on connection state
      const isSelected = selectedConnection?.id === d.id
      if (enhancedFeatures.enabled) {
        if (isSelected) {
          applyEnhancedConnectionEffects(connectionGroup, pathElement, d, 'selected')
        } else {
          applyEnhancedConnectionEffects(connectionGroup, pathElement, d, 'default')
        }
      }

      // Apply level-of-detail based styling
      const lod = renderLevel.get(d.id) || 'high'
      if (lod === 'low') {
        visiblePath.attr('stroke-width', 1).style('opacity', 0.6)
      } else if (lod === 'medium') {
        visiblePath.attr('stroke-width', 1.5).style('opacity', 0.8)
      } else {
        visiblePath.attr('stroke-width', 2).style('opacity', 1)
      }
    })

  }, [
    svgRef,
    getOptimizedConnections,
    getEnhancedConnectionPath,
    applyEnhancedConnectionEffects,
    animateConnectionPathChange,
    selectedConnection,
    enhancedFeatures,
    onConnectionClick
  ])

  // Render connections when dependencies change
  useEffect(() => {
    renderConnections()
  }, [renderConnections])

  // ============================================================================
  // PERFORMANCE METRICS DISPLAY
  // ============================================================================

  const PerformanceMetricsDisplay = () => {
    if (!enhancedFeatures.showPerformanceMetrics || !performanceMetrics) {
      return null
    }

    return (
      <div 
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'Monaco, monospace',
          zIndex: 1000,
          pointerEvents: 'none'
        }}
      >
        <div>Visible: {performanceMetrics.visibleConnections}/{connections.length}</div>
        <div>Cached: {performanceMetrics.cachedConnections}</div>
        <div>FPS: {performanceMetrics.frameRate}</div>
        <div>Render: {performanceMetrics.renderTime.toFixed(1)}ms</div>
        <div>Memory: {(performanceMetrics.memoryUsage / 1024).toFixed(1)}KB</div>
      </div>
    )
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* The actual SVG canvas would be rendered by the parent component */}
      {/* This example focuses on the connection rendering enhancement */}
      
      {/* Performance metrics overlay */}
      <PerformanceMetricsDisplay />
      
      {/* Development info */}
      {process.env.NODE_ENV === 'development' && enhancedFeatures.enabled && (
        <div 
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(0, 100, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          Enhanced Features: {isEnhancedInitialized ? '✓ Active' : '⏳ Initializing'}
        </div>
      )}
    </div>
  )
})

export default EnhancedWorkflowCanvas

// ============================================================================
// INTEGRATION EXAMPLE
// ============================================================================

/**
 * Example of how to use the enhanced workflow canvas in your application
 */
export function EnhancedWorkflowCanvasExample() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, k: 1 })

  // Enhanced features configuration
  const enhancedConfig: EnhancedConnectionConfig = {
    algorithm: 'auto', // Automatically select best algorithm
    curveTension: 0.4,
    enableAdvancedEffects: true,
    theme: 'professional',
    enablePerformanceOptimizations: true,
    enableCulling: true,
    enableCaching: true,
    enableAnimations: true,
    animationPreset: 'SMOOTH_TRANSITION',
    avoidCollisions: true,
    snapToGrid: false,
    enableBundling: true,
    bundleThreshold: 50
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ background: '#f7f7f7' }}
      >
        {/* SVG content will be rendered by D3 */}
      </svg>
      
      <EnhancedWorkflowCanvas
        svgRef={svgRef}
        nodes={nodes}
        connections={connections}
        showGrid={true}
        canvasTransform={canvasTransform}
        nodeVariant="standard"
        selectedNodes={new Set()}
        selectedConnection={null}
        isNodeSelected={() => false}
        isConnecting={false}
        connectionStart={null}
        connectionPreview={null}
        onNodeClick={() => {}}
        onNodeDoubleClick={() => {}}
        onNodeDrag={() => {}}
        onConnectionClick={() => {}}
        onPortClick={() => {}}
        onCanvasClick={() => {}}
        onCanvasMouseMove={() => {}}
        onPortDragStart={() => {}}
        onPortDrag={() => {}}
        onPortDragEnd={() => {}}
        canDropOnPort={() => false}
        canDropOnNode={() => false}
        onTransformChange={setCanvasTransform}
        enhancedFeatures={{
          enabled: true,
          config: enhancedConfig,
          showPerformanceMetrics: true,
          enableAdvancedAnimations: true
        }}
      />
      
      {/* Control panel for testing */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 1000
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Enhanced Connection Features</h3>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div>✓ Intelligent Bézier curves</div>
          <div>✓ Collision avoidance</div>
          <div>✓ Bundled edge routing</div>
          <div>✓ Smooth animations</div>
          <div>✓ Performance optimization</div>
          <div>✓ Professional visual effects</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MIGRATION GUIDE
// ============================================================================

/**
 * MIGRATION GUIDE: How to upgrade existing WorkflowCanvas to use enhanced features
 * 
 * 1. Install enhanced connection utilities:
 *    ```typescript
 *    import { initializeEnhancedConnections } from './utils/enhanced-connection-utils'
 *    ```
 * 
 * 2. Replace connection path generation:
 *    ```typescript
 *    // OLD:
 *    import { generateVariantAwareConnectionPath } from './utils/connection-utils'
 *    
 *    // NEW:
 *    import { generateEnhancedVariantAwareConnectionPath } from './utils/enhanced-connection-utils'
 *    ```
 * 
 * 3. Initialize enhanced features in useEffect:
 *    ```typescript
 *    useEffect(() => {
 *      const svg = d3.select(svgRef.current)
 *      const defs = svg.select('defs')
 *      
 *      const manager = initializeEnhancedConnections(viewportBounds, defs, config)
 *    }, [])
 *    ```
 * 
 * 4. Update connection rendering logic:
 *    ```typescript
 *    const path = generateEnhancedVariantAwareConnectionPath(
 *      sourceNode, sourcePortId, targetNode, targetPortId, variant, true
 *    )
 *    ```
 * 
 * 5. Add enhanced effects (optional):
 *    ```typescript
 *    manager.applyEnhancedEffects(connectionElement, pathElement, connection, 'hover')
 *    ```
 * 
 * The enhanced system is designed to be backward compatible. If enhanced features
 * are disabled or unavailable, it automatically falls back to the original implementation.
 */