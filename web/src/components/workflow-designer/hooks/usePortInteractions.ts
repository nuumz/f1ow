import { useEffect } from 'react'
import * as d3 from 'd3'

type DesignerMode = 'workflow' | 'architecture'

interface PortDatum {
    id: string
    nodeId: string
    nodeData?: unknown
}

interface Dimensions {
    portRadius: number
}

interface Params {
    svgRef: React.RefObject<SVGSVGElement>
    isConnecting: boolean
    connectionStart: { nodeId: string; portId: string; type: 'input' | 'output' } | null
    canDropOnPort?: (targetNodeId: string, targetPortId: string, portType?: 'input' | 'output') => boolean
    designerMode?: DesignerMode
    getConfigurableDimensions: (nodeData: unknown) => Dimensions
    getPortColor: (dataType: string) => string
    // Optional debounced highlighter for inputs (to avoid flicker)
    updatePortHighlighting?: (portKey: string, canDrop: boolean, portGroup: d3.Selection<SVGGElement, unknown, null, undefined>) => void
}

// Helper: compute desired port visuals without nested ternaries
function computePortVisuals(params: {
    isActive: boolean
    canDrop: boolean
    archNoValidation: boolean
    dims: Dimensions
    getPortColor: (dataType: string) => string
}) {
    const { isActive, canDrop, archNoValidation, dims, getPortColor } = params

    if (isActive && !archNoValidation) {
        const ok = !!canDrop
        return {
            fill: ok ? '#4CAF50' : '#ccc',
            stroke: ok ? '#4CAF50' : '#ff5722',
            strokeWidth: ok ? 3 : 2,
            radius: ok ? dims.portRadius * 1.5 : dims.portRadius,
        }
    }
    return {
        fill: getPortColor('any'),
        stroke: '#8d8d8d',
        strokeWidth: 2,
        radius: dims.portRadius,
    }
}

// Helper: set attr if changed to avoid unnecessary DOM writes
function setAttrIfChanged(
    sel: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    name: string,
    value: string | number
) {
    const current = sel.attr(name)
    const strValue = String(value)
    if (current !== strValue) sel.attr(name, strValue)
}

// Helper: update can-dropped with optional debounced highlighter
function setCanDropped(
    portKey: string,
    canDrop: boolean,
    portGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    updater?: (portKey: string, canDrop: boolean, portGroup: d3.Selection<SVGGElement, unknown, null, undefined>) => void
) {
    if (updater) {
        updater(portKey, canDrop, portGroup)
    } else {
        portGroup.classed('can-dropped', canDrop)
    }
}

export function usePortInteractions(params: Params) {
    const { svgRef, isConnecting, connectionStart, canDropOnPort, designerMode = 'workflow', getConfigurableDimensions, getPortColor, updatePortHighlighting } = params

    useEffect(() => {
        const svgEl = svgRef.current
        if (!svgEl) return

        const svg = d3.select(svgEl)
        const nodeLayer = svg.select('.node-layer')
        if (nodeLayer.empty()) return

        const archNoValidation = designerMode === 'architecture'

        // Update input ports visual state
        nodeLayer.selectAll<SVGCircleElement, PortDatum>('.input-port-circle').each(function (d) {
            const circleEl = d3.select(this)
            const parent = this.parentNode as SVGGElement | null
            const portGroup = parent ? d3.select(parent) : null

            const isActive = !!(isConnecting && connectionStart && connectionStart.type === 'output')
            const canDrop = isActive ? !!canDropOnPort?.(d.nodeId, d.id, 'input') : false

            if (portGroup) {
                const portKey = `${d.nodeId}-${d.id}`
                const visible = isActive && !archNoValidation && canDrop
                setCanDropped(portKey, visible, portGroup, updatePortHighlighting)
            }

            const dims = getConfigurableDimensions(d.nodeData)
            const visuals = computePortVisuals({ isActive, canDrop, archNoValidation, dims, getPortColor })

            setAttrIfChanged(circleEl, 'fill', visuals.fill)
            setAttrIfChanged(circleEl, 'stroke', visuals.stroke)
            setAttrIfChanged(circleEl, 'stroke-width', visuals.strokeWidth)
            setAttrIfChanged(circleEl, 'r', visuals.radius)
        })

        // Update output ports visual state
        nodeLayer.selectAll<SVGCircleElement, PortDatum>('.output-port-circle').each(function (d) {
            const circleEl = d3.select(this)
            const parent = this.parentNode as SVGGElement | null
            const portGroup = parent ? d3.select(parent) : null

            const isActive = !!(isConnecting && connectionStart && connectionStart.type === 'input')
            const canDrop = isActive ? !!canDropOnPort?.(d.nodeId, d.id, 'output') : false

            if (portGroup) {
                const portKey = `${d.nodeId}-${d.id}`
                const visible = isActive && !archNoValidation && canDrop
                setCanDropped(portKey, visible, portGroup, updatePortHighlighting)
            }

            const dims = getConfigurableDimensions(d.nodeData)
            const visuals = computePortVisuals({ isActive, canDrop, archNoValidation, dims, getPortColor })

            setAttrIfChanged(circleEl, 'fill', visuals.fill)
            setAttrIfChanged(circleEl, 'stroke', visuals.stroke)
            setAttrIfChanged(circleEl, 'stroke-width', visuals.strokeWidth)
            setAttrIfChanged(circleEl, 'r', visuals.radius)
        })
    }, [svgRef, isConnecting, connectionStart, canDropOnPort, designerMode, getConfigurableDimensions, getPortColor, updatePortHighlighting])
}
