import { Workflow } from 'lucide-react'

export interface FooterConfig {
  /** Show or hide the footer completely */
  enabled?: boolean
  /** Footer variant type */
  variant?: 'dashboard' | 'minimal' | 'full'
  /** Show statistics section */
  showStats?: boolean
  /** Show navigation links */
  showNavigation?: boolean
  /** Show brand section */
  showBrand?: boolean
  /** Custom brand text */
  brandText?: string
  /** Custom description */
  description?: string
  /** Additional CSS classes */
  className?: string
}

interface FooterStats {
  /** Total number of executions to display */
  totalExecutions?: number
  /** Success rate percentage to display */
  successRate?: number
  /** Additional custom stats */
  customStats?: Array<{
    label: string
    value: string | number
  }>
}

interface AppFooterProps {
  /** Footer configuration */
  config?: FooterConfig
  /** Statistics data */
  stats?: FooterStats
}

/**
 * Common Application Footer Component
 * 
 * Flexible footer that can be configured for different page types.
 * Supports multiple variants and conditional rendering of sections.
 * 
 * @param config - Footer configuration options
 * @param stats - Statistics data to display
 */
export default function AppFooter({ 
  config = { enabled: true, variant: 'full' }, 
  stats 
}: AppFooterProps) {
  const {
    enabled = true,
    variant = 'full',
    showStats = true,
    showNavigation = false,
    showBrand = true,
    brandText = 'f1ow Workflow Engine',
    description = 'Automate your workflows with enterprise-grade performance and reliability.',
    className = ''
  } = config

  // Don't render if disabled
  if (!enabled) {
    return null
  }

  // Minimal footer for pages like designer
  if (variant === 'minimal') {
    return (
      <footer className={`app-footer app-footer--minimal ${className}`}>
        <div className="footer-minimal-content">
          <p>&copy; 2024 f1ow. Built with ❤️ for workflow automation.</p>
          <div className="footer-minimal-meta">
            <span>Version 1.0.0</span>
          </div>
        </div>
      </footer>
    )
  }

  // Dashboard variant with full features
  if (variant === 'dashboard') {
    return (
      <footer className={`app-footer app-footer--dashboard ${className}`}>
        <div className="footer-content">
          {showBrand && (
            <div className="footer-left">
              <div className="footer-brand">
                <Workflow size={20} />
                <span>{brandText}</span>
              </div>
              <p className="footer-description">{description}</p>
            </div>
          )}
          
          {showNavigation && (
            <div className="footer-center">
              <div className="footer-links">
                <div className="footer-section">
                  <h4>Platform</h4>
                  <ul>
                    <li><a href="/designer">Workflow Designer</a></li>
                    <li><a href="/executions">Execution History</a></li>
                    <li><a href="/templates">Templates</a></li>
                    <li><a href="/analytics">Analytics</a></li>
                  </ul>
                </div>
                <div className="footer-section">
                  <h4>Resources</h4>
                  <ul>
                    <li><a href="/docs">Documentation</a></li>
                    <li><a href="/api">API Reference</a></li>
                    <li><a href="/support">Support</a></li>
                    <li><a href="/community">Community</a></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {showStats && stats && (
            <div className="footer-right">
              <div className="footer-stats">
                {stats.totalExecutions !== undefined && (
                  <div className="stat-item">
                    <div className="stat-value">{stats.totalExecutions.toLocaleString()}</div>
                    <div className="stat-label">Total Executions</div>
                  </div>
                )}
                {stats.successRate !== undefined && (
                  <div className="stat-item">
                    <div className="stat-value">{stats.successRate}%</div>
                    <div className="stat-label">Success Rate</div>
                  </div>
                )}
                {stats.customStats?.map((stat, index) => (
                  <div key={index} className="stat-item">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p>&copy; 2024 f1ow. Built with ❤️ for workflow automation.</p>
            <div className="footer-meta">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Uptime: 99.9%</span>
              <span>•</span>
              <span>Last Deploy: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </footer>
    )
  }

  // Full footer for regular pages
  return (
    <footer className={`app-footer app-footer--full ${className}`}>
      <div className="footer-content">
        {showBrand && (
          <div className="footer-left">
            <div className="footer-brand">
              <Workflow size={20} />
              <span>{brandText}</span>
            </div>
            <p className="footer-description">{description}</p>
          </div>
        )}
        
        {showNavigation && (
          <div className="footer-center">
            <div className="footer-links">
              <div className="footer-section">
                <h4>Platform</h4>
                <ul>
                  <li><a href="/">Dashboard</a></li>
                  <li><a href="/designer">Workflow Designer</a></li>
                  <li><a href="/executions">Execution History</a></li>
                  <li><a href="/templates">Templates</a></li>
                </ul>
              </div>
              <div className="footer-section">
                <h4>Resources</h4>
                <ul>
                  <li><a href="/docs">Documentation</a></li>
                  <li><a href="/api">API Reference</a></li>
                  <li><a href="/support">Support</a></li>
                  <li><a href="/community">Community</a></li>
                </ul>
              </div>
              <div className="footer-section">
                <h4>Company</h4>
                <ul>
                  <li><a href="/about">About</a></li>
                  <li><a href="/contact">Contact</a></li>
                  <li><a href="/privacy">Privacy</a></li>
                  <li><a href="/terms">Terms</a></li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p>&copy; 2024 f1ow. Built with ❤️ for workflow automation.</p>
          <div className="footer-meta">
            <span>Version 1.0.0</span>
            <span>•</span>
            <span>Built with React & TypeScript</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
