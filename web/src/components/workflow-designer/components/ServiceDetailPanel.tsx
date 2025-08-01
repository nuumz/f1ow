import { useState, useCallback } from 'react'
import type { ArchitectureNode, APIDependency } from '../types/architecture'
import './ServiceDetailPanel.css'

interface ServiceDetailPanelProps {
  service: ArchitectureNode
  dependencies: APIDependency[]
  onClose: () => void
  onUpdate: (service: ArchitectureNode) => void
  onDeleteService: (serviceId: string) => void
}

interface ServiceConfiguration {
  runtime: string
  version: string
  replicas: number
  cpu: string
  memory: string
  storage: string
  environment: 'development' | 'staging' | 'production'
  monitoring: {
    healthCheck: string
    metrics: boolean
    logging: boolean
    alerts: boolean
  }
  networking: {
    port: number
    protocol: 'http' | 'https' | 'grpc'
    loadBalancer: boolean
    ingress: boolean
  }
  security: {
    authentication: boolean
    authorization: boolean
    encryption: boolean
    secrets: string[]
  }
}

const defaultConfig: ServiceConfiguration = {
  runtime: 'nodejs',
  version: '18.x',
  replicas: 2,
  cpu: '0.5',
  memory: '512Mi',
  storage: '1Gi',
  environment: 'development',
  monitoring: {
    healthCheck: '/health',
    metrics: true,
    logging: true,
    alerts: true
  },
  networking: {
    port: 3000,
    protocol: 'https',
    loadBalancer: true,
    ingress: true
  },
  security: {
    authentication: true,
    authorization: true,
    encryption: true,
    secrets: []
  }
}

export default function ServiceDetailPanel({
  service,
  dependencies,
  onClose,
  onUpdate,
  onDeleteService
}: Readonly<ServiceDetailPanelProps>) {
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'dependencies' | 'monitoring'>('overview')
  const [config, setConfig] = useState<ServiceConfiguration>(
    service.data?.config || defaultConfig
  )
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const incomingDeps = dependencies.filter(dep => dep.targetServiceId === service.id)
  const outgoingDeps = dependencies.filter(dep => dep.sourceServiceId === service.id)

  const handleSave = useCallback(() => {
    const updatedService = {
      ...service,
      data: {
        ...service.data,
        config
      }
    }
    onUpdate(updatedService)
    setIsEditing(false)
  }, [service, config, onUpdate])

  const handleCancel = useCallback(() => {
    setConfig(service.data?.config || defaultConfig)
    setIsEditing(false)
  }, [service.data?.config])

  const handleDelete = useCallback(() => {
    onDeleteService(service.id)
    onClose()
  }, [service.id, onDeleteService, onClose])

  const renderOverviewTab = () => (
    <div className="overview-tab">
      <div className="service-metrics">
        <div className="metrics-grid">
          <div className="metric-item">
            <div className="metric-value">98.9%</div>
            <div className="metric-label">Uptime</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">45ms</div>
            <div className="metric-label">Avg Response</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{incomingDeps.length}</div>
            <div className="metric-label">Dependencies</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{outgoingDeps.length}</div>
            <div className="metric-label">Dependents</div>
          </div>
        </div>
      </div>

      <div className="service-info-section">
        <h4>📋 Service Information</h4>
        <div className="info-grid">
          <div className="info-item">
            <span>Type:</span>
            <span>{service.category}</span>
          </div>
          <div className="info-item">
            <span>Environment:</span>
            <span className={`env-badge ${config.environment}`}>
              {config.environment}
            </span>
          </div>
          <div className="info-item">
            <span>Runtime:</span>
            <span>{config.runtime} {config.version}</span>
          </div>
          <div className="info-item">
            <span>Replicas:</span>
            <span>{config.replicas}</span>
          </div>
        </div>
      </div>

      <div className="endpoints-section">
        <h4>🔗 API Endpoints</h4>
        <div className="endpoints-list">
          {outgoingDeps.map((dep) => (
            <div key={dep.id} className="endpoint-item">
              <div className="endpoint-header">
                <span className={`method-badge ${dep.method.toLowerCase()}`}>
                  {dep.method}
                </span>
                <span className="endpoint-path">{dep.apiPath}</span>
              </div>
              <div className="endpoint-stats">
                <span className="call-count">
                  {dep.consumers.reduce((total, consumer) => {
                    let dailyCalls = 10
                    if (consumer.frequency === 'high') dailyCalls = 1000
                    else if (consumer.frequency === 'medium') dailyCalls = 100
                    return total + dailyCalls
                  }, 0)} calls/day
                </span>
                <span className={`status-indicator ${dep.status}`}>
                  {dep.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderConfigTab = () => (
    <div className="config-tab">
      <div className="config-section">
        <h4>⚙️ Runtime Configuration</h4>
        <div className="config-grid">
          <div className="config-item">
            <label htmlFor="runtime">Runtime:</label>
            <select
              id="runtime"
              value={config.runtime}
              onChange={(e) => setConfig(prev => ({ ...prev, runtime: e.target.value }))}
              disabled={!isEditing}
            >
              <option value="nodejs">Node.js</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="dotnet">.NET</option>
              <option value="go">Go</option>
            </select>
          </div>
          <div className="config-item">
            <label htmlFor="version">Version:</label>
            <input
              id="version"
              type="text"
              value={config.version}
              onChange={(e) => setConfig(prev => ({ ...prev, version: e.target.value }))}
              disabled={!isEditing}
            />
          </div>
          <div className="config-item">
            <label htmlFor="replicas">Replicas:</label>
            <input
              id="replicas"
              type="number"
              min="1"
              max="10"
              value={config.replicas}
              onChange={(e) => setConfig(prev => ({ ...prev, replicas: parseInt(e.target.value) }))}
              disabled={!isEditing}
            />
          </div>
          <div className="config-item">
            <label htmlFor="environment">Environment:</label>
            <select
              id="environment"
              value={config.environment}
              onChange={(e) => setConfig(prev => ({ ...prev, environment: e.target.value as ServiceConfiguration['environment'] }))}
              disabled={!isEditing}
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
        </div>
      </div>

      <div className="config-section">
        <h4>🖥️ Resources</h4>
        <div className="config-grid">
          <div className="config-item">
            <label htmlFor="cpu">CPU:</label>
            <input
              id="cpu"
              type="text"
              value={config.cpu}
              onChange={(e) => setConfig(prev => ({ ...prev, cpu: e.target.value }))}
              disabled={!isEditing}
              placeholder="0.5"
            />
          </div>
          <div className="config-item">
            <label htmlFor="memory">Memory:</label>
            <input
              id="memory"
              type="text"
              value={config.memory}
              onChange={(e) => setConfig(prev => ({ ...prev, memory: e.target.value }))}
              disabled={!isEditing}
              placeholder="512Mi"
            />
          </div>
          <div className="config-item">
            <label htmlFor="storage">Storage:</label>
            <input
              id="storage"
              type="text"
              value={config.storage}
              onChange={(e) => setConfig(prev => ({ ...prev, storage: e.target.value }))}
              disabled={!isEditing}
              placeholder="1Gi"
            />
          </div>
        </div>
      </div>

      <div className="config-section">
        <h4>🌐 Networking</h4>
        <div className="config-grid">
          <div className="config-item">
            <label htmlFor="port">Port:</label>
            <input
              id="port"
              type="number"
              min="1"
              max="65535"
              value={config.networking.port}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                networking: { ...prev.networking, port: parseInt(e.target.value) }
              }))}
              disabled={!isEditing}
            />
          </div>
          <div className="config-item">
            <label htmlFor="protocol">Protocol:</label>
            <select
              id="protocol"
              value={config.networking.protocol}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                networking: { ...prev.networking, protocol: e.target.value as ServiceConfiguration['networking']['protocol'] }
              }))}
              disabled={!isEditing}
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="grpc">gRPC</option>
            </select>
          </div>
        </div>
        <div className="checkbox-grid">
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.networking.loadBalancer}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                networking: { ...prev.networking, loadBalancer: e.target.checked }
              }))}
              disabled={!isEditing}
            />
            {' '}Load Balancer
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.networking.ingress}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                networking: { ...prev.networking, ingress: e.target.checked }
              }))}
              disabled={!isEditing}
            />
            {' '}Ingress
          </label>
        </div>
      </div>

      <div className="config-actions">
        {!isEditing ? (
          <button 
            className="edit-button"
            onClick={() => setIsEditing(true)}
          >
            ✏️ Edit Configuration
          </button>
        ) : (
          <div className="edit-actions">
            <button 
              className="save-button"
              onClick={handleSave}
            >
              💾 Save Changes
            </button>
            <button 
              className="cancel-button"
              onClick={handleCancel}
            >
              ❌ Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const renderDependenciesTab = () => (
    <div className="dependencies-tab">
      <div className="dependencies-section">
        <h4>📥 Incoming Dependencies ({incomingDeps.length})</h4>
        <div className="dependencies-list">
          {incomingDeps.map((dep) => (
            <div key={dep.id} className="dependency-item">
              <div className="dependency-header">
                <span className={`method-badge ${dep.method.toLowerCase()}`}>
                  {dep.method}
                </span>
                <span className="dependency-path">{dep.apiPath}</span>
              </div>
              <div className="dependency-details">
                <span className="source-service">from: {dep.sourceServiceId}</span>
                <span className={`criticality-badge ${dep.status}`}>
                  {dep.status}
                </span>
              </div>
            </div>
          ))}
          {incomingDeps.length === 0 && (
            <div className="no-dependencies">
              No incoming dependencies
            </div>
          )}
        </div>
      </div>

      <div className="dependencies-section">
        <h4>📤 Outgoing Dependencies ({outgoingDeps.length})</h4>
        <div className="dependencies-list">
          {outgoingDeps.map((dep) => (
            <div key={dep.id} className="dependency-item">
              <div className="dependency-header">
                <span className={`method-badge ${dep.method.toLowerCase()}`}>
                  {dep.method}
                </span>
                <span className="dependency-path">{dep.apiPath}</span>
              </div>
              <div className="dependency-details">
                <span className="target-service">to: {dep.targetServiceId}</span>
                <span className={`criticality-badge ${dep.status}`}>
                  {dep.status}
                </span>
              </div>
            </div>
          ))}
          {outgoingDeps.length === 0 && (
            <div className="no-dependencies">
              No outgoing dependencies
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderMonitoringTab = () => (
    <div className="monitoring-tab">
      <div className="monitoring-section">
        <h4>📊 Health Monitoring</h4>
        <div className="monitoring-grid">
          <div className="monitoring-item">
            <label htmlFor="healthCheck">Health Check Endpoint:</label>
            <input
              id="healthCheck"
              type="text"
              value={config.monitoring.healthCheck}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                monitoring: { ...prev.monitoring, healthCheck: e.target.value }
              }))}
              disabled={!isEditing}
            />
          </div>
        </div>
        <div className="checkbox-grid">
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.monitoring.metrics}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                monitoring: { ...prev.monitoring, metrics: e.target.checked }
              }))}
              disabled={!isEditing}
            />
            {' '}Metrics Collection
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.monitoring.logging}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                monitoring: { ...prev.monitoring, logging: e.target.checked }
              }))}
              disabled={!isEditing}
            />
            {' '}Application Logging
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.monitoring.alerts}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                monitoring: { ...prev.monitoring, alerts: e.target.checked }
              }))}
              disabled={!isEditing}
            />
            {' '}Alert Notifications
          </label>
        </div>
      </div>

      <div className="monitoring-section">
        <h4>🔒 Security Settings</h4>
        <div className="checkbox-grid">
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.security.authentication}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                security: { ...prev.security, authentication: e.target.checked }
              }))}
              disabled={!isEditing}
            />
            {' '}Authentication Required
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.security.authorization}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                security: { ...prev.security, authorization: e.target.checked }
              }))}
              disabled={!isEditing}
            />
            {' '}Authorization Checks
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.security.encryption}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                security: { ...prev.security, encryption: e.target.checked }
              }))}
              disabled={!isEditing}
            />
            {' '}Data Encryption
          </label>
        </div>
      </div>

      <div className="status-indicators">
        <div className="status-item healthy">
          <span className="status-dot"></span>
          <span>Service Healthy</span>
        </div>
        <div className="status-item">
          <span className="status-dot"></span>
          <span>Last Check: 2 minutes ago</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="service-detail-panel">
      <div className="panel-header">
        <div className="service-title">
          <h3>
            <span className="service-icon">🔧</span>
            {service.label}
          </h3>
          <div className="service-subtitle">
            {service.category} • {service.id}
          </div>
        </div>
        <div className="header-actions">
          <button
            className="delete-button"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete Service"
          >
            🗑️
          </button>
          <button 
            className="close-button"
            onClick={onClose}
            title="Close Panel"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          ⚙️ Config
        </button>
        <button
          className={`tab-button ${activeTab === 'dependencies' ? 'active' : ''}`}
          onClick={() => setActiveTab('dependencies')}
        >
          🔗 Dependencies
        </button>
        <button
          className={`tab-button ${activeTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitoring')}
        >
          📡 Monitoring
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'config' && renderConfigTab()}
        {activeTab === 'dependencies' && renderDependenciesTab()}
        {activeTab === 'monitoring' && renderMonitoringTab()}
      </div>

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-dialog">
            <h4>🗑️ Delete Service</h4>
            <p>
              Are you sure you want to delete <strong>{service.label}</strong>?
              <br />
              This action cannot be undone and will remove all dependencies.
            </p>
            <div className="confirm-actions">
              <button
                className="confirm-delete"
                onClick={handleDelete}
              >
                Delete Service
              </button>
              <button
                className="cancel-delete"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
