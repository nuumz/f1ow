// Minimal jsdom and RAF polyfills for Vitest
import { vi } from 'vitest'

// requestAnimationFrame/cancelAnimationFrame polyfill
if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number
}
if (!globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame = (id: number): void => {
        clearTimeout(id as unknown as NodeJS.Timeout)
    }
}

// Stub for SVGElement.getScreenCTM in jsdom
if (!(SVGElement.prototype as any).getScreenCTM) {
    (SVGElement.prototype as any).getScreenCTM = function (): DOMMatrix | null {
        try {
            // Basic identity matrix sufficient for most unit tests
            return new DOMMatrix()
        } catch {
            return null
        }
    }
}

// Silence console.log in tests to keep output clean; keep warn/error
// eslint-disable-next-line no-console
const originalLog = console.log
// eslint-disable-next-line no-console
console.log = vi.fn() as unknown as typeof console.log

// Restore after all tests (vitest runs setup once per worker)
vi.spyOn(console, 'warn')
vi.spyOn(console, 'error')

export function restoreConsole() {
    // eslint-disable-next-line no-console
    console.log = originalLog
}
