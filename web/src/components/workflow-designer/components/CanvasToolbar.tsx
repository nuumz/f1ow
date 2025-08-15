import { ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, RotateCcw, Play, Save, Trash2 } from 'lucide-react'
import './CanvasToolbar.css'

// Import types
// (node variant controls removed for now)

export interface CanvasToolbarProps {
  // Zoom state
  zoomLevel: number
  
  // Grid state
  showGrid: boolean
  onToggleGrid: () => void
  
  // Zoom operations
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToScreen: () => void
  onResetPosition: () => void
  
  // Workflow operations
  onSave?: () => void
  onExecute?: () => void
  
  // Execution state
  executionStatus?: 'idle' | 'running' | 'completed' | 'error'
  
  // Selection info
  selectedNodeCount?: number
  onDeleteSelected?: () => void
}

export default function CanvasToolbar({
  zoomLevel,
  showGrid,
  onToggleGrid,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetPosition,
  onSave,
  onExecute,
  executionStatus = 'idle',
  selectedNodeCount = 0,
  onDeleteSelected
}: Readonly<CanvasToolbarProps>) {
  return (
    <div className="canvas-toolbar">
      {/* Zoom Controls */}
      <div className="toolbar-section">
        <div className="zoom-controls">
          <button 
            onClick={onZoomIn} 
            className="zoom-btn" 
            title="Zoom In"
            disabled={zoomLevel >= 3}
          >
            <ZoomIn size={16} />
          </button>
          <button 
            onClick={onZoomOut} 
            className="zoom-btn" 
            title="Zoom Out"
            disabled={zoomLevel <= 0.4}
          >
            <ZoomOut size={16} />
          </button>
          <span className="zoom-display">{Math.round(zoomLevel * 100)}%</span>
        </div>
      </div>

      {/* View Controls */}
      <div className="toolbar-section">
        <div className="view-controls">
          <button 
            onClick={onFitToScreen} 
            className="control-btn" 
            title="Fit to Screen"
          >
            <Maximize2 size={16} />
          </button>
          <button 
            onClick={onResetPosition} 
            className="control-btn" 
            title="Reset Position"
          >
            <RotateCcw size={16} />
          </button>
          <button 
            onClick={onToggleGrid}
            className={`control-btn ${showGrid ? 'active' : ''}`}
            title={showGrid ? 'Hide Grid' : 'Show Grid'}
          >
            {showGrid ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Selection Info */}
      {selectedNodeCount > 0 && (
        <div className="toolbar-section">
            {onDeleteSelected && (
              <button 
                onClick={onDeleteSelected}
                className="control-btn delete-btn"
                title={`Delete ${selectedNodeCount > 1 ? 'selected nodes' : 'selected node'}`}
              >
                <Trash2 size={16} />
              </button>
            )}
        </div>
      )}

      {/* Workflow Controls */}
      {(onSave || onExecute) && (
        <div className="toolbar-section">
          <div className="workflow-controls">
            {onSave && (
              <button 
                onClick={onSave}
                className="control-btn save-btn"
                title="Save Workflow"
              >
                <Save size={16} />
                <span>Save</span>
              </button>
            )}
            {onExecute && (
              <button 
                onClick={onExecute}
                className={`control-btn execute-btn ${executionStatus === 'running' ? 'running' : ''}`}
                title="Execute Workflow"
                disabled={executionStatus === 'running'}
              >
                <Play size={16} />
                <span>
                  {executionStatus === 'running' ? 'Running...' : 'Execute'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}