/**
 * Architecture Toolbar - Architecture View Selection & Layout Controls
 * Provides architecture-specific layout modes and view types for system design
 */

import { useMemo } from 'react'
import { 
  Box, Webhook, Target, Network, Grid, 
  Eye, EyeOff, Save, Download,
  Settings, RotateCcw, ZoomIn, ZoomOut
} from 'lucide-react'
import './ArchitectureToolbar.css'

interface LayoutMode {
  readonly id: string
  readonly label: string
  readonly icon: typeof Box
  readonly description: string
}

interface ViewMode {
  readonly id: string
  readonly label: string
  readonly icon: typeof Grid
  readonly description: string
}

interface ArchitectureToolbarProps {
  readonly currentLayout?: string
  readonly currentView?: string
  readonly onLayoutChange?: (layoutId: string) => void
  readonly onViewChange?: (viewId: string) => void
  readonly onToggleLayer?: (layer: string, visible: boolean) => void
  readonly onSave?: () => void
  readonly onExport?: () => void
  readonly onSettings?: () => void
  readonly onResetView?: () => void
  readonly onZoom?: (factor: number) => void
  readonly className?: string
  readonly disabled?: boolean
  readonly showGrid?: boolean
  readonly showLabels?: boolean
}

export default function ArchitectureToolbar({
  currentLayout = 'microservices',
  currentView = 'context',
  onLayoutChange,
  onViewChange,
  onToggleLayer,
  onSave,
  onExport,
  onSettings,
  onResetView,
  onZoom,
  className = '',
  disabled = false,
  showGrid = true,
  showLabels = true
}: ArchitectureToolbarProps) {

  const layouts = useMemo<LayoutMode[]>(() => [
    { 
      id: 'microservices', 
      label: 'Microservices', 
      icon: Box, 
      description: 'Service-oriented architecture view' 
    },
    { 
      id: 'api-first', 
      label: 'API First', 
      icon: Webhook, 
      description: 'API-centric architecture view' 
    },
    { 
      id: 'domain-driven', 
      label: 'Domain Driven', 
      icon: Target, 
      description: 'Business domain architecture' 
    },
    { 
      id: 'service-mesh', 
      label: 'Service Mesh', 
      icon: Network, 
      description: 'Infrastructure mesh view' 
    }
  ], [])

  const modes = useMemo<ViewMode[]>(() => [
    { 
      id: 'context', 
      label: 'Context', 
      icon: Grid, 
      description: 'High-level system context' 
    },
    { 
      id: 'api-flow', 
      label: 'API Flow', 
      icon: Webhook, 
      description: 'API interactions and flows' 
    },
    { 
      id: 'service-mesh', 
      label: 'Service Mesh', 
      icon: Network, 
      description: 'Service mesh topology' 
    },
    { 
      id: 'domain-driven', 
      label: 'Domain Model', 
      icon: Target, 
      description: 'Domain-driven design view' 
    }
  ], [])

  const renderLayoutSelector = () => (
    <div className="toolbar-group">
      <span className="toolbar-group-label">
        Architecture Layout{' '}
        <span className="group-badge primary">●</span>
      </span>
      <div className="layout-selector">
        {layouts.map(layout => {
          const IconComponent = layout.icon
          const isActive = currentLayout === layout.id
          
          return (
            <button
              key={layout.id}
              className={`layout-btn ${isActive ? 'active' : ''}`}
              onClick={() => onLayoutChange?.(layout.id)}
              disabled={disabled}
              title={layout.description}
              aria-label={layout.label}
              data-testid={`layout-${layout.id}`}
            >
              <IconComponent size={16} />
              <span className="btn-label">{layout.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderViewModeSelector = () => (
    <div className="toolbar-group">
      <span className="toolbar-group-label">
        View Mode
      </span>
      <div className="view-mode-selector">
        {modes.map(mode => {
          const IconComponent = mode.icon
          const isActive = currentView === mode.id
          
          return (
            <button
              key={mode.id}
              className={`view-mode-btn ${isActive ? 'active' : ''}`}
              onClick={() => onViewChange?.(mode.id)}
              disabled={disabled}
              title={mode.description}
              aria-label={mode.label}
              data-testid={`view-${mode.id}`}
            >
              <IconComponent size={14} />
              <span className="btn-label">{mode.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderViewControls = () => (
    <div className="toolbar-group">
      <span className="toolbar-group-label">
        View Controls
      </span>
      <div className="view-controls">
        <button
          className="control-btn"
          onClick={() => onZoom?.(1.2)}
          disabled={disabled}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="control-btn"
          onClick={() => onZoom?.(0.8)}
          disabled={disabled}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          className="control-btn"
          onClick={onResetView}
          disabled={disabled}
          title="Reset View"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  )

  const renderLayerToggles = () => (
    <div className="toolbar-group">
      <span className="toolbar-group-label">
        Layer Visibility
      </span>
      <div className="layer-toggles">
        <label className="toggle-control">
          <input 
            type="checkbox" 
            checked={showGrid}
            onChange={(e) => onToggleLayer?.('grid', e.target.checked)}
            disabled={disabled}
            data-testid="toggle-grid"
          />
          <div className="toggle-switch">
            <div className="toggle-slider" />
          </div>
          <span className="toggle-text">
            <Grid size={14} />
            Grid
          </span>
        </label>
        
        <label className="toggle-control">
          <input 
            type="checkbox" 
            checked={showLabels}
            onChange={(e) => onToggleLayer?.('labels', e.target.checked)}
            disabled={disabled}
            data-testid="toggle-labels"
          />
          <div className="toggle-switch">
            <div className="toggle-slider" />
          </div>
          <span className="toggle-text">
            {showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
            Labels
          </span>
        </label>
      </div>
    </div>
  )

  const renderActionTools = () => (
    <div className="toolbar-group">
      <span className="toolbar-group-label">
        Actions
      </span>
      <div className="action-tools">
        <button
          className="action-btn primary"
          onClick={onSave}
          disabled={disabled}
          title="Save Architecture"
        >
          <Save size={16} />
          <span className="btn-label">Save</span>
        </button>
        <button
          className="action-btn"
          onClick={onExport}
          disabled={disabled}
          title="Export Diagram"
        >
          <Download size={16} />
          <span className="btn-label">Export</span>
        </button>
        <button
          className="action-btn"
          onClick={onSettings}
          disabled={disabled}
          title="Diagram Settings"
        >
          <Settings size={16} />
          <span className="btn-label">Settings</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className={`architecture-toolbar ${className} ${disabled ? 'disabled' : ''}`}>
      {/* Architecture Layout Selector */}
      {renderLayoutSelector()}
      
      <div className="toolbar-separator" />
      
      {/* View Mode Selector */}
      {renderViewModeSelector()}
      
      <div className="toolbar-separator" />
      
      {/* View Controls */}
      {renderViewControls()}
      
      <div className="toolbar-separator" />
      
      {/* Layer Toggles */}
      {renderLayerToggles()}
      
      <div className="toolbar-spacer" />
      
      {/* Action Tools */}
      {renderActionTools()}
    </div>
  )
}
