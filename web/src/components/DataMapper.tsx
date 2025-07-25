import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Plus, Minus, Code, Eye, Copy } from 'lucide-react'

interface DataItem {
  key: string
  value: any
  type: string
  path: string
  children?: DataItem[]
}

interface MappingRule {
  id: string
  sourcePath: string
  targetPath: string
  transform?: string
  description?: string
}

interface DataMapperProps {
  sourceData: any
  targetSchema: any
  mappings: MappingRule[]
  onMappingChange: (mappings: MappingRule[]) => void
  onTestMapping?: (mapping: MappingRule) => void
}

export default function DataMapper({ 
  sourceData, 
  targetSchema, 
  mappings, 
  onMappingChange,
  onTestMapping 
}: DataMapperProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [selectedMapping, setSelectedMapping] = useState<MappingRule | null>(null)
  const [showExpression, setShowExpression] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)

  // Convert object to tree structure
  const objectToTree = (obj: any, prefix = '', parent = ''): DataItem[] => {
    if (!obj || typeof obj !== 'object') return []

    return Object.entries(obj).map(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      const type = Array.isArray(value) ? 'array' : typeof value
      
      const item: DataItem = {
        key,
        value,
        type,
        path,
        children: type === 'object' || type === 'array' ? objectToTree(value, path, key) : undefined
      }

      return item
    })
  }

  const sourceTree = objectToTree(sourceData)
  const targetTree = objectToTree(targetSchema)

  const toggleExpansion = (path: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string': return '📝'
      case 'number': return '🔢'
      case 'boolean': return '✅'
      case 'array': return '📋'
      case 'object': return '📁'
      default: return '❓'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return '#4CAF50'
      case 'number': return '#2196F3'
      case 'boolean': return '#FF9800'
      case 'array': return '#9C27B0'
      case 'object': return '#00BCD4'
      default: return '#9E9E9E'
    }
  }

  const addMapping = (sourcePath: string, targetPath: string) => {
    const newMapping: MappingRule = {
      id: `mapping-${Date.now()}`,
      sourcePath,
      targetPath,
      description: `Map ${sourcePath} to ${targetPath}`
    }
    onMappingChange([...mappings, newMapping])
  }

  const removeMapping = (mappingId: string) => {
    onMappingChange(mappings.filter(m => m.id !== mappingId))
  }

  const updateMapping = (mappingId: string, updates: Partial<MappingRule>) => {
    onMappingChange(mappings.map(m => 
      m.id === mappingId ? { ...m, ...updates } : m
    ))
  }

  const renderTreeItem = (item: DataItem, side: 'source' | 'target', depth = 0) => {
    const isExpanded = expandedItems.has(item.path)
    const hasChildren = item.children && item.children.length > 0
    const isConnected = mappings.some(m => 
      (side === 'source' && m.sourcePath === item.path) ||
      (side === 'target' && m.targetPath === item.path)
    )

    return (
      <div key={item.path} className="tree-item" style={{ marginLeft: depth * 20 }}>
        <div 
          className={`tree-item-content ${isConnected ? 'connected' : ''}`}
          onClick={() => hasChildren && toggleExpansion(item.path)}
        >
          <div className="tree-item-expand">
            {hasChildren ? (
              isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <div style={{ width: 16 }} />
            )}
          </div>
          
          <div className="tree-item-icon">
            {getTypeIcon(item.type)}
          </div>
          
          <div className="tree-item-details">
            <div className="tree-item-key">{item.key}</div>
            <div 
              className="tree-item-type"
              style={{ color: getTypeColor(item.type) }}
            >
              {item.type}
            </div>
          </div>

          <div className="tree-item-actions">
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(item.path)
              }}
              title="Copy path"
            >
              <Copy size={12} />
            </button>
            
            {side === 'source' && (
              <button
                className="action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  // Start drag or show target selector
                }}
                title="Map to target"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="tree-item-children">
            {item.children!.map(child => 
              renderTreeItem(child, side, depth + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  const renderMappingRule = (mapping: MappingRule) => {
    const isSelected = selectedMapping?.id === mapping.id

    return (
      <div 
        key={mapping.id} 
        className={`mapping-rule ${isSelected ? 'selected' : ''}`}
        onClick={() => setSelectedMapping(mapping)}
      >
        <div className="mapping-rule-content">
          <div className="mapping-path source">
            <span className="path-label">Source:</span>
            <code>{mapping.sourcePath}</code>
          </div>
          
          <div className="mapping-arrow">→</div>
          
          <div className="mapping-path target">
            <span className="path-label">Target:</span>
            <code>{mapping.targetPath}</code>
          </div>
        </div>

        {mapping.transform && (
          <div className="mapping-transform">
            <Code size={14} />
            <code>{mapping.transform}</code>
          </div>
        )}

        <div className="mapping-actions">
          {onTestMapping && (
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation()
                onTestMapping(mapping)
              }}
              title="Test mapping"
            >
              <Eye size={14} />
            </button>
          )}
          
          <button
            className="action-btn danger"
            onClick={(e) => {
              e.stopPropagation()
              removeMapping(mapping.id)
            }}
            title="Remove mapping"
          >
            <Minus size={14} />
          </button>
        </div>
      </div>
    )
  }

  const testAllMappings = () => {
    if (!sourceData) return

    const result: any = {}
    
    mappings.forEach(mapping => {
      try {
        const sourceValue = getValueByPath(sourceData, mapping.sourcePath)
        let mappedValue = sourceValue

        // Apply transformation if exists
        if (mapping.transform) {
          // Simple expression evaluation (in real app, use safe evaluator)
          const func = new Function('value', 'data', `return ${mapping.transform}`)
          mappedValue = func(sourceValue, sourceData)
        }

        setValueByPath(result, mapping.targetPath, mappedValue)
      } catch (error) {
        console.error(`Error mapping ${mapping.sourcePath} to ${mapping.targetPath}:`, error)
      }
    })

    setPreviewData(result)
  }

  const getValueByPath = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  const setValueByPath = (obj: any, path: string, value: any) => {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    target[lastKey] = value
  }

  return (
    <div className="data-mapper">
      <div className="mapper-header">
        <h3>Data Mapping</h3>
        <div className="mapper-actions">
          <button 
            className="btn btn-secondary"
            onClick={testAllMappings}
          >
            <Eye size={16} />
            Preview
          </button>
          <button 
            className={`btn btn-secondary ${showExpression ? 'active' : ''}`}
            onClick={() => setShowExpression(!showExpression)}
          >
            <Code size={16} />
            Expressions
          </button>
        </div>
      </div>

      <div className="mapper-content">
        <div className="mapper-panel source-panel">
          <div className="panel-header">
            <h4>Source Data</h4>
            <span className="item-count">{sourceTree.length} items</span>
          </div>
          <div className="panel-content">
            <div className="tree-view">
              {sourceTree.map(item => renderTreeItem(item, 'source'))}
            </div>
          </div>
        </div>

        <div className="mapper-panel mappings-panel">
          <div className="panel-header">
            <h4>Mappings</h4>
            <span className="item-count">{mappings.length} rules</span>
          </div>
          <div className="panel-content">
            {mappings.length === 0 ? (
              <div className="empty-state">
                <p>No mappings defined</p>
                <p className="help-text">
                  Drag from source to target or use the + button
                </p>
              </div>
            ) : (
              <div className="mappings-list">
                {mappings.map(renderMappingRule)}
              </div>
            )}
          </div>
        </div>

        <div className="mapper-panel target-panel">
          <div className="panel-header">
            <h4>Target Schema</h4>
            <span className="item-count">{targetTree.length} items</span>
          </div>
          <div className="panel-content">
            <div className="tree-view">
              {targetTree.map(item => renderTreeItem(item, 'target'))}
            </div>
          </div>
        </div>
      </div>

      {showExpression && selectedMapping && (
        <div className="expression-editor">
          <div className="editor-header">
            <h4>Transform Expression</h4>
            <p>Use 'value' for the source value, 'data' for full source object</p>
          </div>
          <div className="editor-content">
            <textarea
              value={selectedMapping.transform || ''}
              onChange={(e) => updateMapping(selectedMapping.id, { transform: e.target.value })}
              placeholder="value.toString().toUpperCase()"
              rows={3}
            />
            <div className="expression-help">
              <p><strong>Examples:</strong></p>
              <ul>
                <li><code>value * 2</code> - Multiply by 2</li>
                <li><code>value.toString().toUpperCase()</code> - Convert to uppercase</li>
                <li><code>data.firstName + ' ' + data.lastName</code> - Combine fields</li>
                <li><code>value ? 'Yes' : 'No'</code> - Conditional mapping</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {previewData && (
        <div className="preview-panel">
          <div className="preview-header">
            <h4>Preview Result</h4>
            <button 
              className="btn btn-secondary"
              onClick={() => setPreviewData(null)}
            >
              Close
            </button>
          </div>
          <div className="preview-content">
            <pre>{JSON.stringify(previewData, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}