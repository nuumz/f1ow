import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Save, Trash2, Download, RefreshCw, FileText, Settings, X, Search, ArrowUpDown, Calendar, ChevronUp, ChevronDown } from 'lucide-react'
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

interface DraftManagerProps { isOpen: boolean; onClose: () => void }

type SortKey = 'name' | 'updated' | 'created' | 'version'
interface SortState { key: SortKey; dir: 'asc' | 'desc' }

interface DraftListItemProps {
  draft: Pick<DraftWorkflow,'id'|'name'|'metadata'>
  isSelected: boolean
  onSelect: (id: string) => void
  onLoad: (id: string) => void
  onDelete: (id: string, name: string) => void
  formatRelativeTime: (ts:number)=>string
}

const DraftListItem = ({ draft, isSelected, onSelect, onLoad, onDelete, formatRelativeTime }: DraftListItemProps) => {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      key={draft.id}
  className={`draft-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(draft.id)}
      onDoubleClick={() => onLoad(draft.id)}
    >
      <div className="draft-item-main">
        <div className="draft-item-icon"><FileText size={16} /></div>
        <div className="draft-item-text">
          <h4 className="draft-item-name" title={draft.name}>{draft.name}</h4>
          <p className="draft-item-date" title={new Date(draft.metadata.updatedAt).toLocaleString()}>
            {formatRelativeTime(draft.metadata.updatedAt)}
          </p>
        </div>
      </div>
      <div className="draft-item-meta-row">
        <span className="draft-version" title={`Version ${draft.metadata.version}`}>v{draft.metadata.version}</span>
        <span className="draft-dot">•</span>
        <span className="draft-type">Draft</span>
      </div>
      <div className="draft-item-actions">
        <button className="inline-action" onClick={(e)=>{e.stopPropagation(); onLoad(draft.id)}} title="Load">
          <Download size={14} />
        </button>
        <button className="inline-action danger" onClick={(e)=>{e.stopPropagation(); onDelete(draft.id, draft.name)}} title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
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
  // Inline name editing for selected draft
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [sort, setSort] = useState<SortState>({ key: 'updated', dir: 'desc' })
  const listContainerRef = useRef<HTMLDivElement | null>(null)

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
      // If we have a current draft, update it (reuse ID) else create new
      const draftId = state.currentDraftId || `draft-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      saveDraft(draftId, newDraftName.trim())
      if (!state.currentDraftId) {
        console.log('✅ Draft created & set as current')
      } else {
        console.log('✅ Draft updated (version increment)')
      }
      refreshData()
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('Failed to save draft')
    } finally {
      setIsLoading(false)
    }
  }, [newDraftName, saveDraft, refreshData, state.currentDraftId])

  // Commit rename for selected draft (uses editingName)
  const commitRename = useCallback(async (draftId: string) => {
    const name = editingName.trim()
    if (!name) { setIsEditingName(false); setEditingName(''); return }
    if (drafts.find(d=>d.id===draftId)?.name === name) { setIsEditingName(false); return }
    setIsLoading(true)
    try {
      saveDraft(draftId, name)
      console.log('✅ Draft renamed')
      refreshData()
    } catch (e) {
      console.error('Failed to rename draft', e)
    } finally {
      setIsLoading(false)
      setIsEditingName(false)
    }
  }, [editingName, saveDraft, refreshData, drafts])

  // Removed save-as-new explicit button (panel feature removed)

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
  const filteredDrafts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = q ? drafts.filter(d => d.name.toLowerCase().includes(q)) : drafts.slice()
    base.sort((a,b) => {
      const dirMul = sort.dir === 'asc' ? 1 : -1
      switch (sort.key) {
        case 'name': return a.name.localeCompare(b.name) * dirMul
        case 'updated': return (a.metadata.updatedAt - b.metadata.updatedAt) * dirMul
        case 'created': return (a.metadata.createdAt - b.metadata.createdAt) * dirMul
        case 'version': {
          const av = Number(a.metadata.version) || 0
          const bv = Number(b.metadata.version) || 0
            return (av - bv) * dirMul
        }
        default: return 0
      }
    })
    return base
  }, [drafts, searchQuery, sort])

  const cycleSort = (key: SortKey) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: key === 'name' ? 'asc' : 'desc' }
      // toggle dir
      return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    })
  }

  // Keyboard navigation (arrow up/down, enter, delete)
  const handleKeyNav = useCallback((e: React.KeyboardEvent) => {
    if (!filteredDrafts.length) return
    if (['ArrowDown','ArrowUp','Enter','Delete','Backspace'].includes(e.key)) e.preventDefault()
    const currentIndex = selectedDraft ? filteredDrafts.findIndex(d=>d.id===selectedDraft) : -1
    if (e.key === 'ArrowDown') {
      const next = filteredDrafts[Math.min(filteredDrafts.length-1, currentIndex + 1)]
      if (next) setSelectedDraft(next.id)
    } else if (e.key === 'ArrowUp') {
      const prev = filteredDrafts[Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1)]
      if (prev) setSelectedDraft(prev.id)
    } else if (e.key === 'Enter' && selectedDraft) {
      handleLoadDraft(selectedDraft)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDraft) {
      const target = drafts.find(d=>d.id===selectedDraft)
      if (target) handleDeleteDraft(selectedDraft, target.name)
    }
  }, [filteredDrafts, selectedDraft, handleLoadDraft, handleDeleteDraft, drafts])

  if (!isOpen) return null

  return (
    <div className="draft-manager-overlay">
  <div className="draft-manager-modal" onKeyDown={handleKeyNav} tabIndex={0} ref={listContainerRef}>
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
            {/* (Save form moved to right panel to reduce clutter) */}

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
              <div className="draft-filter-tabs sort-bar">
                <button type="button" className={`draft-filter-tab ${sort.key==='updated' ? 'active': ''}`} onClick={()=>cycleSort('updated')}>
                  <Calendar size={14}/> Updated {sort.key==='updated' && (sort.dir==='asc'? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
                </button>
                <button type="button" className={`draft-filter-tab ${sort.key==='name' ? 'active': ''}`} onClick={()=>cycleSort('name')}>
                  <ArrowUpDown size={14}/> Name {sort.key==='name' && (sort.dir==='asc'? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
                </button>
                <button type="button" disabled className="draft-filter-tab disabled">
                  All ({drafts.length})
                </button>
              </div>
            </div>

            {/* Draft List */}
            <div className="draft-list-container" role="listbox" aria-label="Draft list">
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
                  {filteredDrafts.map(draft => (
                    <DraftListItem
                      key={draft.id}
                      draft={draft}
                      isSelected={selectedDraft===draft.id}
                      onSelect={setSelectedDraft}
                      onLoad={handleLoadDraft}
                      onDelete={handleDeleteDraft}
                      formatRelativeTime={formatRelativeTime}
                    />
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
                      {/* Draft Details with click-to-edit name */}
                      <div className="draft-details-header">
                        <div className="draft-details-info">
                          <div className="draft-details-icon">
                            <FileText size={20} />
                          </div>
                          <div className="draft-details-text">
                            {!isEditingName ? (
                              <h3
                                className="draft-details-name editable"
                                title="Click to rename"
                                onClick={()=>{ setIsEditingName(true); setEditingName(draft.name); }}
                              >
                                {draft.name}
                              </h3>
                            ) : (
                              <input
                                className="draft-name-edit-input"
                                value={editingName}
                                autoFocus
                                onChange={(e)=>setEditingName(e.target.value)}
                                onKeyDown={(e)=> {
                                  if (e.key==='Enter') commitRename(draft.id)
                                  if (e.key==='Escape') { setIsEditingName(false); setEditingName('') }
                                }}
                                onBlur={()=> commitRename(draft.id)}
                              />
                            )}
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
                <h3>No Draft Selected</h3>
                <p>Create or update a draft from current workflow</p>
                <div className="draft-empty-save">
                  <div className="draft-empty-save-row">
                    <input
                      type="text"
                      value={newDraftName}
                      onChange={(e)=>setNewDraftName(e.target.value)}
                      placeholder="Enter draft name..."
                      onKeyPress={(e)=> e.key==='Enter' && newDraftName.trim() && handleSaveDraft()}
                      className="draft-empty-save-input"
                    />
                    <button
                      onClick={handleSaveDraft}
                      disabled={isLoading || !newDraftName.trim()}
                      className="draft-empty-save-btn"
                    >
                      <Save size={16}/> {state.currentDraftId ? 'Update Draft' : 'Save Draft'}
                    </button>
                  </div>
                </div>
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