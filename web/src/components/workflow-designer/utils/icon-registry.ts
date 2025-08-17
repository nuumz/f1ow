import React from 'react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'
import { renderToStaticMarkup } from 'react-dom/server'
// Statically import a small set of core icons we know we use frequently to avoid runtime import issues
import {
    Globe,
    Monitor,
    Server,
    Package as PackageIcon,
    Database,
    Users,
    FileText,
    Shield,
    Lock,
    Cpu,
    GitBranch,
    Layers,
    Smartphone,
    Tablet,
    HardDrive,
    Cloud,
    Network,
} from 'lucide-react'
import type { LucideIcon, LucideProps } from 'lucide-react'

export const staticIconMap: Record<string, LucideIcon> = {
    Globe,
    Monitor,
    Server,
    Package: PackageIcon,
    Database,
    Users,
    FileText,
    Shield,
    Lock,
    Cpu,
    GitBranch,
    Layers,
    Smartphone,
    Tablet,
    HardDrive,
    Cloud,
    Network,
}

export type ArchitectureIconGetter = (type: string, size: number, color: string) => string

// Mapping from our domain-specific node type aliases to lucide icon component names
export const iconNameMap: Record<string, string> = {
    server: 'Server',
    database: 'Database',
    globe: 'Globe',
    shield: 'Shield',
    monitor: 'Monitor',
    cloud: 'Cloud',
    branch: 'GitBranch',
    package: 'Package',
    users: 'Users',
    file: 'FileText',
    // Designer aliases
    http: 'Server',
    api: 'Globe',
    service: 'Cog',
    // Architecture palette types
    'rest-api': 'Globe',
    restapi: 'Globe',
    'graphql-api': 'GitBranch',
    websocket: 'Plug',
    'event-stream': 'Waves',
    'api-gateway': 'Server',
    'load-balancer': 'Network',
    webapp: 'Monitor',
    mobile: 'Smartphone',
    tablet: 'Tablet',
    // Use only safe, known Lucide icon names
    microservice: 'Package',
    // distinct system components
    queue: 'Package',
    'message-queue': 'Package',
    storage: 'HardDrive',
    cloudfunction: 'Cloud',
    container: 'Package',
    kubernetes: 'Layers',
    firewall: 'Shield',
    auth: 'Lock',
    'auth-service': 'Lock',
    authorization: 'Shield',
    external: 'Globe',
    thirdparty: 'Package',
    'ext-service': 'Globe',
    'ext-api': 'Globe',
    processor: 'Cpu',
    pipeline: 'GitBranch',
    documentation: 'FileText',
    team: 'Users',
    logger: 'FileText',
    metrics: 'Monitor',
    cdn: 'Globe',
    cache: 'HardDrive',
    // Use 'Package' as safer fallback than 'Box' (which might not exist depending on version)
    box: 'Package',
}

class IconRegistry {
    private svgRef: React.RefObject<SVGSVGElement>
    private loaded = new Set<string>()
    private loading = new Map<string, Promise<void>>()
    private placeholders = new Set<string>()
    private pendingRetry = new Set<string>()
    private retryScheduled = false

    constructor(svgRef: React.RefObject<SVGSVGElement>) {
        this.svgRef = svgRef
    }

    private ensureDefs(): SVGDefsElement | null {
        const svgEl = this.svgRef.current
        if (!svgEl) return null
        let defs = svgEl.querySelector('defs') as SVGDefsElement | null
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs') as SVGDefsElement
            svgEl.insertBefore(defs, svgEl.firstChild)
        }
        return defs
    }

    private createFallbackSymbol(defs: SVGDefsElement, iconName: string) {
        const svgNS = 'http://www.w3.org/2000/svg'
        const symbol = document.createElementNS(svgNS, 'symbol')
        symbol.setAttribute('id', `arch-icon-${iconName}`)
        symbol.setAttribute('viewBox', '0 0 24 24')
        const rect = document.createElementNS(svgNS, 'rect')
        rect.setAttribute('x', '4')
        rect.setAttribute('y', '4')
        rect.setAttribute('width', '16')
        rect.setAttribute('height', '16')
        rect.setAttribute('rx', '3')
        rect.setAttribute('ry', '3')
        rect.setAttribute('fill', 'none')
        rect.setAttribute('stroke', 'currentColor')
        rect.setAttribute('stroke-width', '2')
        symbol.appendChild(rect)
        defs.appendChild(symbol)
    }

    private scheduleRetry() {
        if (this.retryScheduled) return
        this.retryScheduled = true
        // Retry on next animation frame to wait for svgRef to mount
        requestAnimationFrame(() => {
            this.retryScheduled = false
            const items = Array.from(this.pendingRetry)
            this.pendingRetry.clear()
            for (const name of items) {
                // Try again; this will create defs and placeholder if possible
                this.ensureIconSymbol(name)
            }
        })
    }

    private async loadLucideIconComponent(iconKey: string): Promise<LucideIcon> {
        // 0) Fast path: use statically imported icons for core set
        if (staticIconMap[iconKey]) return staticIconMap[iconKey]

        const imports = dynamicIconImports as Record<string, (() => Promise<unknown>) | undefined>

        // 1) Try dynamicIconImports with given key and a few safe fallbacks
        const tryKeys = [iconKey, 'Package', 'Square', 'Archive']
        for (const key of tryKeys) {
            const importer = imports[key]
            if (typeof importer === 'function') {
                try {
                    const mod = (await importer()) as { default?: LucideIcon }
                    if (mod && typeof mod.default === 'function') return mod.default
                } catch {/* try next */ }
            }
        }

        // 2) Try per-icon path import with kebab-case name (e.g., lucide-react/icons/git-branch)
        const kebab = iconKey
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .replace(/\s+/g, '-')
            .toLowerCase()
        const pathCandidates = [kebab]
        // Add a couple of alternates for common mismatches
        if (kebab === 'filetext') pathCandidates.push('file-text')
        if (kebab === 'gitbranch') pathCandidates.push('git-branch')
        if (kebab === 'package') pathCandidates.push('box')
        for (const p of pathCandidates) {
            try {
                const mod = (await import(/* @vite-ignore */ `lucide-react/icons/${p}`)) as {
                    default?: LucideIcon
                }
                if (mod && typeof mod.default === 'function') return mod.default
            } catch {/* try next */ }
        }

        // 3) Fallback: import the whole module and use a named export
        try {
            const modAll = (await import('lucide-react')) as Record<string, unknown>
            const c = modAll[iconKey] as LucideIcon
            if (typeof c === 'function') return c
        } catch {/* ignore */ }

        // 4) Inline fallback icon component (no JSX in .ts file)
        const FallbackIcon = ((props: LucideProps) => {
            const size = (props?.size as number | string | undefined) ?? 24
            return React.createElement(
                'svg',
                {
                    width: size,
                    height: size,
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 2,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                },
                React.createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 })
            )
        }) as unknown as LucideIcon
        return FallbackIcon
    }

    private ensureIconSymbol(iconName: string) {
        if (this.loaded.has(iconName)) return

        // Ensure <defs> exists; if not, queue a retry
        let defs = this.ensureDefs()
        if (!defs) {
            this.pendingRetry.add(iconName)
            this.scheduleRetry()
            return
        }

        // Ensure a placeholder symbol is present immediately for visual fallback
        const existing = defs.querySelector(`#arch-icon-${iconName}`)
        if (!existing && !this.placeholders.has(iconName)) {
            try {
                this.createFallbackSymbol(defs, iconName)
                this.placeholders.add(iconName)
            } catch { /* noop */ }
        }

        if (this.loading.has(iconName)) return

        const p = (async () => {
            try {
                const Icon = await this.loadLucideIconComponent(iconName)
                const svgMarkup = renderToStaticMarkup(React.createElement(Icon, { size: 24 }))
                const parsed = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
                const iconSvg = parsed.documentElement
                const viewBox = iconSvg.getAttribute('viewBox') || '0 0 24 24'

                // Re-check defs in case it wasn't ready earlier
                defs = this.ensureDefs()
                if (!defs) return
                const svgNS = 'http://www.w3.org/2000/svg'

                // Reuse existing symbol (placeholder) if present; otherwise create new
                let symbol = defs.querySelector(`#arch-icon-${iconName}`) as SVGSymbolElement | null
                if (!symbol) {
                    symbol = document.createElementNS(svgNS, 'symbol')
                    symbol.setAttribute('id', `arch-icon-${iconName}`)
                    defs.appendChild(symbol)
                }

                // Reset and set core attributes
                symbol.setAttribute('viewBox', viewBox)
                // Preserve presentation attributes from the root <svg> so children render correctly
                const presentationAttrs = [
                    'fill',
                    'stroke',
                    'stroke-width',
                    'stroke-linecap',
                    'stroke-linejoin',
                    'stroke-miterlimit',
                    'color',
                ] as const
                for (const attr of presentationAttrs) {
                    const val = iconSvg.getAttribute(attr)
                    if (val != null) symbol.setAttribute(attr, val)
                }
                // Sensible defaults if icon markup doesn't specify
                if (!symbol.hasAttribute('stroke')) symbol.setAttribute('stroke', 'currentColor')
                if (!symbol.hasAttribute('fill')) symbol.setAttribute('fill', 'none')
                if (!symbol.hasAttribute('stroke-width')) symbol.setAttribute('stroke-width', '2')

                // Replace children with the actual icon paths
                while (symbol.firstChild) symbol.removeChild(symbol.firstChild)
                Array.from(iconSvg.childNodes).forEach((node) => {
                    const imported = defs!.ownerDocument?.importNode(node, true) || node.cloneNode(true)
                    symbol!.appendChild(imported)
                })

                this.loaded.add(iconName)
                this.placeholders.delete(iconName)
            } catch (e) {
                // Keep placeholder in place; mark as loaded only if we want to avoid endless retries
                if (process.env.NODE_ENV === 'development') console.warn('Failed to load icon', iconName, e)
            } finally {
                this.loading.delete(iconName)
            }
        })()

        this.loading.set(iconName, p)
    }

    getArchitectureIconSvg: ArchitectureIconGetter = (type, size, color) => {
        const key = normalizeArchitectureType(type)
        const iconName = resolveIconName(key)
        if (process.env.NODE_ENV === 'development' && !(key in iconNameMap)) {
            // Helpful during dev to spot unmapped types
            console.debug('[icon-registry] Unmapped architecture type:', type, '-> using', iconName)
        }
        this.ensureIconSymbol(iconName)
        // Provide both href and xlink:href for broader browser compatibility (older Safari)
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${color}"><use href="#arch-icon-${iconName}" xlink:href="#arch-icon-${iconName}" /></svg>`
    }
}

export function createIconRegistry(svgRef: React.RefObject<SVGSVGElement>): { getArchitectureIconSvg: ArchitectureIconGetter } {
    const registry = new IconRegistry(svgRef)
    return {
        getArchitectureIconSvg: registry.getArchitectureIconSvg,
    }
}

// Helper: normalize architecture type keys consistently across app (palette, canvas, etc.)
export function normalizeArchitectureType(type: string): string {
    return (type || '')
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

// Helper: given a (normalized) type key, resolve to a Lucide icon component name
export function resolveIconName(typeOrKey: string): string {
    const key = normalizeArchitectureType(typeOrKey)
    return iconNameMap[key] ?? 'Package'
}
