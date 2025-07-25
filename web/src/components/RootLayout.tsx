import React, { useState, useEffect, useRef } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Home, Workflow, Play, BarChart3, Shield, GitBranch, Code, ChevronDown, Settings } from 'lucide-react'

export default function RootLayout() {
  const router = useRouterState()
  const [showToolsDropdown, setShowToolsDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowToolsDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/workflows', label: 'Workflows', icon: Workflow },
    { path: '/designer', label: 'Designer', icon: BarChart3 },
    { path: '/templates', label: 'Templates', icon: GitBranch },
    { path: '/credentials', label: 'Credentials', icon: Shield },
    { path: '/executions', label: 'Executions', icon: Play }
  ]

  const toolsItems = [
    { path: '/mapper', label: 'Data Mapper', icon: Code },
    { path: '/expression-editor', label: 'Expression Editor', icon: Code },
    { path: '/versions/demo', label: 'Version History', icon: GitBranch }
  ]

  const currentPath = router.location.pathname

  const isActive = (itemPath: string) => {
    return currentPath === itemPath || 
           (itemPath === '/workflows' && currentPath === '/') ||
           (itemPath === '/designer' && currentPath.startsWith('/designer')) ||
           (itemPath === '/templates' && currentPath.startsWith('/templates')) ||
           (itemPath === '/credentials' && currentPath.startsWith('/credentials'))
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <h1>f1ow</h1>
          <span className="brand-tagline">Workflow Automation</span>
        </div>
        <div className="nav-links">
          {navItems.map((item) => {
            const Icon = item.icon
            
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          
          {/* Tools Dropdown */}
          <div className="nav-dropdown" ref={dropdownRef}>
            <button
              className={`nav-link dropdown-trigger ${toolsItems.some(item => currentPath.startsWith(item.path)) ? 'active' : ''}`}
              onClick={() => setShowToolsDropdown(!showToolsDropdown)}
            >
              <Settings size={18} />
              <span>Tools</span>
              <ChevronDown size={14} className={`dropdown-arrow ${showToolsDropdown ? 'open' : ''}`} />
            </button>
            
            {showToolsDropdown && (
              <div className="dropdown-menu">
                {toolsItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`dropdown-item ${currentPath === item.path ? 'active' : ''}`}
                      onClick={() => setShowToolsDropdown(false)}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className="nav-user">
          <div className="user-avatar">
            <span>U</span>
          </div>
        </div>
      </nav>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}