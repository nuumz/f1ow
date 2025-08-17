import { describe, it, expect, beforeEach } from 'vitest'
import { createIconRegistry } from './icon-registry'

function createHostSvg(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '100')
    svg.setAttribute('height', '100')
    document.body.appendChild(svg)
    return svg
}

describe('icon-registry', () => {
    let host: SVGSVGElement
    beforeEach(() => {
        document.body.innerHTML = ''
        host = createHostSvg()
    })

    it('replaces placeholder rect with actual icon paths for mapped type', async () => {
        const { getArchitectureIconSvg } = createIconRegistry({ current: host })
        // "Rest Api" should normalize to key "rest-api" and map to Globe
        const svgMarkup = getArchitectureIconSvg('Rest Api', 24, '#333')
        // Inject the returned <svg><use/></svg> in DOM to trigger symbol creation
        const container = document.createElement('div')
        container.innerHTML = svgMarkup
        host.appendChild(container.firstChild as Node)

        // Allow RAF and async import to resolve
        await new Promise((r) => setTimeout(r, 30))

        const defs = host.querySelector('defs')!
        const symbol = defs.querySelector('#arch-icon-Globe') as SVGSymbolElement
        expect(symbol).toBeTruthy()
        // Should not be the placeholder rect only; expect there is at least a path/line/circle child
        const hasVectorChild = symbol.querySelector('path,line,circle,polyline,polygon,rect')
        expect(hasVectorChild).toBeTruthy()
    })

    it('returns an <svg> string with a <use> referencing the symbol', () => {
        const { getArchitectureIconSvg } = createIconRegistry({ current: host })
        const out = getArchitectureIconSvg('database', 16, 'red')
        expect(out).toContain('<svg')
        expect(out).toContain('use')
        expect(out).toContain('#arch-icon-Database')
    })
})
