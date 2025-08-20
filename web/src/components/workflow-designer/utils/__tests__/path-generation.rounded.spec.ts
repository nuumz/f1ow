import { describe, it, expect } from 'vitest'
import { generateAdaptiveOrthogonalRoundedPathSmart } from '../path-generation'

describe('generateAdaptiveOrthogonalRoundedPathSmart (rounded corners)', () => {
    it('emits quadratic curves (Q) at bends', () => {
        const source = { x: 0, y: 0 }
        const target = { x: 120, y: 60 }
        const path = generateAdaptiveOrthogonalRoundedPathSmart(source, target, 12, {
            // Force clear orientation to ensure at least one bend
            startOrientationOverride: 'horizontal',
            endOrientationOverride: 'vertical',
            clearance: 10
        })
        expect(typeof path).toBe('string')
        // Rounded corners should be represented by quadratic Beziers (Q)
        expect(path).toMatch(/\bQ\s+[-0-9.]+\s+[-0-9.]+\s+[-0-9.]+\s+[-0-9.]+/)
    })
})
