/**
 * Impact Analysis Panel
 * Panel for displaying comprehensive impact analysis of API changes
 */

import { useState } from 'react'
import type { ImpactAnalysis } from '../types/architecture'
import './ImpactAnalysisPanel.css'

export interface ImpactAnalysisPanelProps {
  readonly analysis: ImpactAnalysis
  readonly onClose: () => void
  readonly onRunTests: (tests: string[]) => void
}

export function ImpactAnalysisPanel({
  analysis,
  onClose,
  onRunTests
}: ImpactAnalysisPanelProps) {
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set())
  const [expandedService, setExpandedService] = useState<string | null>(null)

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return '#dc2626'
      case 'high': return '#ea580c'
      case 'medium': return '#d97706'
      case 'low': return '#059669'
      default: return '#6b7280'
    }
  }

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'high': return '#dc2626'
      case 'medium': return '#d97706'
      case 'low': return '#059669'
      default: return '#6b7280'
    }
  }

  const handleTestSelection = (testName: string, checked: boolean) => {
    const newSelected = new Set(selectedTests)
    if (checked) {
      newSelected.add(testName)
    } else {
      newSelected.delete(testName)
    }
    setSelectedTests(newSelected)
  }

  const handleSelectAllTests = () => {
    const allTests = analysis.affectedServices.flatMap(service => 
      service.recommendedTests
    )
    setSelectedTests(new Set(allTests))
  }

  const handleRunSelectedTests = () => {
    onRunTests(Array.from(selectedTests))
  }

  return (
    <div className="impact-analysis-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-title">
          <span className="title-icon">📊</span>
          <div className="title-content">
            <h3>Impact Analysis</h3>
            <div className="api-info">
              <span className="api-method">{analysis.apiEndpoint.method}</span>
              <span className="api-path">{analysis.apiEndpoint.path}</span>
            </div>
          </div>
        </div>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="impact-summary">
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-value">{analysis.totalAffectedServices}</div>
            <div className="summary-label">Services</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{analysis.totalAffectedUIComponents}</div>
            <div className="summary-label">UI Components</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{analysis.estimatedTestingEffort}h</div>
            <div className="summary-label">Testing Effort</div>
          </div>
          <div className="summary-item risk">
            <div 
              className="summary-value" 
              style={{ color: getRiskColor(analysis.businessImpact.riskLevel) }}
            >
              {analysis.businessImpact.riskLevel.toUpperCase()}
            </div>
            <div className="summary-label">Risk Level</div>
          </div>
        </div>
      </div>

      {/* Business Impact */}
      <div className="business-impact">
        <h4 className="section-title">
          <span className="section-icon">🎯</span>
          {' '}Business Impact
        </h4>
        <div className="impact-details">
          <div className="impact-group">
            <div className="impact-group-title">Affected Processes</div>
            <div className="impact-tags">
              {analysis.businessImpact.affectedProcesses.map(process => (
                <span key={process} className="impact-tag process">
                  {process}
                </span>
              ))}
            </div>
          </div>
          <div className="impact-group">
            <div className="impact-group-title">User Journeys</div>
            <div className="impact-tags">
              {analysis.businessImpact.userJourneys.map(journey => (
                <span key={journey} className="impact-tag journey">
                  {journey}
                </span>
              ))}
            </div>
          </div>
          {analysis.businessImpact.estimatedDowntime && (
            <div className="downtime-estimate">
              <span className="downtime-icon">⏱️</span>
              <span className="downtime-text">
                Estimated downtime: {analysis.businessImpact.estimatedDowntime} minutes
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Affected Services */}
      <div className="affected-services">
        <h4 className="section-title">
          <span className="section-icon">⚙️</span>
          Affected Services ({analysis.affectedServices.length})
        </h4>
        <div className="services-list">
          {analysis.affectedServices.map(service => (
            <div key={service.serviceId} className="service-item">
              <button 
                className="service-header"
                onClick={() => setExpandedService(
                  expandedService === service.serviceId ? null : service.serviceId
                )}
              >
                <div className="service-info">
                  <div className="service-name">{service.serviceName}</div>
                  <div 
                    className="service-impact"
                    style={{ color: getImpactColor(service.impactLevel) }}
                  >
                    {service.impactLevel} impact
                  </div>
                </div>
                <div className="service-stats">
                  <span className="components-count">
                    {service.affectedComponents.length} components
                  </span>
                  <span className="expand-icon">
                    {expandedService === service.serviceId ? '▼' : '▶'}
                  </span>
                </div>
              </button>

              {expandedService === service.serviceId && (
                <div className="service-details">
                  <div className="components-section">
                    <div className="components-title">Affected Components</div>
                    <div className="components-list">
                      {service.affectedComponents.map(component => (
                        <span key={component} className="component-tag">
                          {component}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="tests-section">
                    <div className="tests-title">Recommended Tests</div>
                    <div className="tests-list">
                      {service.recommendedTests.map(test => (
                        <label key={test} className="test-item">
                          <input
                            type="checkbox"
                            checked={selectedTests.has(test)}
                            onChange={(e) => handleTestSelection(test, e.target.checked)}
                          />
                          <span className="test-name">{test}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {service.migrationSteps && service.migrationSteps.length > 0 && (
                    <div className="migration-section">
                      <div className="migration-title">Migration Steps</div>
                      <div className="migration-steps">
                        {service.migrationSteps.map((step, index) => (
                          <div key={`${service.serviceId}-step-${index}`} className="migration-step">
                            <span className="step-number">{index + 1}</span>
                            <span className="step-text">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Test Actions */}
      <div className="test-actions">
        <div className="test-actions-header">
          <div className="selected-count">
            {selectedTests.size} tests selected
          </div>
          <div className="test-action-buttons">
            <button 
              className="impact-panel-action-button secondary"
              onClick={handleSelectAllTests}
            >
              Select All
            </button>
            <button 
              className="impact-panel-action-button primary"
              onClick={handleRunSelectedTests}
              disabled={selectedTests.size === 0}
            >
              Run Tests
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
