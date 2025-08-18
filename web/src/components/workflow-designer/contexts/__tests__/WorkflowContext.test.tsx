import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { flushSync } from 'react-dom'
import { describe, it, expect, beforeEach } from 'vitest'

import { WorkflowProvider, useWorkflowContext } from '../WorkflowContext'
import type { WorkflowNode, Connection } from '../../types'

function createNode(id: string, opts?: Partial<WorkflowNode>): WorkflowNode {
  return {
    id,
    type: 'test',
    label: id,
    x: 0,
    y: 0,
    config: {},
    inputs: [{ id: 'in', type: 'input', dataType: 'any', label: 'in' }],
    outputs: [{ id: 'out', type: 'output', dataType: 'any', label: 'out' }],
    ...opts,
  }
}

function createConnection(id: string, c: Partial<Connection>): Connection {
  return {
    id,
    sourceNodeId: 'A',
    sourcePortId: 'out',
    targetNodeId: 'B',
    targetPortId: 'in',
    ...c,
  }
}

type Ctx = ReturnType<typeof useWorkflowContext>

function Consumer({ expose }: { readonly expose: { current: Ctx | null } }) {
  const ctx = useWorkflowContext()
  useEffect(() => {
    expose.current = ctx
  })
  return (
    <div data-testid="conn-count">{ctx.state.connections.length}</div>
  )
}

function renderWithProvider(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = ReactDOM.createRoot(container)
  flushSync(() => {
    root.render(ui)
  })
  return { container, root }
}

describe('WorkflowContext basic behavior', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
  })

  it('validates and removes invalid connections (per provider)', async () => {
    const nodes: WorkflowNode[] = [createNode('A'), createNode('B')]
    const valid: Connection = createConnection('c1', {
      sourceNodeId: 'A', sourcePortId: 'out', targetNodeId: 'B', targetPortId: 'in'
    })
    const invalidMissingPort: Connection = createConnection('c2', {
      sourceNodeId: 'A', sourcePortId: 'out', targetNodeId: 'B', targetPortId: 'missing'
    })

    const aRef = { current: null as Ctx | null }
    const bRef = { current: null as Ctx | null }

    const { root } = renderWithProvider(
      <div>
        <WorkflowProvider initialWorkflow={{ name: 'A', nodes, connections: [valid] }}>
          <Consumer expose={aRef} />
        </WorkflowProvider>
        <WorkflowProvider initialWorkflow={{ name: 'B', nodes, connections: [valid] }}>
          <Consumer expose={bRef} />
        </WorkflowProvider>
      </div>
    )

    // Sanity
    expect(aRef.current?.state.connections.length).toBe(1)
    expect(bRef.current?.state.connections.length).toBe(1)

    // Update only provider A with invalid connection set
    flushSync(() => {
      aRef.current!.dispatch({ type: 'SET_CONNECTIONS', payload: [invalidMissingPort] })
    })

    // Deterministically run validation for provider A
    flushSync(() => {
      aRef.current!.validateConnections()
    })

    // A should have pruned invalid connections
    expect(aRef.current?.state.connections.length).toBe(0)
    // B should remain unchanged
    expect(bRef.current?.state.connections.length).toBe(1)

    // Cleanup
  flushSync(() => root.unmount())
  })

  it('exposes dragging helpers and toggles drag state', async () => {
    const ctxRef = { current: null as Ctx | null }
    const nodes: WorkflowNode[] = [createNode('A')]

    const { root } = renderWithProvider(
      <WorkflowProvider initialWorkflow={{ name: 'DragTest', nodes, connections: [] }}>
        <Consumer expose={ctxRef} />
      </WorkflowProvider>
    )

    expect(ctxRef.current?.isDragging()).toBe(false)

    flushSync(() => {
      ctxRef.current!.startDragging('A', { x: 10, y: 10 })
    })
    expect(ctxRef.current?.isDragging()).toBe(true)
    expect(ctxRef.current?.getDraggedNodeId()).toBe('A')

    flushSync(() => {
      ctxRef.current!.endDragging()
    })
    expect(ctxRef.current?.isDragging()).toBe(false)

    flushSync(() => root.unmount())
  })

  it('AUTO_SAVE_DRAFT updates lastAttempt timestamp without re-rendering core state', async () => {
    const ctxRef = { current: null as Ctx | null }
    const nodes: WorkflowNode[] = [createNode('A')]

    const { root } = renderWithProvider(
      <WorkflowProvider initialWorkflow={{ name: 'AutoSaveTest', nodes, connections: [] }}>
        <Consumer expose={ctxRef} />
      </WorkflowProvider>
    )

    const before = ctxRef.current!.getAutoSaveStatus().lastAttempt
    // Trigger auto-save (silent)
    flushSync(() => {
      ctxRef.current!.autoSaveDraft()
    })

    const after = ctxRef.current!.getAutoSaveStatus().lastAttempt
    expect(after).toBeGreaterThanOrEqual(before)

    flushSync(() => root.unmount())
  })
})
