import { useState, useEffect, useCallback } from 'react'
import { Save, Trash2, Download, RefreshCw, FileText, Settings, X, Plus, Search } from 'lucide-react'
import { useWorkflowContext } from '../contexts/WorkflowContext'
import type { DraftWorkflow } from '../utils/workflow-storage'

// Custom draft status icon component
const DraftStatusIcon = ({ size = 16, variant = 'default' }: { size?: number; variant?: 'default' | 'subtle' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="draft-status-icon"
  >
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      fill={variant === 'subtle' ? '#e5e7eb' : '#10b981'}
      stroke={variant === 'subtle' ? '#d1d5db' : 'transparent'}
      strokeWidth={variant === 'subtle' ? '1' : '0'}
    />
    <path 
      d="M9 12l2 2 4-4" 
      stroke={variant === 'subtle' ? '#6b7280' : 'white'}
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

interface DraftManagerProps {
  isOpen: boolean
  onClose: () => void
}

export default function DraftManager({ isOpen, onClose }: DraftManagerProps) {
  const { 
    state, 
    saveDraft, 
    loadDraft, 
    deleteDraft, 
    listDrafts, 
    getStorageStats
  } = useWorkflowContext()
  
  const [drafts, setDrafts] = useState<Array<Pick<DraftWorkflow, 'id' | 'name' | 'metadata'>>>([])
  const [storageStats, setStorageStats] = useState<ReturnType<typeof getStorageStats> | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null)
  const [newDraftName, setNewDraftName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  // Load drafts and stats
  const refreshData = useCallback(() => {
    setDrafts(listDrafts())
    setStorageStats(getStorageStats())
  }, [listDrafts, getStorageStats])

  useEffect(() => {
    if (isOpen) {
      refreshData()
    }
  }, [isOpen, refreshData])

  // Refresh data when workflow state changes (for auto-save updates)
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        refreshData()
      }, 2000) // Refresh every 2 seconds when open
      
      return () => clearInterval(interval)
    }
  }, [isOpen, refreshData])

  // Save current workflow as draft
  const handleSaveDraft = useCallback(async () => {
    if (!newDraftName.trim()) {
      alert('Please enter a draft name')
      return
    }

    setIsLoading(true)
    try {
      const draftId = `draft-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      saveDraft(draftId, newDraftName.trim())
      setNewDraftName('')
      refreshData()
      console.log('✅ Draft saved successfully')
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('Failed to save draft')
    } finally {
      setIsLoading(false)
    }
  }, [newDraftName, saveDraft, refreshData])

  // Load selected draft
  const handleLoadDraft = useCallback(async (draftId: string) => {
    setIsLoading(true)
    try {
      const success = loadDraft(draftId)
      if (success) {
        onClose()
        console.log('✅ Draft loaded successfully')
      } else {
        alert('Failed to load draft')
      }
    } catch (error) {
      console.error('Failed to load draft:', error)
      alert('Failed to load draft')
    } finally {
      setIsLoading(false)
    }
  }, [loadDraft, onClose])

  // Delete draft
  const handleDeleteDraft = useCallback(async (draftId: string, draftName: string) => {
    if (!confirm(`Are you sure you want to delete "${draftName}"?`)) {
      return
    }

    setIsLoading(true)
    try {
      deleteDraft(draftId)
      refreshData()
      setSelectedDraft(null)
      console.log('✅ Draft deleted successfully')
    } catch (error) {
      console.error('Failed to delete draft:', error)
      alert('Failed to delete draft')
    } finally {
      setIsLoading(false)
    }
  }, [deleteDraft, refreshData])

  // Format file size

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString()
  }

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return formatDate(timestamp)
  }

  // Filter drafts based on search and type
  const filteredDrafts = drafts.filter(draft => {
    const matchesSearch = draft.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  if (!isOpen) return null

  return (
    <div className="draft-manager-overlay">
      <div className="draft-manager-modal">
        {/* Header */}
        <div className="draft-manager-header">
          <div className="draft-manager-title">
            <FileText size={24} className="draft-manager-icon" />
            <div>
              <h2>Draft Manager</h2>
              <p>Manage your workflow drafts</p>
            </div>
          </div>
          <div className="draft-manager-actions">
            <button
              onClick={refreshData}
              className="draft-action-btn secondary"
              title="Refresh drafts"
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`draft-action-btn secondary ${showSettings ? 'active' : ''}`}
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onClose}
              className="draft-action-btn secondary"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="draft-manager-content">
          {/* Left Panel - Draft List */}
          <div className="draft-list-panel">
            {/* Save New Draft Section */}
            <div className="draft-save-section">
              <div className="draft-save-header">
                <Plus size={18} />
                <span>Save Current Workflow</span>
              </div>
              <div className="draft-save-form">
                <div className="draft-input-group">
                  <input
                    type="text"
                    value={newDraftName}
                    onChange={(e) => setNewDraftName(e.target.value)}
                    placeholder="Enter draft name..."
                    className="draft-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveDraft()}
                  />
                  <button
                    onClick={handleSaveDraft}
                    disabled={isLoading || !newDraftName.trim()}
                    className="draft-save-btn"
                  >
                    <Save size={16} />
                    Save Draft
                  </button>
                </div>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="draft-search-section">
              <div className="draft-search-bar">
                <Search size={16} className="draft-search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search drafts..."
                  className="draft-search-input"
                />
              </div>
              <div className="draft-filter-tabs">
                <button className="draft-filter-tab active">
                  All Drafts ({drafts.length})
                </button>
              </div>
            </div>

            {/* Draft List */}
            <div className="draft-list-container">
              {filteredDrafts.length === 0 ? (
                <div className="draft-empty-state">
                  {searchQuery ? (
                    <>
                      <Search size={48} className="draft-empty-icon" />
                      <h3>No drafts found</h3>
                      <p>Try adjusting your search or filter criteria</p>
                    </>
                  ) : (
                    <>
                      <FileText size={48} className="draft-empty-icon" />
                      <h3>No drafts saved yet</h3>
                      <p>Create your first draft by saving the current workflow</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="draft-list">
                  {filteredDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className={`draft-item ${selectedDraft === draft.id ? 'selected' : ''}`}
                      onClick={() => setSelectedDraft(draft.id)}
                    >
                      <div className="draft-item-header">
                        <div className="draft-item-icon">
                          <FileText size={16} />
                        </div>
                        <div className="draft-item-info">
                          <h4 className="draft-item-name">{draft.name}</h4>
                          <p className="draft-item-date">{formatRelativeTime(draft.metadata.updatedAt)}</p>
                        </div>
                        <div className="draft-item-status">
                          <DraftStatusIcon size={18} variant="subtle" />
                        </div>
                      </div>
                      <div className="draft-item-meta">
                        <span className="draft-version">v{draft.metadata.version}</span>
                        <span className="draft-dot">•</span>
                        <span className="draft-type">
                          Draft
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Draft Details & Actions */}
          <div className="draft-details-panel">
            {selectedDraft ? (
              <>
                {(() => {
                  const draft = drafts.find(d => d.id === selectedDraft)
                  if (!draft) return null
                  
                  return (
                    <>
                      {/* Draft Details */}
                      <div className="draft-details-header">
                        <div className="draft-details-info">
                          <div className="draft-details-icon">
                            <FileText size={20} />
                          </div>
                          <div>
                            <h3 className="draft-details-name">{draft.name}</h3>
                            <p className="draft-details-subtitle">
                              Saved {formatRelativeTime(draft.metadata.updatedAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="draft-actions-group">
                        <button
                          onClick={() => handleLoadDraft(selectedDraft)}
                          disabled={isLoading}
                          className="draft-action-primary"
                        >
                          <Download size={18} />
                          Load Draft
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(selectedDraft, draft.name)}
                          disabled={isLoading}
                          className="draft-action-danger"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>

                      {/* Draft Info Cards */}
                      <div className="draft-info-cards">
                        <div className="draft-info-card">
                          <div className="draft-info-label">Created</div>
                          <div className="draft-info-value">{formatDate(draft.metadata.createdAt)}</div>
                        </div>
                        <div className="draft-info-card">
                          <div className="draft-info-label">Last Modified</div>
                          <div className="draft-info-value">{formatDate(draft.metadata.updatedAt)}</div>
                        </div>
                        <div className="draft-info-card">
                          <div className="draft-info-label">Version</div>
                          <div className="draft-info-value">v{draft.metadata.version}</div>
                        </div>
                        <div className="draft-info-card">
                          <div className="draft-info-label">Type</div>
                          <div className="draft-info-value">
                            Draft
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}

                {/* Storage Statistics */}
                {storageStats && showSettings && (
                  <div className="draft-storage-stats">
                    <h4>Storage Statistics</h4>
                    <div className="draft-stats-grid">
                      <div className="draft-stat-item">
                        <span className="draft-stat-label">Total Drafts</span>
                        <span className="draft-stat-value">{storageStats.draftCount}</span>
                      </div>
                      <div className="draft-stat-item">
                        <span className="draft-stat-label">Storage Used</span>
                        <span className="draft-stat-value">{storageStats.formattedSize}</span>
                      </div>
                      <div className="draft-stat-item">
                        <span className="draft-stat-label">Average Size</span>
                        <span className="draft-stat-value">{storageStats.averageSize}</span>
                      </div>
                      <div className="draft-stat-item">
                        <span className="draft-stat-label">Compressed</span>
                        <span className="draft-stat-value">{storageStats.compressedCount} ({storageStats.compressionRate}%)</span>
                      </div>
                      <div className="draft-stat-item">
                        <span className="draft-stat-label">Largest Draft</span>
                        <span className="draft-stat-value">{storageStats.largestDraft}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="draft-details-empty">
                <div className="draft-empty-illustration">
                  <FileText size={64} />
                </div>
                <h3>Select a Draft</h3>
                <p>Choose a draft from the list to view details and actions</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="draft-manager-footer">
          <div className="draft-footer-info">
            <span className="draft-current-workflow">
              Current: <strong>{state.workflowName}</strong>
            </span>
            {state.isDirty ? (
              <span className="draft-unsaved-indicator">
                <div className="draft-unsaved-dot"></div>
                Auto-saving...
              </span>
            ) : state.lastSaved && (
              <span className="draft-saved-indicator" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DraftStatusIcon size={14} />
                Auto-saved {formatRelativeTime(state.lastSaved)}
              </span>
            )}
          </div>
          <div className="draft-footer-stats">
            <span>{state.nodes.length} nodes</span>
            <span className="draft-footer-separator">•</span>
            <span>{state.connections.length} connections</span>
          </div>
        </div>
      </div>
    </div>
  )
}