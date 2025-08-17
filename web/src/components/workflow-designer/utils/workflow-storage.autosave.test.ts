import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    autoSaveDraftWorkflow,
    clearAutoSaveCache,
    setAutoSaveCallback,
    isAutoSaveActive
} from './workflow-storage'
import type { WorkflowNode } from '../types'

// Mock localStorage for node environment
const store = new Map<string, string>()
const mockLocalStorage = {
    get length() {
        return store.size
    },
    setItem: (key: string, value: string) => {
        store.set(key, value)
    },
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
        store.delete(key)
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    clear: () => store.clear()
} as unknown as Storage

    // Attach mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ; (globalThis as any).localStorage = mockLocalStorage

describe('workflow-storage autosave', () => {
    beforeEach(() => {
        store.clear()
        clearAutoSaveCache()
        vi.useFakeTimers()
    })

    it('auto-saves after debounce and handles circular/D3-like refs safely', async () => {
        const circular: Record<string, unknown> = {}
        circular.self = circular
        const d3Like = { _groups: [[]], _parents: [] }

        const node: Partial<WorkflowNode> & Record<string, unknown> = {
            id: 'n1',
            type: 'test',
            x: 10,
            y: 20,
            inputs: [],
            outputs: [],
            config: {}
        }
            // Attach non-serializable/circular fields to ensure safeStringify handles them
            ; (node as Record<string, unknown>).nodeElement = d3Like
            ; (node as Record<string, unknown>).circular = circular

        const draft = {
            id: 'auto-save-test',
            name: 'AutoSave Draft',
            nodes: [node as WorkflowNode],
            connections: [],
            canvasTransform: { x: 0, y: 0, k: 1 },
            designerMode: 'workflow' as const,
            architectureMode: 'context' as const
        }

        const statuses: Array<{ status: string; error?: string }> = []
        setAutoSaveCallback((status, error) => {
            statuses.push({ status, error })
        })

        const eventSpy = vi.fn()
        window.addEventListener('workflow:autosave', eventSpy as EventListener)

        autoSaveDraftWorkflow(draft)

        // Initially scheduled; not yet active
        expect(isAutoSaveActive()).toBe(false)

        // Advance timers beyond minimum debounce (100ms)
        vi.advanceTimersByTime(200)

        // After run, autosave should have completed successfully
        const keys = Array.from(store.keys()).filter(k => k.startsWith('workflow-draft-'))
        expect(keys.length).toBe(1)

        const saved = store.get(keys[0])!
        // Should be parseable JSON (possibly compressed but our compressData keeps JSON format)
        const parsed = JSON.parse(saved)
        expect(parsed.name).toBe('AutoSave Draft')
        expect(parsed.metadata?.checksum).toBeDefined()

        // Status callback should reflect a successful save
        expect(statuses.some(s => s.status === 'started')).toBe(true)
        expect(statuses.some(s => s.status === 'completed')).toBe(true)
        expect(statuses.some(s => s.status === 'failed')).toBe(false)

        // Event should be dispatched at least twice (started and completed)
        expect(eventSpy).toHaveBeenCalled()
        const payloads = (eventSpy.mock.calls as Array<[CustomEvent]>).map(args => (args[0] as CustomEvent).detail?.status)
        expect(payloads.includes('started')).toBe(true)
        expect(payloads.includes('completed')).toBe(true)
        window.removeEventListener('workflow:autosave', eventSpy as EventListener)
    })
})
