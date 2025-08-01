/**
 * Architecture Toolbar - Modern & Clean Design
 * Comprehensive toolbar for architecture diagram operations
 */

import { useMemo } from 'react'
import { 
  Layout, Grid3X3, Layers, AlignLeft, AlignCenter, AlignRight,
  ZoomIn, ZoomOut, RotateCcw, Save, Download, Share2, 
  Settings, Eye
} from 'lucide-react'
import './ArchitectureToolbar.css'

interface ToolItem {
  readonly id: string
  readonly label: string
  readonly icon: typeof Layout
  readonly action?: () => void
  readonly shortcut?: string
  readonly variant?: 'primary'
}

interface ArchitectureToolbarProps {
  readonly onAutoLayout?: () => void
  readonly onGridToggle?: (enabled: boolean) => void
  readonly onLayerToggle?: (layer: string, visible: boolean) => void
  readonly onAlignNodes?: (direction: 'left' | 'center' | 'right' | 'top' | 'bottom') => void
  readonly onZoom?: (factor: number) => void
  readonly onResetView?: () => void
  readonly onSave?: () => void
  readonly onExport?: () => void
  readonly onShare?: () => void
  readonly onSettings?: () => void
  readonly className?: string
  readonly disabled?: boolean
}

export default function ArchitectureToolbar({
  onAutoLayout,
  onGridToggle,
  onLayerToggle,
  onAlignNodes,
  onZoom,
  onResetView,
  onSave,
  onExport,
  onShare,
  onSettings,
  className = '',
  disabled = false
}: ArchitectureToolbarProps) {

  const layoutTools = useMemo<ToolItem[]>(() => [
    {
      id: 'auto-layout',
      label: 'Auto Layout',
      icon: Layout,
      action: onAutoLayout,
      shortcut: '⌘ + L'
    },
    {
      id: 'grid-snap',
      label: 'Grid Snap',
      icon: Grid3X3,
      action: () => onGridToggle?.(true),
      shortcut: '⌘ + G'
    },
    {
      id: 'layers',
      label: 'Layers',
      icon: Layers,
      action: () => onLayerToggle?.('all', true),
      shortcut: '⌘ + ⇧ + L'
    }
  ], [onAutoLayout, onGridToggle, onLayerToggle])

  const alignmentTools = useMemo<ToolItem[]>(() => [
    {
      id: 'align-left',
      label: 'Align Left',
      icon: AlignLeft,
      action: () => onAlignNodes?.('left'),
      shortcut: '⌘ + ⇧ + L'
    },
    {
      id: 'align-center',
      label: 'Align Center',
      icon: AlignCenter,
      action: () => onAlignNodes?.('center'),
      shortcut: '⌘ + ⇧ + C'
    },
    {
      id: 'align-right',
      label: 'Align Right',
      icon: AlignRight,
      action: () => onAlignNodes?.('right'),
      shortcut: '⌘ + ⇧ + R'
    }
  ], [onAlignNodes])

  const viewTools = useMemo<ToolItem[]>(() => [
    {
      id: 'zoom-in',
      label: 'Zoom In',
      icon: ZoomIn,
      action: () => onZoom?.(1.2),
      shortcut: '⌘ + +'
    },
    {
      id: 'zoom-out',
      label: 'Zoom Out',
      icon: ZoomOut,
      action: () => onZoom?.(0.8),
      shortcut: '⌘ + -'
    },
    {
      id: 'reset-view',
      label: 'Reset View',
      icon: RotateCcw,
      action: onResetView,
      shortcut: '⌘ + 0'
    }
  ], [onZoom, onResetView])

  const actionTools = useMemo<ToolItem[]>(() => [
    {
      id: 'save',
      label: 'Save',
      icon: Save,
      action: onSave,
      variant: 'primary',
      shortcut: '⌘ + S'
    },
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      action: onExport,
      shortcut: '⌘ + E'
    },
    {
      id: 'share',
      label: 'Share',
      icon: Share2,
      action: onShare,
      shortcut: '⌘ + ⇧ + S'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: onSettings,
      shortcut: '⌘ + ,'
    }
  ], [onSave, onExport, onShare, onSettings])

  const renderToolGroup = (tools: ToolItem[], groupLabel: string) => (
    <div className="toolbar-group">
      <span className="toolbar-group-label">{groupLabel}</span>
      <div className="toolbar-buttons">
        {tools.map(tool => {
          const IconComponent = tool.icon
          const isDisabled = disabled || !tool.action
          const buttonTitle = tool.shortcut ? 
            `${tool.label} (${tool.shortcut})` : 
            tool.label
          
          return (
            <button
              key={tool.id}
              className={`toolbar-btn ${tool.variant === 'primary' ? 'primary' : ''}`}
              onClick={tool.action}
              disabled={isDisabled}
              title={buttonTitle}
              aria-label={tool.label}
            >
              <IconComponent size={16} />
              <span className="btn-label">{tool.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={`architecture-toolbar ${className} ${disabled ? 'disabled' : ''}`}>
      {/* Layout Tools */}
      {renderToolGroup(layoutTools, 'Layout')}
      
      <div className="toolbar-separator" />
      
      {/* Alignment Tools */}
      {renderToolGroup(alignmentTools, 'Align')}
      
      <div className="toolbar-separator" />
      
      {/* View Tools */}
      {renderToolGroup(viewTools, 'View')}
      
      <div className="toolbar-spacer" />
      
      {/* Action Tools */}
      {renderToolGroup(actionTools, 'Actions')}
      
      {/* Quick Mode Toggles */}
      <div className="toolbar-group">
        <span className="toolbar-group-label">Mode</span>
        <div className="toolbar-toggles">
          <label className="toggle-control">
            <input 
              type="checkbox" 
              defaultChecked 
              onChange={(e) => onLayerToggle?.('grid', e.target.checked)}
              disabled={disabled}
            />
            <div className="toggle-switch">
              <div className="toggle-slider" />
            </div>
            <span className="toggle-text">
              <Grid3X3 size={14} />
              Grid
            </span>
          </label>
          
          <label className="toggle-control">
            <input 
              type="checkbox" 
              defaultChecked 
              onChange={(e) => onLayerToggle?.('labels', e.target.checked)}
              disabled={disabled}
            />
            <div className="toggle-switch">
              <div className="toggle-slider" />
            </div>
            <span className="toggle-text">
              <Eye size={14} />
              Labels
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
