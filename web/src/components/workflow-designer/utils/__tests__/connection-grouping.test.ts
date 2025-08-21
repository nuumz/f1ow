import { describe, it, expect } from 'vitest'
import type { Connection, WorkflowNode } from '../../types'
import { groupConnectionsBySideAndPort } from '../connection-utils'

function makeNode(id: string, x: number, y: number): WorkflowNode {
    return {
        id,
        label: id,
        x,
        y,
        type: 'test',
        inputs: [
            { id: 'in1', label: 'in1', type: 'input', dataType: 'any' },
            { id: 'in2', label: 'in2', type: 'input', dataType: 'any' },
        ],
        outputs: [
            { id: 'out1', label: 'out1', type: 'output', dataType: 'any' },
            { id: 'out2', label: 'out2', type: 'output', dataType: 'any' },
        ],
        config: {},
    }
}

describe('groupConnectionsBySideAndPort (architecture mode)', () => {
    it('groups multiple connections between the same node pair and side groups into one bucket', () => {
        const A = makeNode('A', 0, 0)
        const B = makeNode('B', 300, 0) // to the right of A
        const C = makeNode('C', 300, 200)
        const nodes = [A, B, C]

        const connections: Connection[] = [
            { id: 'c1', sourceNodeId: 'A', sourcePortId: 'out1', targetNodeId: 'B', targetPortId: 'in1' },
            { id: 'c2', sourceNodeId: 'A', sourcePortId: 'out2', targetNodeId: 'B', targetPortId: 'in2' },
            // Same pair A->B but different ports should still group together by side+port-group
            { id: 'c3', sourceNodeId: 'A', sourcePortId: 'out1', targetNodeId: 'B', targetPortId: 'in2' },
            // Different target node forms a different bucket
            { id: 'c4', sourceNodeId: 'A', sourcePortId: 'out1', targetNodeId: 'C', targetPortId: 'in1' },
        ]

        const buckets = groupConnectionsBySideAndPort(connections, nodes, 'architecture')
        // Expect two buckets: one for A->B and one for A->C
        expect(buckets.size).toBe(2)

        // Find the bucket for A->B
        const abBucket = Array.from(buckets.values()).find(
            (b) => b.items.every((i) => i.sourceNodeId === 'A') && b.items.every((i) => i.targetNodeId === 'B')
        )
        expect(abBucket).toBeDefined()
        expect(abBucket!.items).toHaveLength(3)

        // Validate side/group mapping for architecture defaults (A right side to B left side)
        expect(abBucket!.sourceSide).toBe('__side-right')
        expect(abBucket!.targetSide).toBe('__side-left')
        expect(abBucket!.sourceGroup).toBe('output-port-group')
        expect(abBucket!.targetGroup).toBe('input-port-group')
    })
})
