import React, { useState, useEffect } from 'react'
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  RefreshCw,
  Calendar,
  Timer,
  Activity
} from 'lucide-react'

interface Execution {
  id: string
  workflowId: string
  workflowName: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  duration?: number
  input: any
  output?: any
  error?: string
  nodeExecutions?: NodeExecution[]
}

interface NodeExecution {
  nodeId: string
  nodeName: string
  status: 'running' | 'completed' | 'failed' | 'skipped'
  startTime: string
  endTime?: string
  duration?: number
  input?: any
  output?: any
  error?: string
}

export default function ExecutionHistory() {
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null)

  useEffect(() => {
    loadExecutions()
    const interval = setInterval(loadExecutions, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const loadExecutions = async () => {
    try {
      setLoading(true)
      // Mock data - replace with actual API call
      const mockExecutions: Execution[] = [
        {
          id: 'exec-1',
          workflowId: 'wf-1',
          workflowName: 'Data Processing Pipeline',
          status: 'completed',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() - 3540000).toISOString(),
          duration: 60000,
          input: { userId: '123', action: 'process' },
          output: { processed: true, recordCount: 150 }
        },
        {
          id: 'exec-2',
          workflowId: 'wf-2',
          workflowName: 'Email Notification Flow',
          status: 'running',
          startTime: new Date(Date.now() - 300000).toISOString(),
          input: { recipients: ['user@example.com'], template: 'welcome' }
        },
        {
          id: 'exec-3',
          workflowId: 'wf-1',
          workflowName: 'Data Processing Pipeline',
          status: 'failed',
          startTime: new Date(Date.now() - 7200000).toISOString(),
          endTime: new Date(Date.now() - 7140000).toISOString(),
          duration: 60000,
          input: { userId: '456', action: 'process' },
          error: 'Database connection timeout'
        }
      ]
      setExecutions(mockExecutions)
    } catch (error) {
      console.error('Failed to load executions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="status-icon running" size={16} />
      case 'completed':
        return <CheckCircle className="status-icon completed" size={16} />
      case 'failed':
        return <XCircle className="status-icon failed" size={16} />
      case 'cancelled':
        return <XCircle className="status-icon cancelled" size={16} />
      default:
        return <Clock className="status-icon" size={16} />
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'Just now'
  }

  const filteredExecutions = executions
    .filter(execution => {
      const matchesSearch = execution.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           execution.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || execution.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

  if (loading) {
    return (
      <div className="execution-history-loading">
        <div className="loading-spinner"></div>
        <p>Loading execution history...</p>
      </div>
    )
  }

  return (
    <div className="execution-history">
      <div className="history-header">
        <div className="header-title">
          <h1>Execution History</h1>
          <p>Monitor workflow executions and performance</p>
        </div>
        <button className="btn btn-secondary" onClick={loadExecutions}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="history-controls">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search executions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="execution-stats">
        <div className="stat-card">
          <Activity className="stat-icon" size={24} />
          <div className="stat-content">
            <div className="stat-value">{executions.length}</div>
            <div className="stat-label">Total Executions</div>
          </div>
        </div>
        <div className="stat-card">
          <CheckCircle className="stat-icon completed" size={24} />
          <div className="stat-content">
            <div className="stat-value">{executions.filter(e => e.status === 'completed').length}</div>
            <div className="stat-label">Successful</div>
          </div>
        </div>
        <div className="stat-card">
          <XCircle className="stat-icon failed" size={24} />
          <div className="stat-content">
            <div className="stat-value">{executions.filter(e => e.status === 'failed').length}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>
        <div className="stat-card">
          <Clock className="stat-icon running" size={24} />
          <div className="stat-content">
            <div className="stat-value">{executions.filter(e => e.status === 'running').length}</div>
            <div className="stat-label">Running</div>
          </div>
        </div>
      </div>

      <div className="execution-list">
        {filteredExecutions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No executions found</h3>
            <p>Execute a workflow to see its history here</p>
          </div>
        ) : (
          filteredExecutions.map((execution) => (
            <div 
              key={execution.id} 
              className={`execution-item ${execution.status}`}
              onClick={() => setSelectedExecution(execution)}
            >
              <div className="execution-main">
                <div className="execution-status">
                  {getStatusIcon(execution.status)}
                  <span className={`status-text ${execution.status}`}>
                    {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                  </span>
                </div>
                
                <div className="execution-info">
                  <h4>{execution.workflowName}</h4>
                  <p className="execution-id">ID: {execution.id}</p>
                </div>
                
                <div className="execution-meta">
                  <div className="meta-item">
                    <Calendar size={14} />
                    <span>{formatTimeAgo(execution.startTime)}</span>
                  </div>
                  <div className="meta-item">
                    <Timer size={14} />
                    <span>{formatDuration(execution.duration)}</span>
                  </div>
                </div>
              </div>
              
              {execution.error && (
                <div className="execution-error">
                  <XCircle size={16} />
                  <span>{execution.error}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {selectedExecution && (
        <div className="execution-modal-overlay" onClick={() => setSelectedExecution(null)}>
          <div className="execution-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Execution Details</h3>
              <button onClick={() => setSelectedExecution(null)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="detail-section">
                <h4>Basic Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Execution ID:</label>
                    <span>{selectedExecution.id}</span>
                  </div>
                  <div className="detail-item">
                    <label>Workflow:</label>
                    <span>{selectedExecution.workflowName}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <span className={`status-badge ${selectedExecution.status}`}>
                      {selectedExecution.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Duration:</label>
                    <span>{formatDuration(selectedExecution.duration)}</span>
                  </div>
                </div>
              </div>
              
              <div className="detail-section">
                <h4>Input Data</h4>
                <pre className="code-block">
                  {JSON.stringify(selectedExecution.input, null, 2)}
                </pre>
              </div>
              
              {selectedExecution.output && (
                <div className="detail-section">
                  <h4>Output Data</h4>
                  <pre className="code-block">
                    {JSON.stringify(selectedExecution.output, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedExecution.error && (
                <div className="detail-section">
                  <h4>Error Details</h4>
                  <div className="error-block">
                    {selectedExecution.error}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}