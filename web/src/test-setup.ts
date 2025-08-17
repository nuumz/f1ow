import { afterEach, beforeAll, vi } from 'vitest'

// Basic RAF polyfill for jsdom
if (!globalThis.requestAnimationFrame) {
    // @ts-ignore
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number
}

beforeAll(() => {
    // nothing yet
})

afterEach(() => {
    vi.restoreAllMocks()
})
