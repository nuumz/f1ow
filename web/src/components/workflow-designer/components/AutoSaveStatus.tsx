/**
 * Performance-enhanced auto-save status indicator component
 */

import { useEffect, useState } from 'react'
import { useWorkflowContext } from '../contexts/WorkflowContext'
import { getAutoSaveMetrics } from '../utils/workflow-storage'

interface AutoSaveStatusProps {
  className?: string
  showFullStatus?: boolean
}

// Beautiful custom SVG icons for draft status with premium styling
const SavedIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      fill="currentColor"
    />
    <path 
      d="M9 12l2 2 4-4" 
      stroke="white" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

const SavingIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} animate-spin`}
  >
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      fill="currentColor"
      opacity="0.2"
    />
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      stroke="currentColor" 
      strokeWidth="3"
      strokeDasharray="31.416"
      strokeDashoffset="23.562"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
)

const ErrorIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      fill="currentColor"
    />
    <path 
      d="M15 9l-6 6m0-6l6 6" 
      stroke="white" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

export function AutoSaveStatus({ className = '', showFullStatus = false }: Readonly<AutoSaveStatusProps>) {
  const { state } = useWorkflowContext()
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSavedTs, setLastSavedTs] = useState<number>(state.lastSaved || 0)
  const metrics = getAutoSaveMetrics()

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ status: 'started' | 'completed' | 'failed'; error?: string; timestamp?: number }>
      if (ev.detail?.status === 'started') {
        setIsAutoSaving(true)
        setError(null)
      } else if (ev.detail?.status === 'completed') {
        setIsAutoSaving(false)
        setError(null)
        if (ev.detail.timestamp) setLastSavedTs(ev.detail.timestamp)
      } else if (ev.detail?.status === 'failed') {
        setIsAutoSaving(false)
        setError(ev.detail.error || 'Save failed')
        if (ev.detail.timestamp) setLastSavedTs(ev.detail.timestamp)
      }
    }
    window.addEventListener('workflow:autosave', handler as EventListener)
    return () => window.removeEventListener('workflow:autosave', handler as EventListener)
  }, [])
  
  // Format time display
  const formatTime = (timestamp: number) => {
    if (timestamp === 0) return 'Never'
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }
  
  // Get time ago string
  const getTimeAgo = (timestamp: number) => {
    if (timestamp === 0) return ''
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 1000) return 'just now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return `${Math.floor(diff / 3600000)}h ago`
  }
  
  // Determine status display with custom SVG icons
  const getStatusDisplay = () => {
  if (isAutoSaving) {
      return {
        text: 'Auto-saving...',
        icon: <SavingIcon size={16} />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        pulse: false
      }
    }
    
  if (error) {
      return {
        text: 'Save failed',
        icon: <ErrorIcon size={16} />,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        pulse: false
      }
    }
    
    // If context says dirty but no pending changes (per metrics), consider it saved
    if (state.isDirty && metrics.pendingChanges === 0 && !isAutoSaving) {
      return {
        text: 'All changes saved',
        icon: <SavedIcon size={16} />,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        pulse: false
      }
    }
    if (state.isDirty) {
      return {
        text: 'Unsaved changes',
        icon: <div className="w-4 h-4 rounded-full bg-yellow-500 animate-pulse" />,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        pulse: false
      }
    }
    
    return {
      text: 'All changes saved',
      icon: <SavedIcon size={16} />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      pulse: false
    }
  }
  
  const status = getStatusDisplay()
  // Normalize last saved timestamp (state.lastSaved can be null)
  const effectiveLastSaved = lastSavedTs > 0 ? lastSavedTs : (state.lastSaved ?? 0)
  const lastSavedTime = getTimeAgo(effectiveLastSaved)
  
  if (showFullStatus) {
    return (
      <div className={`inline-flex items-center justify-center gap-3 px-4 py-3 rounded-lg border ${status.bgColor} ${status.borderColor} transition-all duration-200 ${className}`} style={{ alignItems: 'center', display: 'flex' }}>
        <span className={`inline-flex items-center justify-center ${status.pulse ? 'animate-pulse' : ''}`} style={{ verticalAlign: 'middle', lineHeight: 0 }}>
          {status.icon}
        </span>
        <div className="flex flex-col gap-1">
          <span className={`text-sm font-medium ${status.color}`} style={{ verticalAlign: 'middle' }}>
            {status.text}
          </span>
      {effectiveLastSaved > 0 && !isAutoSaving && (
            <span className="text-xs text-gray-500">
        Last saved: {formatTime(effectiveLastSaved)} ({lastSavedTime})
            </span>
          )}
      {error && (
            <span className="text-xs text-red-500 mt-1 max-w-xs truncate">
        {error}
            </span>
          )}
        </div>
      </div>
    )
  }
  
  const tooltipParts = [status.text]
  if (lastSavedTime) tooltipParts.push(`Last saved: ${lastSavedTime}`)
  if (error) tooltipParts.push(`Error: ${error}`)
  if (metrics.pendingChanges > 0) tooltipParts.push(`Pending changes: ${metrics.pendingChanges}`)
  if (metrics.currentDelay !== 500) tooltipParts.push(`Smart delay: ${metrics.currentDelay}ms`)
  const tooltipText = tooltipParts.join(' • ')
  
  return (
    <div 
      className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${status.color} ${status.bgColor} ${className}`}
      title={tooltipText}
      style={{ alignItems: 'center', display: 'flex' }}
    >
      <span className={`inline-flex items-center justify-center ${status.pulse ? 'animate-pulse' : ''}`} style={{ verticalAlign: 'middle', lineHeight: 0 }}>{status.icon}</span>
      <span className="font-medium" style={{ verticalAlign: 'middle' }}>{status.text}</span>
    </div>
  )
}

/**
 * Compact auto-save indicator with beautiful custom SVG icons
 */
export function AutoSaveIndicator({ className = '', iconOnly = false }: Readonly<{ className?: string; iconOnly?: boolean }>) {
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ status: 'started' | 'completed' | 'failed'; error?: string }>
      if (ev.detail?.status === 'started') {
        setIsAutoSaving(true)
        setError(null)
      } else if (ev.detail?.status === 'completed') {
        setIsAutoSaving(false)
        setError(null)
      } else if (ev.detail?.status === 'failed') {
        setIsAutoSaving(false)
        setError(ev.detail.error || 'Save failed')
      }
    }
    window.addEventListener('workflow:autosave', handler as EventListener)
    return () => window.removeEventListener('workflow:autosave', handler as EventListener)
  }, [])
  
  if (isAutoSaving) {
    return (
      <div 
        className={`inline-flex items-center justify-center ${iconOnly ? 'w-6 h-6' : 'gap-1.5 px-2 py-1'} rounded-full shadow-sm transition-all duration-200 ${className}`}
        title="Auto-saving..."
      >
        <SavingIcon size={iconOnly ? 18 : 14} />
        {!iconOnly && <span className="text-xs font-medium text-blue-600">Saving</span>}
      </div>
    )
  }
  
  if (error) {
    return (
      <div 
        className={`inline-flex items-center justify-center ${iconOnly ? 'w-6 h-6' : 'gap-1.5 px-2 py-1'} rounded-full shadow-sm transition-all duration-200 ${className}`}
  title={`Auto-save failed: ${error}`}
      >
        <ErrorIcon size={iconOnly ? 18 : 14} />
        {!iconOnly && <span className="text-xs font-medium text-red-600">Failed</span>}
      </div>
    )
  }
  
  return (
    <div 
      className={`inline-flex items-center justify-center ${iconOnly ? 'w-6 h-6' : 'gap-1.5 px-2 py-1'} rounded-full shadow-sm hover:scale-105 transition-all duration-200 cursor-pointer ${className}`}
      title="Draft saved successfully"
    >
      <SavedIcon size={iconOnly ? 18 : 14} className="drop-shadow-sm" />
      {!iconOnly && <span className="text-xs font-medium text-green-600">Saved</span>}
    </div>
  )
}