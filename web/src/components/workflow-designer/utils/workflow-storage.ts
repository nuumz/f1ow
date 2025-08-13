/**
 * High-performance workflow storage utilities for localStorage
 * Features: Change detection, compression, smart debouncing, background processing
 */

import type { WorkflowNode, Connection } from '../types'

// Normalized shape for checksum operations (no metadata)
interface DraftWorkflowNormalized {
  name: string
  nodes: Array<WorkflowNode & { x: number; y: number }>
  connections: Connection[]
  canvasTransform: { x: number; y: number; k: number }
}

// Draft workflow interface
export interface DraftWorkflow {
  id: string
  name: string
  nodes: WorkflowNode[]
  connections: Connection[]
  canvasTransform: {
    x: number
    y: number
    k: number
  }
  // Designer mode states
  designerMode: 'workflow' | 'architecture'
  architectureMode: 'context' | 'api-flow' | 'service-mesh' | 'domain-driven'
  metadata: {
    createdAt: number
    updatedAt: number
    version: string
    checksum?: string
    compressed?: boolean
  }
}

// Performance configuration
const STORAGE_CONFIG = {
  DRAFT_PREFIX: 'workflow-draft-',
  CURRENT_VERSION: '1.0',
  
  // Auto-save timing
  AUTO_SAVE_MIN_DELAY: 100,    // Minimum delay (0.1s)
  AUTO_SAVE_MAX_DELAY: 5000,   // Maximum delay (5s)
  AUTO_SAVE_INCREMENT: 300,    // Increment per rapid change
  
  // Performance thresholds
  COMPRESSION_THRESHOLD: 8192, // 8KB - compress larger data
  LARGE_WORKFLOW_NODES: 50,    // Consider large if >50 nodes
  MAX_SAVE_TIME: 100,          // Max time allowed for save (ms)
  
  // Change detection
  POSITION_GRID_SIZE: 1,       // Grid size for position bucketing (1px for precise detection)
  DEBOUNCE_RAPID_THRESHOLD: 5, // Rapid change threshold
  RAPID_CHANGE_WINDOW: 2000,   // Window for detecting rapid changes (2s)
}

// Auto-save state
let autoSaveTimer: NodeJS.Timeout | null = null
let isAutoSaving = false
let autoSaveCallback: ((status: 'started' | 'completed' | 'failed', error?: string) => void) | null = null
let lastSavedData: string | null = null
let changeHistory: number[] = []

/**
 * Performance utilities
 */

// Simple compression using JSON.stringify optimization
function compressData(data: string): string {
  try {
    // Remove unnecessary whitespace and optimize JSON
    const compressed = JSON.stringify(JSON.parse(data))
    return compressed
  } catch {
    return data
  }
}

// Simple decompression (just parsing for now)
function decompressData(data: string): string {
  return data
}

// Generate checksum for change detection
function generateChecksum(data: Omit<DraftWorkflow, 'metadata'>): string {
  const normalized = normalizeDataForChecksum(data)
  const str = JSON.stringify(normalized)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(16)
}

// Normalize data for consistent checksum generation
function normalizeDataForChecksum(data: Omit<DraftWorkflow, 'metadata'>): DraftWorkflowNormalized {
  return {
    name: data.name,
    nodes: data.nodes.map(node => ({
      ...node,
      x: Math.round(node.x),
      y: Math.round(node.y)
    })),
    connections: [...data.connections].sort((a, b) => a.id.localeCompare(b.id)),
    canvasTransform: {
      x: Math.round(data.canvasTransform.x),
      y: Math.round(data.canvasTransform.y),
      k: Math.round(data.canvasTransform.k * 100) / 100
    }
  }
}

// Calculate smart debounce delay based on change frequency
function calculateSmartDelay(): number {
  const now = Date.now()
  
  // Clean old change history
  changeHistory = changeHistory.filter(time => now - time < STORAGE_CONFIG.RAPID_CHANGE_WINDOW)
  
  // Add current change
  changeHistory.push(now)
  
  // Calculate delay based on change frequency
  const recentChanges = changeHistory.length
  if (recentChanges >= STORAGE_CONFIG.DEBOUNCE_RAPID_THRESHOLD) {
    // Rapid changes detected - increase delay
    const multiplier = Math.min(recentChanges / STORAGE_CONFIG.DEBOUNCE_RAPID_THRESHOLD, 4)
    return Math.min(
      STORAGE_CONFIG.AUTO_SAVE_MIN_DELAY * multiplier,
      STORAGE_CONFIG.AUTO_SAVE_MAX_DELAY
    )
  }
  
  return STORAGE_CONFIG.AUTO_SAVE_MIN_DELAY
}

// Check if data has actually changed
function hasDataChanged(newData: Omit<DraftWorkflow, 'metadata'>): boolean {
  if (!lastSavedData) return true
  
  try {
    const newChecksum = generateChecksum(newData)
    const lastSavedDraft = JSON.parse(lastSavedData) as DraftWorkflow
    const lastChecksum = lastSavedDraft.metadata.checksum
    
    return newChecksum !== lastChecksum
  } catch {
    return true // If we can't compare, assume changed
  }
}

/**
 * Set callback for auto-save status updates
 */
export function setAutoSaveCallback(callback: (status: 'started' | 'completed' | 'failed', error?: string) => void) {
  autoSaveCallback = callback
}

/**
 * Save draft workflow to localStorage with performance optimizations
 */
interface SaveOptions { bumpVersion?: boolean }

export function saveDraftWorkflow(draft: Omit<DraftWorkflow, 'metadata'>, options: SaveOptions = {}): boolean {
  const startTime = performance.now()
  
  try {
    // Generate checksum for change detection
    const checksum = generateChecksum(draft)
    const key = `${STORAGE_CONFIG.DRAFT_PREFIX}${draft.id}`

    // Attempt to load existing draft to preserve createdAt / bump version
    let existing: DraftWorkflow | null = null
    try {
      const existingRaw = localStorage.getItem(key)
      if (existingRaw) {
        existing = JSON.parse(existingRaw) as DraftWorkflow
      }
    } catch {
      existing = null
    }

    // Derive version (increment only if bumpVersion true or new draft)
    let newVersion = STORAGE_CONFIG.CURRENT_VERSION
    if (existing?.metadata?.version) {
      const prev = existing.metadata.version
      if (options.bumpVersion !== false) {
        const prevNum = Number(prev)
        if (!Number.isNaN(prevNum)) {
          newVersion = (prevNum + 1).toString()
        } else {
          newVersion = `${prev}-rev${Date.now()}`
        }
      } else {
        newVersion = prev // keep same version on silent update (auto-save)
      }
    }

    const createdAt = existing?.metadata?.createdAt || Date.now()
    const fullDraft: DraftWorkflow = {
      ...draft,
      metadata: {
        createdAt,
        updatedAt: Date.now(),
        version: newVersion,
        checksum,
        compressed: false
      }
    }
    
    let dataToStore = JSON.stringify(fullDraft)
    
    // Apply compression for large workflows
    if (dataToStore.length > STORAGE_CONFIG.COMPRESSION_THRESHOLD) {
      const compressed = compressData(dataToStore)
      if (compressed.length < dataToStore.length * 0.9) { // Only use if >10% savings
        dataToStore = compressed
        fullDraft.metadata.compressed = true
        console.log('📦 Applied compression:', `${dataToStore.length}/${JSON.stringify(fullDraft).length} bytes`)
      }
    }
    
    localStorage.setItem(key, dataToStore)
    
    // Cache the saved data for change detection
    lastSavedData = JSON.stringify(fullDraft)
    
  const saveTime = performance.now() - startTime
  console.log(`✅ Draft saved: ${draft.name} (${saveTime.toFixed(1)}ms, ${dataToStore.length} bytes)${options.bumpVersion === false ? ' (no version bump)' : ''}`)
    
    // Warn if save took too long
    if (saveTime > STORAGE_CONFIG.MAX_SAVE_TIME) {
      console.warn(`⚠️ Slow save detected: ${saveTime.toFixed(1)}ms`)
    }
    
    return true
  } catch (error) {
    console.error('❌ Failed to save draft:', error)
    return false
  }
}

/**
 * Load draft workflow from localStorage with decompression support
 */
export function loadDraftWorkflow(draftId: string): DraftWorkflow | null {
  const startTime = performance.now()
  
  try {
    const key = `${STORAGE_CONFIG.DRAFT_PREFIX}${draftId}`
    const saved = localStorage.getItem(key)
    
    if (!saved) return null
    
    // Handle compressed data
    let dataToProcess = saved
    if (saved.startsWith('{') && saved.includes('"compressed":true')) {
      // This is compressed data, decompress it
      dataToProcess = decompressData(saved)  
    }
    
    const draft = JSON.parse(dataToProcess)
    
    // Backward compatibility: Add missing mode fields for old drafts
    const loadedDraft: DraftWorkflow = {
      ...draft,
      designerMode: draft.designerMode || 'workflow',
      architectureMode: draft.architectureMode || 'context'
    }
    
    // Cache loaded data for change detection
    lastSavedData = JSON.stringify(loadedDraft)
    
    const loadTime = performance.now() - startTime
    console.log(`✅ Draft loaded: ${loadedDraft.name} (${loadTime.toFixed(1)}ms) - Mode: ${loadedDraft.designerMode}`)
    
    return loadedDraft
  } catch (error) {
    console.error('❌ Failed to load draft:', error)
    return null
  }
}

/**
 * Auto-save draft workflow with smart debouncing and change detection
 */
export function autoSaveDraftWorkflow(draft: Omit<DraftWorkflow, 'metadata'>): void {
  // Skip if already auto-saving
  if (isAutoSaving) {
    return
  }
  
  // Check if data has actually changed
  if (!hasDataChanged(draft)) {
    return
  }
  
  // Clear existing timer
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  
  // Calculate smart delay based on change frequency
  const delay = calculateSmartDelay()
  
  
  // Set new timer with smart delay
  autoSaveTimer = setTimeout(() => {
    performAutoSave(draft)
  }, delay)
}

/**
 * Perform the actual auto-save operation with performance monitoring
 */
function performAutoSave(draft: Omit<DraftWorkflow, 'metadata'>): void {
  if (isAutoSaving) return
  
  isAutoSaving = true
  autoSaveCallback?.('started')
  
  try {
    // Performance warning for large workflows
    if (draft.nodes.length > STORAGE_CONFIG.LARGE_WORKFLOW_NODES) {
      console.log(`⚠️ Large workflow detected: ${draft.nodes.length} nodes`)
    }
    
  const success = saveDraftWorkflow(draft, { bumpVersion: false })
    
    if (success) {
      autoSaveCallback?.('completed')
      
      // Reset change history after successful save
      changeHistory = []
    } else {
      console.error('❌ Auto-save failed')
      autoSaveCallback?.('failed', 'Save operation failed')
    }
  } catch (error) {
    console.error('❌ Auto-save error:', error)
    autoSaveCallback?.('failed', error instanceof Error ? error.message : 'Unknown error')
  } finally {
    isAutoSaving = false
  }
}

/**
 * List all draft workflows
 */
export function listDraftWorkflows(): Array<Pick<DraftWorkflow, 'id' | 'name' | 'metadata'>> {
  const drafts: Array<Pick<DraftWorkflow, 'id' | 'name' | 'metadata'>> = []
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_CONFIG.DRAFT_PREFIX)) {
        const saved = localStorage.getItem(key)
        if (saved) {
          const draft = JSON.parse(saved) as DraftWorkflow
          drafts.push({
            id: draft.id,
            name: draft.name,
            metadata: draft.metadata
          })
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to list drafts:', error)
  }
  
  return drafts.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt)
}

/**
 * Delete draft workflow
 */
export function deleteDraftWorkflow(draftId: string): boolean {
  try {
    const key = `${STORAGE_CONFIG.DRAFT_PREFIX}${draftId}`
    localStorage.removeItem(key)
    console.log('✅ Draft deleted:', draftId)
    return true
  } catch (error) {
    console.error('❌ Failed to delete draft:', error)
    return false
  }
}

/**
 * Get enhanced storage statistics with performance metrics
 */
export function getWorkflowStorageStats() {
  let totalSize = 0
  let draftCount = 0
  let compressedCount = 0
  let largestDraft = 0
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_CONFIG.DRAFT_PREFIX)) {
        const value = localStorage.getItem(key)
        if (value) {
          totalSize += value.length
          draftCount++
          
          // Track largest draft
          if (value.length > largestDraft) {
            largestDraft = value.length
          }
          
          // Check if compressed
          if (value.includes('"compressed":true')) {
            compressedCount++
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to get storage stats:', error)
  }
  
  return {
    draftCount,
    totalSize,
    formattedSize: `${(totalSize / 1024).toFixed(2)} KB`,
    compressedCount,
    compressionRate: draftCount > 0 ? Math.round((compressedCount / draftCount) * 100) : 0,
    largestDraft: `${(largestDraft / 1024).toFixed(2)} KB`,
    averageSize: draftCount > 0 ? `${(totalSize / draftCount / 1024).toFixed(2)} KB` : '0 KB'
  }
}

/**
 * Check if auto-save is currently running
 */
export function isAutoSaveActive(): boolean {
  return isAutoSaving
}

/**
 * Cancel pending auto-save
 */
export function cancelAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
    console.log('🚫 Auto-save cancelled')
  }
}

/**
 * Get current auto-save performance metrics
 */
export function getAutoSaveMetrics() {
  return {
    isAutoSaving,
    pendingChanges: changeHistory.length,
    rapidChangeThreshold: STORAGE_CONFIG.DEBOUNCE_RAPID_THRESHOLD,
    currentDelay: changeHistory.length >= STORAGE_CONFIG.DEBOUNCE_RAPID_THRESHOLD 
      ? Math.min(
          STORAGE_CONFIG.AUTO_SAVE_MIN_DELAY * Math.min(changeHistory.length / STORAGE_CONFIG.DEBOUNCE_RAPID_THRESHOLD, 4),
          STORAGE_CONFIG.AUTO_SAVE_MAX_DELAY
        )
      : STORAGE_CONFIG.AUTO_SAVE_MIN_DELAY,
    hasLastSavedData: !!lastSavedData
  }
}

/**
 * Force immediate auto-save (bypass debouncing)
 */
export function forceAutoSave(draft: Omit<DraftWorkflow, 'metadata'>): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  
  console.log('🚀 Force auto-save triggered')
  performAutoSave(draft)
}

/**
 * Clear auto-save cache (useful for testing or after major changes)
 */
export function clearAutoSaveCache(): void {
  lastSavedData = null
  changeHistory = []
  console.log('🧹 Auto-save cache cleared')
}