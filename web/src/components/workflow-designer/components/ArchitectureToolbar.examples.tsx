/**
 * Architecture Toolbar Usage Examples
 * Demonstrates different architecture layout modes and view types
 */

import { useState } from 'react'
import ArchitectureToolbar from './ArchitectureToolbar'

// Example 1: Basic Architecture Toolbar
export function BasicArchitectureToolbar() {
  const [layout, setLayout] = useState('microservices')
  const [view, setView] = useState('context')
  const [showGrid, setShowGrid] = useState(true)
  const [showLabels, setShowLabels] = useState(true)

  return (
    <ArchitectureToolbar
      currentLayout={layout}
      currentView={view}
      showGrid={showGrid}
      showLabels={showLabels}
      onLayoutChange={(newLayout) => {
        console.log('Layout changed to:', newLayout)
        setLayout(newLayout)
      }}
      onViewChange={(newView) => {
        console.log('View changed to:', newView)
        setView(newView)
      }}
      onToggleLayer={(layer, visible) => {
        console.log(`Layer ${layer} toggled:`, visible)
        if (layer === 'grid') setShowGrid(visible)
        if (layer === 'labels') setShowLabels(visible)
      }}
      onSave={() => console.log('Save architecture')}
      onExport={() => console.log('Export diagram')}
      onSettings={() => console.log('Open settings')}
      onResetView={() => console.log('Reset view')}
      onZoom={(factor) => console.log('Zoom factor:', factor)}
    />
  )
}

// Example 2: Microservices Architecture Toolbar
export function MicroservicesArchitectureView() {
  const [currentConfig, setCurrentConfig] = useState({
    layout: 'microservices',
    view: 'context',
    layers: {
      grid: true,
      labels: true,
      services: true,
      apis: true,
      dataFlow: true
    }
  })

  const handleLayoutChange = (layout: string) => {
    setCurrentConfig(prev => ({ ...prev, layout }))
    
    // Auto-switch to appropriate view mode
    const layoutViewMapping = {
      'microservices': 'context',
      'api-first': 'api-flow',
      'domain-driven': 'domain-driven',
      'service-mesh': 'service-mesh'
    }
    
    const suggestedView = layoutViewMapping[layout as keyof typeof layoutViewMapping]
    if (suggestedView) {
      setCurrentConfig(prev => ({ ...prev, view: suggestedView }))
    }
  }

  return (
    <div className="architecture-workspace">
      <ArchitectureToolbar
        currentLayout={currentConfig.layout}
        currentView={currentConfig.view}
        showGrid={currentConfig.layers.grid}
        showLabels={currentConfig.layers.labels}
        onLayoutChange={handleLayoutChange}
        onViewChange={(view) => setCurrentConfig(prev => ({ ...prev, view }))}
        onToggleLayer={(layer, visible) => {
          setCurrentConfig(prev => ({
            ...prev,
            layers: { ...prev.layers, [layer]: visible }
          }))
        }}
        onSave={() => {
          // Save current architecture state
          localStorage.setItem('architecture-config', JSON.stringify(currentConfig))
          console.log('Architecture saved:', currentConfig)
        }}
        onExport={() => {
          // Export as diagram
          const exportData = {
            ...currentConfig,
            timestamp: new Date().toISOString(),
            version: '1.0'
          }
          console.log('Export data:', exportData)
        }}
        onSettings={() => console.log('Open architecture settings')}
        onResetView={() => {
          setCurrentConfig({
            layout: 'microservices',
            view: 'context',
            layers: {
              grid: true,
              labels: true,
              services: true,
              apis: true,
              dataFlow: true
            }
          })
        }}
        onZoom={(factor) => {
          // Handle zoom in architecture canvas
          console.log('Zoom architecture canvas:', factor)
        }}
      />
      
      <div className="architecture-canvas">
        <h3>Current Configuration:</h3>
        <pre>{JSON.stringify(currentConfig, null, 2)}</pre>
      </div>
    </div>
  )
}

// Example 3: API-First Architecture View
export function ApiFirstArchitectureView() {
  const [state, setState] = useState({
    layout: 'api-first',
    view: 'api-flow',
    apiLayers: {
      endpoints: true,
      schemas: true,
      flows: true,
      security: false
    }
  })

  return (
    <ArchitectureToolbar
      currentLayout={state.layout}
      currentView={state.view}
      showGrid={true}
      showLabels={state.apiLayers.endpoints}
      onLayoutChange={(layout) => setState(prev => ({ ...prev, layout }))}
      onViewChange={(view) => setState(prev => ({ ...prev, view }))}
      onToggleLayer={(layer, visible) => {
        if (layer === 'labels') {
          setState(prev => ({
            ...prev,
            apiLayers: { ...prev.apiLayers, endpoints: visible }
          }))
        }
      }}
      onSave={() => console.log('Save API architecture')}
      onExport={() => console.log('Export API documentation')}
      className="api-first-toolbar"
    />
  )
}

// Example 4: Domain-Driven Design View
export function DomainDrivenArchitectureView() {
  const [domainConfig, setDomainConfig] = useState({
    layout: 'domain-driven',
    view: 'domain-driven',
    boundedContexts: true,
    aggregates: true,
    events: false,
    policies: false
  })

  return (
    <ArchitectureToolbar
      currentLayout={domainConfig.layout}
      currentView={domainConfig.view}
      showGrid={domainConfig.boundedContexts}
      showLabels={domainConfig.aggregates}
      onLayoutChange={(layout) => 
        setDomainConfig(prev => ({ ...prev, layout }))
      }
      onViewChange={(view) => 
        setDomainConfig(prev => ({ ...prev, view }))
      }
      onToggleLayer={(layer, visible) => {
        const layerMapping = {
          'grid': 'boundedContexts',
          'labels': 'aggregates'
        }
        const domainLayer = layerMapping[layer as keyof typeof layerMapping]
        if (domainLayer) {
          setDomainConfig(prev => ({ ...prev, [domainLayer]: visible }))
        }
      }}
      onSave={() => console.log('Save domain model')}
      onExport={() => console.log('Export domain documentation')}
      className="domain-driven-toolbar"
    />
  )
}

// Example 5: Service Mesh Architecture View
export function ServiceMeshArchitectureView() {
  const [meshConfig, setMeshConfig] = useState({
    layout: 'service-mesh',
    view: 'service-mesh',
    infrastructure: {
      proxies: true,
      gateways: true,
      policies: false,
      metrics: true
    }
  })

  return (
    <ArchitectureToolbar
      currentLayout={meshConfig.layout}
      currentView={meshConfig.view}
      showGrid={meshConfig.infrastructure.proxies}
      showLabels={meshConfig.infrastructure.gateways}
      onLayoutChange={(layout) => 
        setMeshConfig(prev => ({ ...prev, layout }))
      }
      onViewChange={(view) => 
        setMeshConfig(prev => ({ ...prev, view }))
      }
      onToggleLayer={(layer, visible) => {
        const infraMapping = {
          'grid': 'proxies',
          'labels': 'gateways'
        }
        const infraLayer = infraMapping[layer as keyof typeof infraMapping]
        if (infraLayer) {
          setMeshConfig(prev => ({
            ...prev,
            infrastructure: { ...prev.infrastructure, [infraLayer]: visible }
          }))
        }
      }}
      onSave={() => console.log('Save service mesh config')}
      onExport={() => console.log('Export mesh topology')}
      onSettings={() => console.log('Configure mesh policies')}
      className="service-mesh-toolbar"
      disabled={false}
    />
  )
}

// Usage Example with Custom Styling
export function CustomStyledArchitectureToolbar() {
  return (
    <div style={{ padding: '20px', background: '#f8fafc' }}>
      <ArchitectureToolbar
        currentLayout="microservices"
        currentView="context"
        className="custom-architecture-toolbar"
        onLayoutChange={(layout) => console.log('Custom layout:', layout)}
        onViewChange={(view) => console.log('Custom view:', view)}
        onSave={() => console.log('Custom save')}
        onExport={() => console.log('Custom export')}
      />
      
      <style>{`
        .custom-architecture-toolbar {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
        }
        
        .custom-architecture-toolbar .layout-btn.active {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
        }
      `}</style>
    </div>
  )
}
