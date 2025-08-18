import { useState, useEffect } from 'react'
import { GitBranch, Clock, User, Tag, Download, Eye, Plus, RotateCcw, AlertCircle } from 'lucide-react'

interface WorkflowVersion {
  id: string
  version: string
  name: string
  description?: string
  author: string
  createdAt: string
  status: 'draft' | 'published' | 'archived'
  isActive: boolean
  changes: string[]
  nodeCount: number
  executionCount: number
  definition: any
}

interface WorkflowVersionsProps {
  workflowId: string
  onVersionSelect?: (version: WorkflowVersion) => void
  onCreateVersion?: (version: Partial<WorkflowVersion>) => void
}

export function WorkflowVersions({ workflowId, onVersionSelect, onCreateVersion }: WorkflowVersionsProps) {
  const [versions, setVersions] = useState<WorkflowVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<WorkflowVersion | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  // const [showDiffModal, setShowDiffModal] = useState(false)
  // const [compareVersions, setCompareVersions] = useState<[WorkflowVersion, WorkflowVersion] | null>(null)
  const [newVersionData, setNewVersionData] = useState({ name: '', description: '' })

  // Mock data for demonstration
  useEffect(() => {
    const mockVersions: WorkflowVersion[] = [
      {
        id: 'v1',
        version: '1.0.0',
        name: 'Initial Release',
        description: 'First version of the workflow with basic functionality',
        author: 'John Doe',
        createdAt: '2024-01-15T10:00:00Z',
        status: 'archived',
        isActive: false,
        changes: ['Initial implementation', 'Basic HTTP node setup', 'Simple data transformation'],
        nodeCount: 3,
        executionCount: 156,
        definition: { nodes: [], connections: [] }
      },
      {
        id: 'v2',
        version: '1.1.0',
        name: 'Enhanced Processing',
        description: 'Added AI processing and improved error handling',
        author: 'Jane Smith',
        createdAt: '2024-01-20T15:30:00Z',
        status: 'published',
        isActive: false,
        changes: ['Added AI node', 'Improved error handling', 'Enhanced data validation'],
        nodeCount: 5,
        executionCount: 89,
        definition: { nodes: [], connections: [] }
      },
      {
        id: 'v3',
        version: '1.2.0',
        name: 'Current Version',
        description: 'Latest version with database integration and webhooks',
        author: 'Mike Johnson',
        createdAt: '2024-01-25T09:15:00Z',
        status: 'published',
        isActive: true,
        changes: ['Database integration', 'Webhook support', 'Performance optimizations', 'New conditional logic'],
        nodeCount: 8,
        executionCount: 23,
        definition: { nodes: [], connections: [] }
      },
      {
        id: 'v4',
        version: '1.3.0-beta',
        name: 'Beta Release',
        description: 'Testing new features and integrations',
        author: 'Sarah Wilson',
        createdAt: '2024-01-28T14:45:00Z',
        status: 'draft',
        isActive: false,
        changes: ['New integration nodes', 'Advanced data mapping', 'Real-time monitoring'],
        nodeCount: 12,
        executionCount: 0,
        definition: { nodes: [], connections: [] }
      }
    ]
    setVersions(mockVersions)
  }, [workflowId])

  const getStatusColor = (status: WorkflowVersion['status']) => {
    switch (status) {
      case 'published': return '#4CAF50'
      case 'draft': return '#FF9800'
      case 'archived': return '#9E9E9E'
      default: return '#666'
    }
  }

  const getStatusIcon = (status: WorkflowVersion['status']) => {
    switch (status) {
      case 'published': return <Tag size={14} />
      case 'draft': return <Edit size={14} />
      case 'archived': return <Archive size={14} />
      default: return <Tag size={14} />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleCreateVersion = () => {
    if (!newVersionData.name.trim()) {return}
    
    const newVersion: Partial<WorkflowVersion> = {
      name: newVersionData.name,
      description: newVersionData.description,
      author: 'Current User',
      status: 'draft'
    }
    
    onCreateVersion?.(newVersion)
    setShowCreateModal(false)
    setNewVersionData({ name: '', description: '' })
  }

  const handleActivateVersion = (version: WorkflowVersion) => {
    if (confirm(`Are you sure you want to activate version ${version.version}? This will make it the active version for new executions.`)) {
      setVersions(prev => prev.map(v => ({
        ...v,
        isActive: v.id === version.id
      })))
    }
  }

  // const handleCompareVersions = (v1: WorkflowVersion, v2: WorkflowVersion) => {
  //   setCompareVersions([v1, v2])
  //   setShowDiffModal(true)
  // }

  return (
    <div className="page-container">
      <div className="container">
        <div className="workflow-versions">
          <div className="versions-header">
        <div className="header-title">
          <h2>Workflow Versions</h2>
          <p>Manage and track different versions of your workflow</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          Create Version
        </button>
      </div>

      <div className="versions-timeline">
        {versions.map((version, index) => (
          <div key={version.id} className={`version-item ${version.isActive ? 'active' : ''}`}>
            <div className="version-marker">
              <div className="version-dot" style={{ backgroundColor: getStatusColor(version.status) }} />
              {index < versions.length - 1 && <div className="version-line" />}
            </div>
            
            <div className="version-content">
              <div className="version-header">
                <div className="version-info">
                  <h3>
                    {version.name}
                    {version.isActive && <span className="active-badge">ACTIVE</span>}
                  </h3>
                  <div className="version-meta">
                    <span className="version-number">{version.version}</span>
                    <div className="version-status" style={{ color: getStatusColor(version.status) }}>
                      {getStatusIcon(version.status)}
                      {version.status.toUpperCase()}
                    </div>
                  </div>
                </div>
                
                <div className="version-actions">
                  <button
                    className="action-btn"
                    onClick={() => setSelectedVersion(version)}
                    title="View details"
                  >
                    <Eye size={16} />
                  </button>
                  
                  {!version.isActive && version.status === 'published' && (
                    <button
                      className="action-btn"
                      onClick={() => handleActivateVersion(version)}
                      title="Activate version"
                    >
                      <RotateCcw size={16} />
                    </button>
                  )}
                  
                  <button
                    className="action-btn"
                    onClick={() => onVersionSelect?.(version)}
                    title="Load version"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
              
              {version.description && (
                <p className="version-description">{version.description}</p>
              )}
              
              <div className="version-stats">
                <div className="stat">
                  <User size={14} />
                  <span>{version.author}</span>
                </div>
                <div className="stat">
                  <Clock size={14} />
                  <span>{formatDate(version.createdAt)}</span>
                </div>
                <div className="stat">
                  <GitBranch size={14} />
                  <span>{version.nodeCount} nodes</span>
                </div>
                <div className="stat">
                  <span>{version.executionCount} executions</span>
                </div>
              </div>
              
              <div className="version-changes">
                <h4>Changes:</h4>
                <ul>
                  {version.changes.map((change, idx) => (
                    <li key={idx}>{change}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Version Details Modal */}
      {selectedVersion && (
        <div className="version-modal">
          <div className="modal-backdrop" onClick={() => setSelectedVersion(null)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Version {selectedVersion.version} Details</h3>
              <button
                className="modal-close"
                onClick={() => setSelectedVersion(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="version-detail-grid">
                <div className="detail-item">
                  <label>Name:</label>
                  <span>{selectedVersion.name}</span>
                </div>
                <div className="detail-item">
                  <label>Version:</label>
                  <span>{selectedVersion.version}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <span style={{ color: getStatusColor(selectedVersion.status) }}>
                    {selectedVersion.status.toUpperCase()}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Author:</label>
                  <span>{selectedVersion.author}</span>
                </div>
                <div className="detail-item">
                  <label>Created:</label>
                  <span>{formatDate(selectedVersion.createdAt)}</span>
                </div>
                <div className="detail-item">
                  <label>Nodes:</label>
                  <span>{selectedVersion.nodeCount}</span>
                </div>
                <div className="detail-item">
                  <label>Executions:</label>
                  <span>{selectedVersion.executionCount}</span>
                </div>
              </div>
              
              {selectedVersion.description && (
                <div className="detail-section">
                  <label>Description:</label>
                  <p>{selectedVersion.description}</p>
                </div>
              )}
              
              <div className="detail-section">
                <label>Changes in this version:</label>
                <ul className="changes-list">
                  {selectedVersion.changes.map((change, idx) => (
                    <li key={idx}>{change}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedVersion(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onVersionSelect?.(selectedVersion)
                  setSelectedVersion(null)
                }}
              >
                <Download size={16} />
                Load This Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="version-modal">
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Version</h3>
              <button
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-fields">
                <div className="field-group">
                  <label>Version Name *</label>
                  <input
                    type="text"
                    value={newVersionData.name}
                    onChange={(e) => setNewVersionData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Enhanced Processing"
                    required
                  />
                </div>
                
                <div className="field-group">
                  <label>Description</label>
                  <textarea
                    value={newVersionData.description}
                    onChange={(e) => setNewVersionData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what changed in this version..."
                    rows={3}
                  />
                </div>
                
                <div className="version-info-notice">
                  <AlertCircle size={16} />
                  <span>The new version will be created as a draft based on the current workflow state.</span>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateVersion}
                disabled={!newVersionData.name.trim()}
              >
                Create Version
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>  
  )
}

// Add missing Edit and Archive imports
function Edit({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
    </svg>
  )
}

function Archive({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="21,8 21,21 3,21 3,8"/>
      <rect x="1" y="3" width="22" height="5"/>
      <line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  )
}

export default WorkflowVersions