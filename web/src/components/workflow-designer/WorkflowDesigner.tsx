import { useState, useRef, useCallback, useEffect } from 'react'
import { Save, Play, Download, Upload } from 'lucide-react'
import * as d3 from 'd3'

// Import CSS styles
import './WorkflowDesigner.css'

// Import refactored hooks
import { useCanvasTransform } from './hooks/useCanvasTransform'
import { useNodeSelection } from './hooks/useNodeSelection'
import { useConnections } from './hooks/useConnections'
// import { useDragOperations } from './hooks/useDragOperations' // Available for future use

// Import components
import CanvasToolbar from './components/CanvasToolbar'
import WorkflowCanvas from './components/WorkflowCanvas'
import NodePalette from '../NodePalette'
import NodeEditor from '../NodeEditor'

// Import utilities
import { createNode, getNodeHeight } from './utils/node-utils'

// Types
import type { WorkflowNode } from './hooks/useNodeSelection'

interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'error' | 'paused'
  currentNode?: string
  completedNodes: string[]
  nodeData: Record<string, any>
  errors: Record<string, string>
  startTime?: number
  endTime?: number
  logs: Array<{
    nodeId: string
    timestamp: number
    level: 'info' | 'warning' | 'error'
    message: string
  }>
}

export default function WorkflowDesigner() {
  // Core state
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [workflowName, setWorkflowName] = useState('New Workflow')
  const [showGrid, setShowGrid] = useState(true)
  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  
  // Execution state
  const [executionState, setExecutionState] = useState<ExecutionState>({ 
    status: 'idle', 
    completedNodes: [], 
    nodeData: {},
    errors: {},
    logs: []
  })

  // Use refactored hooks
  const canvasTransform = useCanvasTransform({
    workflowName,
    svgRef
  })

  const nodeSelection = useNodeSelection({
    nodes
  })

  const connections = useConnections({
    nodes
  })

  // Note: dragOperations hook is available but not currently used in this component
  // const dragOperations = useDragOperations({
  //   nodes,
  //   setNodes,
  //   selectedNodes: nodeSelection.selectedNodes,
  //   isNodeSelected: nodeSelection.isNodeSelected,
  //   getSelectedNodesList: nodeSelection.getSelectedNodesList
  // })

  // Node operations
  const addNode = useCallback((type: string, position?: { x: number; y: number }) => {
    let nodePosition = position
    
    if (!nodePosition && svgRef.current) {
      // Calculate center of current viewport
      const rect = svgRef.current.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      
      const currentTransform = canvasTransform.canvasTransformRef.current
      if (currentTransform) {
        const canvasCenterX = (centerX - currentTransform.x) / currentTransform.k
        const canvasCenterY = (centerY - currentTransform.y) / currentTransform.k
        
        nodePosition = {
          x: canvasCenterX + (Math.random() - 0.5) * 100,
          y: canvasCenterY + (Math.random() - 0.5) * 100
        }
      }
    }
    
    const newNode = createNode(type, nodePosition || { x: 300, y: 200 })
    setNodes(prev => [...prev, newNode])
  }, [canvasTransform.canvasTransformRef])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    connections.setConnections(prev => prev.filter(c => 
      c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    ))
    nodeSelection.setSelectedNode(null)
  }, [connections, nodeSelection])

  // Canvas event handlers
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (connections.isConnecting) {
      connections.clearConnectionState()
      return
    }

    const ctrlKey = event.ctrlKey || event.metaKey
    if (!ctrlKey) {
      nodeSelection.clearSelection()
      connections.setSelectedConnection(null)
    }
    
    setShowNodeEditor(false)
  }, [connections, nodeSelection])

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleCanvasDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleCanvasDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    
    const nodeType = event.dataTransfer.getData('application/node-type')
    if (nodeType && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const clientX = event.clientX - rect.left
      const clientY = event.clientY - rect.top
      
      // Convert screen coordinates to canvas coordinates
      const currentTransform = canvasTransform.canvasTransformRef.current
      if (currentTransform) {
        const canvasX = (clientX - currentTransform.x) / currentTransform.k
        const canvasY = (clientY - currentTransform.y) / currentTransform.k
        
        addNode(nodeType, { x: canvasX, y: canvasY })
      } else {
        // Fallback to screen coordinates if transform not available
        addNode(nodeType, { x: clientX, y: clientY })
      }
    }
  }, [addNode, canvasTransform.canvasTransformRef])

  // Node event handlers
  const handleNodeClick = useCallback((nodeData: WorkflowNode, ctrlKey: boolean = false) => {
    nodeSelection.toggleNodeSelection(nodeData.id, ctrlKey)
    connections.setSelectedConnection(null)
    setShowNodeEditor(false)
  }, [nodeSelection, connections])

  const handleNodeDoubleClick = useCallback((nodeData: WorkflowNode) => {
    nodeSelection.setSelectedNodes(new Set([nodeData.id]))
    nodeSelection.setSelectedNode(nodeData)
    connections.setSelectedConnection(null)
    setShowNodeEditor(true)
  }, [nodeSelection, connections])

  const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, x, y } : node
    ))
  }, [])

  const handlePortClick = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    if (connections.isConnecting && connections.connectionStart) {
      // Complete connection
      if (connections.connectionStart.nodeId !== nodeId) {
        let sourceNodeId, sourcePortId, targetNodeId, targetPortId

        if (connections.connectionStart.type === 'output' && portType === 'input') {
          sourceNodeId = connections.connectionStart.nodeId
          sourcePortId = connections.connectionStart.portId
          targetNodeId = nodeId
          targetPortId = portId
        } else if (connections.connectionStart.type === 'input' && portType === 'output') {
          sourceNodeId = nodeId
          sourcePortId = portId
          targetNodeId = connections.connectionStart.nodeId
          targetPortId = connections.connectionStart.portId
        }

        if (sourceNodeId && sourcePortId && targetNodeId && targetPortId) {
          connections.createConnection(sourceNodeId, sourcePortId, targetNodeId, targetPortId)
        }
      }
      connections.clearConnectionState()
    } else {
      // Start connection
      connections.setIsConnecting(true)
      connections.setConnectionStart({
        nodeId,
        portId,
        type: portType
      })
    }
  }, [connections])

  const handleCanvasMouseMove = useCallback((x: number, y: number) => {
    if (connections.isConnecting && connections.connectionStart) {
      connections.setConnectionPreview({ x, y })
    }
  }, [connections])

  // Drag & Drop handlers for connections
  const handlePortDragStart = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    connections.startDragConnection(nodeId, portId, portType)
  }, [connections])

  const handlePortDrag = useCallback((x: number, y: number) => {
    connections.updateConnectionPreview(x, y)
  }, [connections])

  const handlePortDragEnd = useCallback((targetNodeId?: string, targetPortId?: string) => {
    connections.finishDragConnection(targetNodeId, targetPortId)
  }, [connections])

  const handleCanvasClickInternal = useCallback(() => {
    if (connections.isConnecting) {
      connections.clearConnectionState()
      return
    }
    
    nodeSelection.clearSelection()
    connections.setSelectedConnection(null)
    setShowNodeEditor(false)
  }, [connections, nodeSelection])

  const handleTransformChange = useCallback((transform: d3.ZoomTransform) => {
    const transformObj = {
      x: transform.x,
      y: transform.y,
      k: transform.k
    }
    canvasTransform.saveCanvasTransform(transformObj)
  }, [canvasTransform])

  // Workflow operations
  const saveWorkflow = useCallback(async () => {
    const workflow = {
      name: workflowName,
      definition: {
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: [n.x, n.y],
          parameters: n.config
        })),
        edges: connections.connections.map(c => ({
          id: c.id,
          source: c.sourceNodeId,
          target: c.targetNodeId,
          sourceHandle: c.sourcePortId,
          targetHandle: c.targetPortId
        }))
      }
    }
    
    try {
      console.log('Workflow saved:', workflow)
      alert('Workflow saved successfully!')
    } catch (error) {
      console.error('Failed to save workflow:', error)
      alert('Failed to save workflow')
    }
  }, [workflowName, nodes, connections.connections])

  const executeWorkflow = useCallback(async () => {
    if (nodes.length === 0) {
      alert('Please add nodes to the workflow before executing')
      return
    }

    // Reset node states
    setNodes(prev => prev.map(n => ({ ...n, status: 'idle' })))
    setExecutionState({ 
      status: 'running', 
      completedNodes: [], 
      nodeData: {},
      errors: {},
      logs: []
    })
    
    // Simulate execution with visual feedback
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      setTimeout(() => {
        setNodes(prev => prev.map(n => 
          n.id === node.id ? { ...n, status: 'running' } : n
        ))
        
        setTimeout(() => {
          setNodes(prev => prev.map(n => 
            n.id === node.id ? { ...n, status: 'completed' } : n
          ))
        }, 1000)
      }, i * 1500)
    }
    
    setTimeout(() => {
      setExecutionState(prev => ({ ...prev, status: 'completed' }))
    }, nodes.length * 1500 + 1000)
  }, [nodes])

  const exportWorkflow = useCallback(() => {
    const workflow = {
      name: workflowName,
      nodes,
      connections: connections.connections
    }
    const dataStr = JSON.stringify(workflow, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }, [workflowName, nodes, connections.connections])

  const importWorkflow = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target?.result as string)
        setWorkflowName(workflow.name || 'Imported Workflow')
        setNodes(workflow.nodes || [])
        connections.setConnections(workflow.connections || [])
      } catch (err) {
        console.error('Import error:', err)
        alert('Invalid workflow file')
      }
    }
    reader.readAsText(file)
  }, [connections])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connections.isConnecting) {
          connections.clearConnectionState()
        } else if (showNodeEditor) {
          setShowNodeEditor(false)
        } else if (nodeSelection.selectedNodes.size > 0) {
          nodeSelection.clearSelection()
        }
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (connections.selectedConnection) {
          connections.removeConnection(connections.selectedConnection.id)
        } else if (nodeSelection.selectedNodes.size > 0) {
          const nodeIdsToDelete = Array.from(nodeSelection.selectedNodes)
          nodeIdsToDelete.forEach(nodeId => deleteNode(nodeId))
          nodeSelection.clearSelection()
        } else if (nodeSelection.selectedNode) {
          deleteNode(nodeSelection.selectedNode.id)
        }
      }

      // Select all with Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        nodeSelection.selectAllNodes()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [connections, nodeSelection, showNodeEditor, deleteNode])

  return (
    <div className="advanced-workflow-designer">
      {/* Header */}
      <div className="designer-header">
        <div className="header-left">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="workflow-name-input"
            placeholder="Workflow Name"
          />
          <div className={`status-indicator ${executionState.status}`}>
            {executionState.status === 'running' && '⚡ Running'}
            {executionState.status === 'completed' && '✅ Completed'}
            {executionState.status === 'error' && '❌ Error'}
            {executionState.status === 'idle' && '⭕ Idle'}
          </div>
          {nodeSelection.selectedNodes.size > 0 && (
            <div className="selection-info">
              <span className="selected-count">
                {nodeSelection.selectedNodes.size} node{nodeSelection.selectedNodes.size > 1 ? 's' : ''} selected
              </span>
            </div>
          )}
        </div>

        <div className="header-right">
          <button onClick={saveWorkflow} className="header-btn save-btn">
            <Save size={18} />
            Save
          </button>
          <button 
            onClick={executeWorkflow} 
            className="header-btn execute-btn"
            disabled={executionState.status === 'running'}
          >
            <Play size={18} />
            {executionState.status === 'running' ? 'Running...' : 'Execute'}
          </button>
          <button onClick={exportWorkflow} className="header-btn">
            <Download size={18} />
            Export
          </button>
          <label className="header-btn import-btn">
            <Upload size={18} />
            Import
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importWorkflow(file)
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Main Content */}
      <div className="designer-content">
        {/* Left Sidebar - Node Palette */}
        <div className="left-sidebar">
          <NodePalette onAddNode={addNode} />
        </div>

        {/* Center - Canvas */}
        <div 
          ref={containerRef}
          className={`canvas-container ${isDragOver ? 'drag-over' : ''}`}
          onClick={handleCanvasClick}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
          <svg
            ref={svgRef}
            className="workflow-canvas"
            width="100%"
            height="100%"
          />

          {/* Workflow Canvas with D3 Integration */}
          <WorkflowCanvas
            svgRef={svgRef}
            nodes={nodes}
            connections={connections.connections}
            showGrid={showGrid}
            canvasTransform={canvasTransform.canvasTransformRef.current || { x: 0, y: 0, k: 1 }}
            selectedNodes={nodeSelection.selectedNodes}
            selectedConnection={connections.selectedConnection}
            isNodeSelected={nodeSelection.isNodeSelected}
            isConnecting={connections.isConnecting}
            connectionStart={connections.connectionStart}
            connectionPreview={connections.connectionPreview}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeDrag={handleNodeDrag}
            onConnectionClick={connections.setSelectedConnection}
            onPortClick={handlePortClick}
            onCanvasClick={handleCanvasClickInternal}
            onCanvasMouseMove={handleCanvasMouseMove}
            onPortDragStart={handlePortDragStart}
            onPortDrag={handlePortDrag}
            onPortDragEnd={handlePortDragEnd}
            canDropOnPort={connections.canDropOnPort}
            canDropOnNode={connections.canDropOnNode}
            onTransformChange={handleTransformChange}
          />

          {/* Canvas Toolbar */}
          <CanvasToolbar
            zoomLevel={canvasTransform.zoomLevel}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(!showGrid)}
            onZoomIn={canvasTransform.zoomIn}
            onZoomOut={canvasTransform.zoomOut}
            onFitToScreen={() => canvasTransform.fitToScreen(nodes)}
            onResetPosition={() => canvasTransform.resetCanvasPosition(nodes, getNodeHeight)}
            executionStatus={executionState.status === 'paused' ? 'idle' : executionState.status}
            selectedNodeCount={nodeSelection.selectedNodes.size}
          />
        </div>

        {/* Right Sidebar - Node Editor */}
        {showNodeEditor && nodeSelection.selectedNode && (
          <div className="right-sidebar">
            <NodeEditor
              node={nodeSelection.selectedNode}
              onUpdate={(updatedConfig: any) => {
                if (nodeSelection.selectedNode) {
                  const updatedNode = { ...nodeSelection.selectedNode, config: updatedConfig }
                  setNodes(prev => prev.map(n => 
                    n.id === updatedNode.id ? updatedNode : n
                  ))
                  nodeSelection.setSelectedNode(updatedNode)
                }
              }}
              onDelete={() => {
                if (nodeSelection.selectedNode) {
                  deleteNode(nodeSelection.selectedNode.id)
                  setShowNodeEditor(false)
                }
              }}
              onDuplicate={() => {
                if (nodeSelection.selectedNode) {
                  const duplicatedNode = createNode(
                    nodeSelection.selectedNode.type, 
                    { 
                      x: nodeSelection.selectedNode.x + 50, 
                      y: nodeSelection.selectedNode.y + 50 
                    }
                  )
                  duplicatedNode.config = { ...nodeSelection.selectedNode.config }
                  setNodes(prev => [...prev, duplicatedNode])
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}