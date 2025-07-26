import { ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, RotateCcw, Play, Save, Trash2 } from 'lucide-react'
import './CanvasToolbar.css'

// Import types
import type { NodeVariant } from '../types'

export interface CanvasToolbarProps {
  // Zoom state
  zoomLevel: number
  
  // Grid state
  showGrid: boolean
  onToggleGrid: () => void
  
  // Node rendering configuration
  nodeVariant?: NodeVariant
  onVariantChange?: (variant: NodeVariant) => void
  
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
  nodeVariant = 'standard',
  onVariantChange,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetPosition,
  onSave,
  onExecute,
  executionStatus = 'idle',
  selectedNodeCount = 0,
  onDeleteSelected
}: CanvasToolbarProps) {
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
            <ZoomIn size={14} />
          </button>
          <button 
            onClick={onZoomOut} 
            className="zoom-btn" 
            title="Zoom Out"
            disabled={zoomLevel <= 0.2}
          >
            <ZoomOut size={14} />
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
            <Maximize2 size={14} />
          </button>
          <button 
            onClick={onResetPosition} 
            className="control-btn" 
            title="Reset Position"
          >
            <RotateCcw size={14} />
          </button>
          <button 
            onClick={onToggleGrid}
            className={`control-btn ${showGrid ? 'active' : ''}`}
            title={showGrid ? 'Hide Grid' : 'Show Grid'}
          >
            {showGrid ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* Node Display Controls */}
      {onVariantChange && (
        <div className="toolbar-section">
          <div className="node-display-controls">
            <div className="control-group">
              <label>Style:</label>
              <select 
                value={nodeVariant} 
                onChange={(e) => onVariantChange(e.target.value as NodeVariant)}
                className="control-select"
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Selection Info */}
      {selectedNodeCount > 0 && (
        <div className="toolbar-section">
            {onDeleteSelected && (
              <button 
                onClick={onDeleteSelected}
                className="control-btn delete-btn"
                title={`Delete ${selectedNodeCount > 1 ? 'selected nodes' : 'selected node'}`}
              >
                <Trash2 size={12} />
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
                <Save size={12} />
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
                <Play size={12} />
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