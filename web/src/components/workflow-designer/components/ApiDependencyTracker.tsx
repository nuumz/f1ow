/**
 * API Dependency Tracker
 * Visual overlay for tracking API dependencies and relationships
 */

import { useMemo } from 'react'
import type { ArchitectureNode, APIDependency } from '../types/architecture'
import './ApiDependencyTracker.css'

interface ApiDependencyTrackerProps {
  nodes: ArchitectureNode[]
  dependencies: APIDependency[]
  onDependencySelect: (dependency: APIDependency) => void
}

export default function ApiDependencyTracker({
  nodes,
  dependencies,
  onDependencySelect
}: Readonly<ApiDependencyTrackerProps>) {

  // Calculate dependency metrics
  const metrics = useMemo(() => {
    const apiNodes = nodes.filter(node => 
      node.category?.includes('API/') || 
      node.type.includes('api') ||
      node.type.includes('service')
    )

    const totalApis = apiNodes.length
    const totalDependencies = dependencies.length
    const criticalDependencies = dependencies.filter(dep => 
      dep.consumers.some(consumer => consumer.criticality === 'critical')
    ).length

    const deprecatedApis = dependencies.filter(dep => dep.status === 'deprecated').length

    return {
      totalApis,
      totalDependencies,
      criticalDependencies,
      deprecatedApis,
      healthScore: Math.round(((totalDependencies - deprecatedApis) / Math.max(totalDependencies, 1)) * 100)
    }
  }, [nodes, dependencies])

  // Group dependencies by business context
  const dependenciesByContext = useMemo(() => {
    const groups: Record<string, APIDependency[]> = {}
    
    dependencies.forEach(dep => {
      dep.businessContext.forEach(context => {
        if (!groups[context]) {
          groups[context] = []
        }
        groups[context].push(dep)
      })
    })

    return groups
  }, [dependencies])

  // Get high-risk dependencies
  const highRiskDependencies = useMemo(() => {
    return dependencies.filter(dep => 
      dep.status === 'deprecated' ||
      dep.consumers.some(consumer => consumer.criticality === 'critical') ||
      !dep.lastModified || (Date.now() - dep.lastModified) > (90 * 24 * 60 * 60 * 1000) // 90 days
    )
  }, [dependencies])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981'
      case 'deprecated': return '#F59E0B'
      case 'planned': return '#6B7280'
      case 'legacy': return '#EF4444'
      default: return '#6B7280'
    }
  }

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'critical': return '#EF4444'
      case 'important': return '#F59E0B'
      case 'optional': return '#10B981'
      default: return '#6B7280'
    }
  }

  return (
    <div className="api-dependency-tracker">
      {/* Metrics Dashboard */}
      <div className="metrics-dashboard">
        <div className="metric-card">
          <div className="metric-value">{metrics.totalApis}</div>
          <div className="metric-label">APIs</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.totalDependencies}</div>
          <div className="metric-label">Dependencies</div>
        </div>
        <div className="metric-card critical">
          <div className="metric-value">{metrics.criticalDependencies}</div>
          <div className="metric-label">Critical</div>
        </div>
        <div className="metric-card deprecated">
          <div className="metric-value">{metrics.deprecatedApis}</div>
          <div className="metric-label">Deprecated</div>
        </div>
        <div className="metric-card health">
          <div className="metric-value">{metrics.healthScore}%</div>
          <div className="metric-label">Health</div>
        </div>
      </div>

      {/* High Risk Dependencies Alert */}
      {highRiskDependencies.length > 0 && (
        <div className="risk-alert">
          <div className="alert-header">
            <span className="alert-icon">⚠️</span>
            <span className="alert-title">High Risk Dependencies ({highRiskDependencies.length})</span>
          </div>
          <div className="risk-list">
            {highRiskDependencies.slice(0, 3).map(dep => (
              <button
                key={dep.id}
                className="risk-item"
                onClick={() => onDependencySelect(dep)}
              >
                <div className="risk-api">
                  <span className="api-method" style={{ background: getStatusColor(dep.status) }}>
                    {dep.method}
                  </span>
                  <span className="api-path">{dep.apiPath}</span>
                </div>
                <div className="risk-reason">
                  {dep.status === 'deprecated' && 'Deprecated'}
                  {dep.consumers.some(c => c.criticality === 'critical') && 'Critical Usage'}
                  {(!dep.lastModified || (Date.now() - dep.lastModified) > (90 * 24 * 60 * 60 * 1000)) && 'Stale'}
                </div>
              </button>
            ))}
            {highRiskDependencies.length > 3 && (
              <div className="more-risks">
                +{highRiskDependencies.length - 3} more risks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Business Context Groups */}
      <div className="context-groups">
        <div className="context-header">
          <span className="context-icon">🎯</span>
          <span className="context-title">Business Context</span>
        </div>
        <div className="context-list">
          {Object.entries(dependenciesByContext).map(([context, contextDeps]) => (
            <div key={context} className="context-group">
              <div className="context-name">
                <span className="context-label">{context}</span>
                <span className="context-count">{contextDeps.length}</span>
              </div>
              <div className="context-apis">
                {contextDeps.slice(0, 2).map(dep => (
                  <button
                    key={dep.id}
                    className="context-api"
                    onClick={() => onDependencySelect(dep)}
                    title={`${dep.method} ${dep.apiPath}\nConsumers: ${dep.consumers.length}`}
                  >
                    <span 
                      className="api-method" 
                      style={{ background: getStatusColor(dep.status) }}
                    >
                      {dep.method}
                    </span>
                    <span className="api-path">{dep.apiPath.split('/').pop()}</span>
                  </button>
                ))}
                {contextDeps.length > 2 && (
                  <span className="more-apis">+{contextDeps.length - 2}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Consumer Impact Summary */}
      <div className="consumer-impact">
        <div className="impact-header">
          <span className="impact-icon">👥</span>
          <span className="impact-title">Consumer Impact</span>
        </div>
        <div className="impact-summary">
          {dependencies.slice(0, 5).map(dep => (
            <div key={dep.id} className="impact-item">
              <div className="impact-api">
                <span className="api-method" style={{ background: getStatusColor(dep.status) }}>
                  {dep.method}
                </span>
                <span className="api-path">{dep.apiPath.split('/').pop()}</span>
              </div>
              <div className="impact-consumers">
                {dep.consumers.slice(0, 3).map(consumer => (
                  <span
                    key={consumer.serviceId}
                    className="consumer-badge"
                    style={{ borderColor: getCriticalityColor(consumer.criticality) }}
                    title={`${consumer.serviceName} - ${consumer.criticality}`}
                  >
                    {consumer.serviceName.substring(0, 3).toUpperCase()}
                  </span>
                ))}
                {dep.consumers.length > 3 && (
                  <span className="more-consumers">+{dep.consumers.length - 3}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
