import { useState, useEffect } from 'react'
import { Plus, Play, Edit, Trash2, Search, Calendar } from 'lucide-react'
import { WorkflowService, Workflow } from '../services/workflow.service'

export default function WorkflowList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'modified'>('name')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all')

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    try {
      setLoading(true)
      const data = await WorkflowService.getAll()
      setWorkflows(data)
    } catch (error) {
      console.error('Failed to load workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWorkflow = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      try {
        await WorkflowService.delete(id)
        setWorkflows(workflows.filter(w => w.id !== id))
      } catch (error) {
        console.error('Failed to delete workflow:', error)
        alert('Failed to delete workflow')
      }
    }
  }

  const handleExecuteWorkflow = async (id: string) => {
    try {
      const result = await WorkflowService.execute(id, {})
      alert(`Workflow executed successfully! Execution ID: ${result.executionId}`)
    } catch (error) {
      console.error('Failed to execute workflow:', error)
      alert('Failed to execute workflow')
    }
  }

  const filteredWorkflows = workflows
    .filter(workflow => 
      workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (workflow.description && workflow.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'created':
          return new Date(b.id || '').getTime() - new Date(a.id || '').getTime()
        case 'modified':
          return new Date(b.id || '').getTime() - new Date(a.id || '').getTime()
        default:
          return 0
      }
    })

  if (loading) {
    return (
      <div className="workflow-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading workflows...</p>
      </div>
    )
  }

  return (
    <div className="workflow-list">
      <div className="list-header">
        <div className="header-title">
          <h1>f1ow Workflows</h1>
          <p>Manage and execute your automation workflows</p>
        </div>
        <button className="btn btn-primary" onClick={() => window.location.href = '/designer'}>
          <Plus size={16} />
          New Workflow
        </button>
      </div>

      <div className="list-controls">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="control-group">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name">Sort by Name</option>
            <option value="created">Sort by Created</option>
            <option value="modified">Sort by Modified</option>
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      <div className="workflow-grid">
        {filteredWorkflows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No workflows found</h3>
            <p>Create your first workflow to get started</p>
            <button className="btn btn-primary" onClick={() => window.location.href = '/designer'}>
              <Plus size={16} />
              Create Workflow
            </button>
          </div>
        ) : (
          filteredWorkflows.map((workflow) => (
            <div key={workflow.id} className="workflow-card">
              <div className="card-header">
                <h3>{workflow.name}</h3>
                <div className="card-actions">
                  <button
                    className="action-btn"
                    onClick={() => handleExecuteWorkflow(workflow.id!)}
                    title="Execute"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => window.location.href = `/designer/${workflow.id}`}
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="action-btn danger"
                    onClick={() => handleDeleteWorkflow(workflow.id!)}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="card-content">
                <p className="workflow-description">
                  {workflow.description || 'No description provided'}
                </p>
                
                <div className="workflow-stats">
                  <div className="stat">
                    <span className="stat-label">Nodes:</span>
                    <span className="stat-value">{workflow.definition?.nodes?.length || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Connections:</span>
                    <span className="stat-value">{workflow.definition?.edges?.length || 0}</span>
                  </div>
                </div>
              </div>
              
              <div className="card-footer">
                <div className="workflow-status">
                  <span className="status-badge active">Active</span>
                </div>
                <div className="workflow-date">
                  <Calendar size={14} />
                  <span>Created today</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}