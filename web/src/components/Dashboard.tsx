import { useState, useEffect } from 'react'
import {
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Workflow,
  Zap,
  BarChart3,
  PieChart
} from 'lucide-react'
import ModernExecutionChart from './ModernExecutionChart'
import AppFooter from './AppFooter'
import { FOOTER_CONFIGS } from '../hooks/useFooter'

interface DashboardStats {
  totalWorkflows: number
  activeWorkflows: number
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  runningExecutions: number
  avgExecutionTime: number
  executionsToday: number
}

interface ChartData {
  date: string
  executions: number
  success: number
  failed: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalWorkflows: 0,
    activeWorkflows: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    runningExecutions: 0,
    avgExecutionTime: 0,
    executionsToday: 0
  })
  
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadDashboardData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (!loading) {
        loadDashboardData(true)
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true)
      }
      setError(null)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, isRefresh ? 500 : 1000))
      
      // Mock data - replace with actual API calls
      const mockStats: DashboardStats = {
        totalWorkflows: 12,
        activeWorkflows: 8,
        totalExecutions: 1547,
        successfulExecutions: 1401,
        failedExecutions: 89,
        runningExecutions: Math.floor(Math.random() * 5) + 1, // Simulate real-time changes
        avgExecutionTime: 45.6,
        executionsToday: 23 + Math.floor(Math.random() * 10) // Simulate new executions
      }
      
      const mockChartData: ChartData[] = [
        { date: '2024-01-01', executions: 45, success: 42, failed: 3 },
        { date: '2024-01-02', executions: 52, success: 48, failed: 4 },
        { date: '2024-01-03', executions: 38, success: 35, failed: 3 },
        { date: '2024-01-04', executions: 67, success: 61, failed: 6 },
        { date: '2024-01-05', executions: 43, success: 40, failed: 3 },
        { date: '2024-01-06', executions: 58, success: 53, failed: 5 },
        { date: '2024-01-07', executions: 72, success: 68, failed: 4 }
      ]
      
      setStats(mockStats)
      setChartData(mockChartData)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadDashboardData(true)
  }

  const handleRetry = () => {
    loadDashboardData(false)
  }

  const calculateSuccessRate = () => {
    if (stats.totalExecutions === 0) return 0
    return Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
  }

  if (loading && !stats.totalWorkflows) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="spinner"></div>
          <p className="loading-text">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !stats.totalWorkflows) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="error-state">
            <XCircle size={48} className="error-icon" />
            <h3>Unable to load dashboard</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={handleRetry}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-content">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>f1ow Dashboard</h1>
          <p>Monitor your workflow automation performance</p>
          {lastUpdated && (
            <p className="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh dashboard data"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={() => window.location.href = '/designer'}>
            Create Workflow
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">
            <Workflow size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{stats.totalWorkflows}</div>
            <div className="metric-label">Total Workflows</div>
            <div className="metric-change positive">
              <TrendingUp size={14} />
              +2 this week
            </div>
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-icon">
            <Activity size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{stats.totalExecutions.toLocaleString()}</div>
            <div className="metric-label">Total Executions</div>
            <div className="metric-change positive">
              <TrendingUp size={14} />
              +{stats.executionsToday} today
            </div>
          </div>
        </div>

        <div className="metric-card info">
          <div className="metric-icon">
            <CheckCircle size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{calculateSuccessRate()}%</div>
            <div className="metric-label">Success Rate</div>
            <div className="metric-change positive">
              <TrendingUp size={14} />
              +2.3% from last week
            </div>
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-icon">
            <Clock size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{stats.avgExecutionTime}s</div>
            <div className="metric-label">Avg Execution Time</div>
            <div className="metric-change negative">
              <TrendingUp size={14} />
              +1.2s from last week
            </div>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="status-overview">
        <div className="overview-card">
          <h3>Execution Status</h3>
          <div className="status-grid">
            <div className="status-item--running">
              <div className="workflow-status__indicator"></div>
              <div className="status-content">
                <span className="status-count">{stats.runningExecutions}</span>
                <span className="status-label">Running</span>
              </div>
            </div>
            <div className="status-item--completed">
              <div className="workflow-status__indicator"></div>
              <div className="status-content">
                <span className="status-count">{stats.successfulExecutions}</span>
                <span className="status-label">Completed</span>
              </div>
            </div>
            <div className="status-item--failed">
              <div className="workflow-status__indicator"></div>
              <div className="status-content">
                <span className="status-count">{stats.failedExecutions}</span>
                <span className="status-label">Failed</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overview-card">
          <h3>Workflow Health</h3>
          <div className="health-indicators">
            <div className="health-item">
              <div className="health-label">Active Workflows</div>
              <div className="health-bar">
                <div 
                  className="health-fill success" 
                  style={{ width: `${(stats.activeWorkflows / stats.totalWorkflows) * 100}%` }}
                ></div>
              </div>
              <div className="health-value">{stats.activeWorkflows}/{stats.totalWorkflows}</div>
            </div>
            <div className="health-item">
              <div className="health-label">System Performance</div>
              <div className="health-bar">
                <div className="health-fill info" style={{ width: '87%' }}></div>
              </div>
              <div className="health-value">87%</div>
            </div>
            <div className="health-item">
              <div className="health-label">Error Rate</div>
              <div className="health-bar">
                <div 
                  className="health-fill warning" 
                  style={{ width: `${(stats.failedExecutions / stats.totalExecutions) * 100}%` }}
                ></div>
              </div>
              <div className="health-value">{Math.round((stats.failedExecutions / stats.totalExecutions) * 100)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        {/* Modern Execution Chart */}
        <ModernExecutionChart data={chartData} />

        <div className="chart-card">
          <div className="chart-header">
            <h3>Performance Metrics</h3>
            <select className="chart-filter">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div className="chart-content">
            <div className="performance-metrics">
              <div className="metric-item">
                <Zap className="performance-metric-icon" size={20} />
                <div className="metric-details">
                  <div className="metric-title">Throughput</div>
                  <div className="metric-value">342 exec/hr</div>
                  <div className="metric-trend positive">↑ 12%</div>
                </div>
              </div>
              <div className="metric-item">
                <BarChart3 className="performance-metric-icon" size={20} />
                <div className="metric-details">
                  <div className="metric-title">Peak Load</div>
                  <div className="metric-value">89 concurrent</div>
                  <div className="metric-trend negative">↓ 5%</div>
                </div>
              </div>
              <div className="metric-item">
                <PieChart className="performance-metric-icon" size={20} />
                <div className="metric-details">
                  <div className="metric-title">Resource Usage</div>
                  <div className="metric-value">67% CPU</div>
                  <div className="metric-trend neutral">→ 0%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <div className="activity-header">
          <h3>Recent Activity</h3>
          <button className="btn btn-link" onClick={() => window.location.href = '/executions'}>
            View All
          </button>
        </div>
        <div className="activity-list">
          <div className="activity-item">
            <div className="activity-icon success">
              <CheckCircle size={16} />
            </div>
            <div className="activity-content">
              <div className="activity-title">Data Processing Pipeline completed</div>
              <div className="activity-time">2 minutes ago</div>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-icon info">
              <Activity size={16} />
            </div>
            <div className="activity-content">
              <div className="activity-title">Email Notification Flow started</div>
              <div className="activity-time">5 minutes ago</div>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-icon failed">
              <XCircle size={16} />
            </div>
            <div className="activity-content">
              <div className="activity-title">API Integration workflow failed</div>
              <div className="activity-time">8 minutes ago</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Footer */}
      <AppFooter 
        config={FOOTER_CONFIGS.DASHBOARD}
        stats={{
          totalExecutions: stats.totalExecutions,
          successRate: calculateSuccessRate()
        }}
      />
      </div>
    </div>
  )
}