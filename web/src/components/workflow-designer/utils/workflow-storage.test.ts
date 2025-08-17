import { describe, it, expect, beforeEach } from 'vitest'
import { saveDraftWorkflow, clearAutoSaveCache } from './workflow-storage'
import type { WorkflowNode } from '../types'

// Mock localStorage for node environment
const localStore: Record<string, string> = {}
const mockLocalStorage = {
    getItem: (key: string) => (key in localStore ? localStore[key] : null),
    setItem: (key: string, value: string) => {
        localStore[key] = value
    },
    removeItem: (key: string) => {
        delete localStore[key]
    },
    key: (i: number) => Object.keys(localStore)[i] ?? null,
    get length() {
        return Object.keys(localStore).length
    }
} as unknown as Storage

// @ts-ignore
globalThis.localStorage = mockLocalStorage

describe('workflow-storage safe serialization', () => {
    beforeEach(() => {
        Object.keys(localStore).forEach(k => delete localStore[k])
        clearAutoSaveCache()
    })

    it('saves a draft even when nodes contain circular/d3-like references', () => {
        const nodeA: Partial<WorkflowNode> & Record<string, unknown> = { id: 'A', type: 'test', x: 10, y: 20, inputs: [], outputs: [], config: {} }
        const nodeB: Partial<WorkflowNode> & Record<string, unknown> = { id: 'B', type: 'test', x: 30, y: 40, inputs: [], outputs: [], config: {} }
        // Create circular reference
        nodeA.self = nodeA
        // Mock d3-like selection
        nodeB.selection = { _groups: [], _parents: [] }

        const ok = saveDraftWorkflow(
            {
                id: 'draft-1',
                name: 'Test Draft',
                nodes: [nodeA as WorkflowNode, nodeB as WorkflowNode],
                connections: [
                    { id: 'c1', sourceNodeId: 'A', sourcePortId: 'o1', targetNodeId: 'B', targetPortId: 'i1' }
                ],
                canvasTransform: { x: 0, y: 0, k: 1 },
                designerMode: 'workflow',
                architectureMode: 'context'
            },
            { bumpVersion: true }
        )

        expect(ok).toBe(true)
        // Ensure something persisted
        expect(localStorage.length).toBe(1)
        const key = Object.keys(localStore)[0]
        const saved = localStorage.getItem(key!)
        expect(saved).toBeTruthy()
        // JSON parses
        const parsed = JSON.parse(saved!)
        expect(parsed.name).toBe('Test Draft')
    })
})
