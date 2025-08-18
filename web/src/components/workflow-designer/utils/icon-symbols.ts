import type * as d3 from 'd3'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
    Server,
    Database,
    Globe,
    Shield,
    Monitor,
    Cloud,
    GitBranch,
    Package,
    Users,
    FileText,
    Box,
} from 'lucide-react'

// Map node type to lucide-react icon component
const iconMap: Record<string, React.ComponentType<any>> = {
    server: Server,
    database: Database,
    globe: Globe,
    'rest-api': Globe,
    api: Globe,
    shield: Shield,
    monitor: Monitor,
    cloud: Cloud,
    branch: GitBranch,
    package: Package,
    users: Users,
    file: FileText,
    box: Box,
}

export function getIconSymbolId(type: string): string {
    return `icon-${type}`
}

// Ensure a shared <symbol> for the given icon type exists in <defs>, and return its id
export function ensureIconSymbol(
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    type: string
): string {
    const id = getIconSymbolId(type)
    if (!defs.select(`#${id}`).empty()) {return id}

    const Icon = iconMap[type] || Box
    // Render canonical 24px SVG with currentColor so color can be controlled by container via CSS
    const svgMarkup = renderToStaticMarkup(
        React.createElement(Icon, { size: 24, color: 'currentColor', strokeWidth: 1.8 })
    )
    const match = svgMarkup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
    const inner = match ? match[1] : svgMarkup
    const wrapperAttrs =
        'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'

    defs
        .append('symbol')
        .attr('id', id)
        .attr('viewBox', '0 0 24 24')
        .html(`<g ${wrapperAttrs}>${inner}</g>`)

    return id
}

export function ensureIconSymbols(
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    types: string[]
): void {
    for (const t of types) {ensureIconSymbol(defs, t)}
}

// Render or update a single <use> element inside the provided group, referencing the shared symbol
export function renderIconUse(
    g: d3.Selection<SVGGElement, any, any, any>,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    type: string,
    size: number,
    color: string,
    offsetX: number,
    offsetY: number
): void {
    const nodeEl = g.node() as any
    if (!nodeEl) {return}

    const symbolId = ensureIconSymbol(defs, type)
    const key = `${type}:${size}`

    // Center icon at (0,0) by translating its top-left corner
    const tx = offsetX - size / 2
    const ty = offsetY - size / 2
    g.attr('transform', `translate(${tx}, ${ty})`)

    // Create or update <use>
    let useEl = g.select<SVGUseElement>('use.icon-use')
    if (useEl.empty()) {
        useEl = g
            .append('use')
            .attr('class', 'icon-use')
            .attr('href', `#${symbolId}`)
            .attr('xlink:href', `#${symbolId}`)
    } else {
        useEl.attr('href', `#${symbolId}`).attr('xlink:href', `#${symbolId}`)
    }

    useEl.attr('width', size).attr('height', size).attr('x', 0).attr('y', 0)

    // Apply color via currentColor; keep stroke-width visually consistent
    g.style('color', color).style('stroke-width', '1.8')

    nodeEl.__iconKey = key
}
