import AppFooter from './AppFooter'
import { FOOTER_CONFIGS } from '../hooks/useFooter'

/**
 * Example usage of AppFooter in different page types
 */

// 1. Designer Page - No Footer
export function DesignerPage() {
  return (
    <div className="designer-page">
      <div className="designer-content">
        {/* Designer content */}
      </div>
      {/* No footer for designer page */}
      <AppFooter config={FOOTER_CONFIGS.DESIGNER} />
    </div>
  )
}

// 2. Designer Page - With Minimal Footer (Alternative)
export function DesignerPageWithMinimalFooter() {
  return (
    <div className="designer-page">
      <div className="designer-content">
        {/* Designer content */}
      </div>
      {/* Minimal footer for designer page */}
      <AppFooter config={FOOTER_CONFIGS.DESIGNER_MINIMAL} />
    </div>
  )
}

// 3. Documentation Page
export function DocumentationPage() {
  return (
    <div className="docs-page">
      <div className="docs-content">
        {/* Documentation content */}
      </div>
      <AppFooter 
        config={{
          enabled: true,
          variant: 'full',
          showStats: false,
          showNavigation: true,
          showBrand: true,
          brandText: 'f1ow Documentation',
          description: 'Comprehensive guides and API references for f1ow Workflow Engine.',
        }}
      />
    </div>
  )
}

// 4. Regular Page (Templates, Executions, etc.)
export function RegularPage() {
  return (
    <div className="regular-page">
      <div className="page-content">
        {/* Page content */}
      </div>
      <AppFooter config={FOOTER_CONFIGS.PAGE} />
    </div>
  )
}

// 5. Settings/Admin Page
export function AdminPage() {
  return (
    <div className="admin-page">
      <div className="admin-content">
        {/* Admin content */}
      </div>
      <AppFooter 
        config={{
          enabled: true,
          variant: 'minimal',
          showStats: false,
          showNavigation: false,
          showBrand: true,
          brandText: 'f1ow Admin Panel',
        }}
      />
    </div>
  )
}

// 6. Landing/Marketing Page
export function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-content">
        {/* Landing content */}
      </div>
      <AppFooter 
        config={{
          enabled: true,
          variant: 'full',
          showStats: false,
          showNavigation: true,
          showBrand: true,
          description: 'Transform your business processes with powerful workflow automation.',
        }}
      />
    </div>
  )
}

// 7. Custom Footer Configuration
export function CustomPage() {
  return (
    <div className="custom-page">
      <div className="page-content">
        {/* Custom page content */}
      </div>
      <AppFooter 
        config={{
          enabled: true,
          variant: 'full',
          showStats: true,
          showNavigation: true,
          showBrand: true,
          brandText: 'Custom App Name',
          description: 'Custom description for this specific page.',
          className: 'custom-footer-styles',
        }}
        stats={{
          customStats: [
            { label: 'Active Users', value: 1250 },
            { label: 'Projects', value: 45 },
            { label: 'Uptime', value: '99.9%' },
          ]
        }}
      />
    </div>
  )
}
