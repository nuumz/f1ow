import React, { useEffect, useCallback, useState } from 'react'
import { Save, Play, Download, Upload } from 'lucide-react'

// Import CSS styles
import './WorkflowDesigner.css'

// Import provider and hooks
import { WorkflowProvider, useWorkflowContext } from './contexts/WorkflowContext'
import { useWorkflowOperations } from './hooks/useWorkflowOperations'
import { useWorkflowCanvas } from './hooks/useWorkflowCanvas'
import { useWorkflowEventHandlers } from './hooks/useWorkflowEventHandlers'

// Import components
import WorkflowCanvas from './components/WorkflowCanvas'
import CanvasToolbar from './components/CanvasToolbar'
import NodePalette from '../NodePalette'
import NodeEditor from '../NodeEditor'

// Types
interface WorkflowDesignerProps {
  readonly initialWorkflow?: {
    readonly name?: string
    readonly nodes?: any[]
    readonly connections?: any[]
  }
  readonly onSave?: (workflow: any) => Promise<void>
  readonly onExecute?: (workflow: any) => Promise<void>
  readonly onExport?: (workflow: any) => void
  readonly onImport?: (workflow: any) => void
  readonly className?: string
  readonly showToolbar?: boolean
  readonly showNodePalette?: boolean
  readonly showStatusBar?: boolean
  readonly readOnly?: boolean
}

// Content component props interface
interface WorkflowDesignerContentProps {
  readonly onSave?: (workflow: any) => Promise<void>
  readonly onExecute?: (workflow: any) => Promise<void>
  readonly onExport?: (workflow: any) => void
  readonly onImport?: (workflow: any) => void
  readonly className?: string
  readonly showToolbar?: boolean
  readonly showNodePalette?: boolean
  readonly showStatusBar?: boolean
  readonly readOnly?: boolean
}

// Workflow Designer component that uses the provider
function WorkflowDesignerContent({
  onSave,
  onExecute,
  onExport,
  onImport,
  className = '',
  showToolbar = true,
  showNodePalette = true,
  showStatusBar = true,
  readOnly = false
}: WorkflowDesignerContentProps) {
  const { state, svgRef, containerRef } = useWorkflowContext()
  const operations = useWorkflowOperations()
  const canvas = useWorkflowCanvas()
  const handlers = useWorkflowEventHandlers()

  // File operations
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }, [])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        setIsLoading(true)
        const result = await operations.importWorkflow(file)
        showNotification('success', 'Workflow imported successfully!')
        onImport?.(result)
      } catch (error) {
        console.error('Import failed:', error)
        showNotification('error', 'Failed to import workflow')
      } finally {
        setIsLoading(false)
      }
    }
    // Reset file input
    event.target.value = ''
  }, [operations, onImport, showNotification])

  const handleSave = useCallback(async () => {
    try {
      setIsLoading(true)
      const workflow = await operations.saveWorkflow()
      await onSave?.(workflow)
      showNotification('success', 'Workflow saved successfully!')
    } catch (error) {
      console.error('Save failed:', error)
      showNotification('error', 'Failed to save workflow')
    } finally {
      setIsLoading(false)
    }
  }, [operations, onSave, showNotification])

  const handleExecute = useCallback(async () => {
    try {
      setIsLoading(true)
      const workflow = {
        name: state.workflowName,
        nodes: state.nodes,
        connections: state.connections
      }
      await onExecute?.(workflow)
      await operations.executeWorkflow()
      showNotification('success', 'Workflow executed successfully!')
    } catch (error) {
      console.error('Execute failed:', error)
      showNotification('error', 'Failed to execute workflow')
    } finally {
      setIsLoading(false)
    }
  }, [operations, onExecute, state, showNotification])

  const handleExport = useCallback(() => {
    try {
      const workflow = {
        name: state.workflowName,
        nodes: state.nodes,
        connections: state.connections
      }
      onExport?.(workflow)
      operations.exportWorkflow()
      showNotification('success', 'Workflow exported successfully!')
    } catch (error) {
      console.error('Export failed:', error)
      showNotification('error', 'Failed to export workflow')
    }
  }, [operations, onExport, state, showNotification])

  // Keyboard event setup
  useEffect(() => {
    document.addEventListener('keydown', handlers.handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handlers.handleKeyDown)
    }
  }, [handlers.handleKeyDown])

  return (
    <div className={`workflow-designer ${className}`}>
      {/* Notifications */}
      {notification && (
        <Notification 
          notification={notification} 
          onClose={() => setNotification(null)} 
        />
      )}

      {/* Header */}
      {showToolbar && (
        <div className="workflow-designer-header">
          <div className="workflow-name-section">
            <input
              type="text"
              value={state.workflowName}
              onChange={(e) => operations.setWorkflowName(e.target.value)}
              className="workflow-name-input"
              placeholder="Workflow Name"
              disabled={readOnly}
            />
          </div>
          
          <div className="workflow-actions">
            {!readOnly && (
              <>
                <button 
                  onClick={handleSave}
                  className="action-button save-button"
                  title="Save Workflow"
                  disabled={isLoading}
                >
                  <Save size={16} />
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                
                <button 
                  onClick={handleExecute}
                  className="action-button execute-button"
                  title="Execute Workflow"
                  disabled={state.executionState.status === 'running' || isLoading || state.nodes.length === 0}
                >
                  <Play size={16} />
                  {state.executionState.status === 'running' ? 'Running...' : 'Execute'}
                </button>
              </>
            )}
            
            <button 
              onClick={handleExport}
              className="action-button export-button"
              title="Export Workflow"
              disabled={isLoading || state.nodes.length === 0}
            >
              <Download size={16} />
              Export
            </button>
            
            {!readOnly && (
              <label className={`action-button import-button ${isLoading ? 'disabled' : ''}`} title="Import Workflow">
                <Upload size={16} />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={isLoading}
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="workflow-designer-content">
        {/* Node Palette */}
        {showNodePalette && !readOnly && (
          <div className="node-palette-container">
            <NodePalette onAddNode={operations.addNode} />
          </div>
        )}

        {/* Canvas Container */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <section 
          ref={containerRef}
          className={`canvas-container ${state.uiState.isDragOver ? 'drag-over' : ''}`}
          aria-label="Workflow canvas - interactive workspace"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handlers.handleCanvasClick(e as any)
            }
          }}
          onClick={handlers.handleCanvasClick}
          onDragOver={handlers.handleCanvasDragOver}
          onDragLeave={handlers.handleCanvasDragLeave}
          onDrop={handlers.handleCanvasDrop}
        >
          <svg 
            ref={svgRef} 
            className="workflow-canvas"
            width="100%" 
            height="100%"
          >
            <WorkflowCanvas
              svgRef={svgRef}
              nodes={state.nodes}
              connections={state.connections}
              showGrid={state.uiState.showGrid}
              canvasTransform={state.canvasTransform}
              nodeVariant={state.uiState.nodeVariant}
              selectedNodes={state.selectedNodes}
              selectedConnection={state.connectionState.selectedConnection}
              isNodeSelected={(nodeId: string) => state.selectedNodes.has(nodeId)}
              isConnecting={state.connectionState.isConnecting}
              connectionStart={state.connectionState.connectionStart}
              connectionPreview={state.connectionState.connectionPreview}
              onNodeClick={handlers.handleNodeClick}
              onNodeDoubleClick={handlers.handleNodeDoubleClick}
              onNodeDrag={handlers.handleNodeDrag}
              onConnectionClick={handlers.handleConnectionClick}
              onPortClick={handlers.handlePortClick}
              onCanvasClick={handlers.handleCanvasClickInternal}
              onCanvasMouseMove={handlers.handleCanvasMouseMove}
              onPortDragStart={handlers.handlePortDragStart}
              onPortDrag={handlers.handlePortDrag}
              onPortDragEnd={handlers.handlePortDragEnd}
              canDropOnPort={(targetNodeId: string, targetPortId: string) => {
                const { connectionStart } = state.connectionState
                if (!connectionStart || connectionStart.nodeId === targetNodeId) {
                  return false
                }
                
                // Check if connection already exists
                const existingConnection = state.connections.find(conn => {
                  if (connectionStart.type === 'output') {
                    return conn.sourceNodeId === connectionStart.nodeId &&
                           conn.sourcePortId === connectionStart.portId &&
                           conn.targetNodeId === targetNodeId &&
                           conn.targetPortId === targetPortId
                  } else {
                    return conn.sourceNodeId === targetNodeId &&
                           conn.sourcePortId === targetPortId &&
                           conn.targetNodeId === connectionStart.nodeId &&
                           conn.targetPortId === connectionStart.portId
                  }
                })
                
                return !existingConnection
              }}
              onTransformChange={handlers.handleTransformChange}
              onZoomLevelChange={handlers.handleZoomLevelChange}
              onRegisterZoomBehavior={canvas.registerZoomBehavior}
            />
          </svg>

          {/* Canvas Toolbar */}
          <CanvasToolbar
              zoomLevel={state.canvasTransform.k || 1}
              showGrid={state.uiState.showGrid}
              onToggleGrid={operations.toggleGrid}
              nodeVariant={state.uiState.nodeVariant}
              onVariantChange={operations.setNodeVariant}
              onZoomIn={canvas.zoomIn}
              onZoomOut={canvas.zoomOut}
              onFitToScreen={() => canvas.fitToScreen(state.nodes)}
              onResetPosition={() => canvas.resetCanvasPosition(state.nodes)}
              executionStatus={state.executionState.status === 'paused' ? 'idle' : state.executionState.status}
              selectedNodeCount={state.selectedNodes.size}
              onDeleteSelected={state.selectedNodes.size > 0 ? () => {
                Array.from(state.selectedNodes).forEach(nodeId => {
                  operations.deleteNode(nodeId)
                })
                operations.clearSelection()
              } : undefined}
            />
        </section>

        {/* Node Editor */}
        {state.uiState.showNodeEditor && state.selectedNode && (
          <div className="node-editor-container">
            <NodeEditor
              node={state.selectedNode}
              onUpdate={(config: any) => {
                operations.updateNode(state.selectedNode!.id, { config })
                operations.setShowNodeEditor(false)
              }}
              onDelete={() => {
                if (state.selectedNode) {
                  operations.deleteNode(state.selectedNode.id)
                  operations.setShowNodeEditor(false)
                }
              }}
              onDuplicate={() => {
                if (state.selectedNode) {
                  operations.addNode(state.selectedNode.type, {
                    x: state.selectedNode.x + 50,
                    y: state.selectedNode.y + 50
                  })
                  operations.setShowNodeEditor(false)
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      {showStatusBar && (
        <div className="workflow-designer-status">
          <div className="status-info">
            <span>Nodes: {state.nodes.length}</span>
            <span>Connections: {state.connections.length}</span>
            <span>Selected: {state.selectedNodes.size}</span>
            <span>Zoom: {Math.round(state.canvasTransform.k * 100)}%</span>
            {state.executionState.status !== 'idle' && (
              <span>Status: {state.executionState.status}</span>
            )}
          </div>
          
          <div className="execution-status">
            <span className={`status-indicator ${state.executionState.status}`}>
              {state.executionState.status.toUpperCase()}
            </span>
            {state.executionState.currentNode && (
              <span>Current: {state.executionState.currentNode}</span>
            )}
            {state.executionState.status === 'completed' && state.executionState.endTime && state.executionState.startTime && (() => {
              const duration = Math.round((state.executionState.endTime - state.executionState.startTime) / 1000)
              return <span>Duration: {duration}s</span>
            })()}
          </div>
        </div>
      )}

      {/* Execution Logs (if running) */}
      {state.executionState.status === 'running' && state.executionState.logs.length > 0 && (
        <div className="execution-logs">
          <h3>Execution Logs</h3>
          <div className="logs-container">
            {state.executionState.logs.slice(-10).map((log) => (
              <div key={`${log.nodeId}-${log.timestamp}-${log.level}`} className={`log-entry ${log.level}`}>
                <span className="log-timestamp">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="log-node">{log.nodeId}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Notification component props interface
interface NotificationProps {
  readonly notification: {
    readonly type: 'success' | 'error'
    readonly message: string
  }
  readonly onClose: () => void
}

// Notification component
function Notification({ notification, onClose }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`notification notification-${notification.type}`}>
      {notification.message}
      <button onClick={onClose} className="notification-close">×</button>
    </div>
  )
}

export default function WorkflowDesigner({
  initialWorkflow,
  onSave,
  onExecute,
  onExport,
  onImport,
  className = '',
  showToolbar = true,
  showNodePalette = true,
  showStatusBar = true,
  readOnly = false
}: WorkflowDesignerProps) {
  return (
    <WorkflowProvider initialWorkflow={initialWorkflow}>
      <WorkflowDesignerContent 
        onSave={onSave}
        onExecute={onExecute}
        onExport={onExport}
        onImport={onImport}
        className={className}
        showToolbar={showToolbar}
        showNodePalette={showNodePalette}
        showStatusBar={showStatusBar}
        readOnly={readOnly}
      />
    </WorkflowProvider>
  )
}