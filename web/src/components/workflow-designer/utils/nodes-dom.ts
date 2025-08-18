import * as d3 from "d3";
import type { WorkflowNode, Connection, NodePort, NodeTypeInfo } from "../types";
import { getShapePath } from "./shape-utils";

type SelG<Datum = unknown> = d3.Selection<SVGGElement, Datum, SVGGElement, unknown>;
type GSel = d3.Selection<SVGGElement, unknown, null, undefined>;
type DesignerMode = "workflow" | "architecture";
type DimInfo = {
    width: number;
    height: number;
    iconSize?: number;
    iconOffset?: { x?: number; y?: number };
    fontSize?: number;
    labelOffset?: { x?: number; y?: number };
};
type IconKeyElement = SVGGElement & { __iconKey?: string };

export function attachNodeBackgroundEvents(
    nodeEnter: SelG<WorkflowNode>,
    cfg: {
        isDragging: boolean;
        isConnecting: boolean;
        canDropOnNode?: (nodeId: string) => boolean;
        onNodeClick: (node: WorkflowNode, multi: boolean) => void;
        onNodeDoubleClick: (node: WorkflowNode) => void;
        setDropFeedback: (nodeElement: GSel, show: boolean) => void;
        workflowContextState: { designerMode: DesignerMode };
        connections: Connection[];
        connectionStart: { nodeId: string; portId: string; type: "input" | "output" } | null;
        onPortDragEnd: (targetNodeId?: string, targetPortId?: string) => void;
    }
) {
    const {
        isDragging,
        isConnecting,
        canDropOnNode,
        onNodeClick,
        onNodeDoubleClick,
        setDropFeedback,
        workflowContextState,
        connections,
        connectionStart,
        onPortDragEnd,
    } = cfg;

    nodeEnter
        .select<SVGPathElement>(".node-background")
        .on("click", (event: MouseEvent, d: WorkflowNode) => {
            if (!isDragging) {
                event.stopPropagation();
                const ctrlKey = event.ctrlKey || event.metaKey;
                onNodeClick(d, !!ctrlKey);
            }
        })
        .on("dblclick", (event: MouseEvent, d: WorkflowNode) => {
            event.stopPropagation();
            event.preventDefault();
            onNodeDoubleClick(d);
        })
        .on("dragover", (event: DragEvent, d: WorkflowNode) => {
            if (isConnecting && canDropOnNode?.(d.id)) {
                event.preventDefault();
                event.stopPropagation();
                const parent = (event.currentTarget as Element | null)?.parentNode as SVGGElement;
                const nodeElement = d3.select(parent) as GSel;
                setDropFeedback(nodeElement, true);
            }
        })
        .on("dragleave", (event: DragEvent) => {
            const parent = (event.currentTarget as Element | null)?.parentNode as SVGGElement;
            const nodeElement = d3.select(parent) as GSel;
            setDropFeedback(nodeElement, false);
        })
        .on("drop", (event: DragEvent, d: WorkflowNode) => {
            event.preventDefault();
            event.stopPropagation();
            const parent = (event.currentTarget as Element | null)?.parentNode as SVGGElement;
            const nodeElement = d3.select(parent) as GSel;
            setDropFeedback(nodeElement, false);

            if (isConnecting && canDropOnNode?.(d.id)) {
                let availableInputPorts: NodePort[] = [];
                if (workflowContextState.designerMode === "architecture") {
                    availableInputPorts =
                        d.inputs?.filter((port: NodePort) => {
                            return !connections.some(
                                (conn: Connection) =>
                                    conn.sourceNodeId === connectionStart?.nodeId &&
                                    conn.sourcePortId === connectionStart?.portId &&
                                    conn.targetNodeId === d.id &&
                                    conn.targetPortId === port.id
                            );
                        }) || [];
                } else {
                    availableInputPorts =
                        d.inputs?.filter((port: NodePort) => {
                            return !connections.some(
                                (conn: Connection) => conn.targetNodeId === d.id && conn.targetPortId === port.id
                            );
                        }) || [];
                }

                if (availableInputPorts.length > 0) {
                    const targetPort = availableInputPorts[0];
                    onPortDragEnd(d.id, targetPort.id);
                } else {
                    onPortDragEnd();
                }
            }
        });
}

export function updateNodeBackgroundPath(
    nodeGroups: SelG<WorkflowNode>,
    deps: {
        designerMode: DesignerMode;
        getConfigurableDimensions: (d: WorkflowNode) => { width: number; height: number };
        getNodeShape: (nodeType: string) => string;
        getNodeShapePath: (
            node: WorkflowNode,
            borderRadius:
                | number
                | { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number }
        ) => { d: string };
    }
) {
    const { designerMode, getConfigurableDimensions, getNodeShape, getNodeShapePath } = deps;

    const bgSel = nodeGroups.select<SVGPathElement>(".node-background");

    bgSel
        .attr("d", (d: WorkflowNode) => {
            const shape = getNodeShape(d.type);
            let borderRadius: number | { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number } = 0;

            if (designerMode === "architecture") {
                const dims = getConfigurableDimensions(d);
                const radius = 14;
                const pathData = getShapePath("rectangle", dims.width, dims.height, radius);
                return pathData.d;
            }

            if (d.type === "start") {
                const dimensions = getConfigurableDimensions(d);
                const leftRadius = Math.min(dimensions.width, dimensions.height) * 0.3;
                const rightRadius = 8;
                borderRadius = {
                    topLeft: leftRadius,
                    bottomLeft: leftRadius,
                    topRight: rightRadius,
                    bottomRight: rightRadius,
                };
            } else if (shape === "rectangle" || shape === "square") {
                borderRadius = 8;
            }

            const shapePath = getNodeShapePath(d, borderRadius);
            return shapePath.d;
        })
        .attr("fill", "#ffffff");
}

export function applyNodeVisualState(
    nodeGroups: SelG<WorkflowNode>,
    deps: {
        isNodeSelected: (id: string) => boolean;
        getDraggedNodeId: () => string | null | undefined;
        isContextDragging: () => boolean;
        getNodeColor: (type: string, status?: string) => string;
    }
) {
    const { isNodeSelected, getDraggedNodeId, isContextDragging, getNodeColor } = deps;

    nodeGroups.each(function (d: WorkflowNode) {
        const nodeElement = d3.select<SVGGElement, WorkflowNode>(this as SVGGElement);
        const isSelected = isNodeSelected(d.id);

        let isNodeDragging = false;
        const currentDraggedNodeId = getDraggedNodeId();
        const dragging = isContextDragging();
        const hasExistingDraggingClass = nodeElement.classed("dragging");

        if (currentDraggedNodeId && dragging && currentDraggedNodeId === d.id) {
            if (!hasExistingDraggingClass) {
                nodeElement.classed("dragging", true);
            }
            isNodeDragging = true;
        } else if (dragging && currentDraggedNodeId && currentDraggedNodeId !== d.id) {
            if (hasExistingDraggingClass) {
                nodeElement.classed("dragging", false);
            }
        } else if (!dragging) {
            if (hasExistingDraggingClass) {
                nodeElement.classed("dragging", false);
            }
        } else {
            isNodeDragging = hasExistingDraggingClass;
        }

        if (!dragging && hasExistingDraggingClass) {
            nodeElement.classed("dragging", false);
            isNodeDragging = false;
        }

        const nodeBackground = nodeElement.select<SVGPathElement>(".node-background");

        nodeElement.classed("selected", isSelected);

        let opacity = 1;
        let filter = "none";
        let strokeColor = getNodeColor(d.type, d.status);
        let strokeWidth = 2;

        if (isSelected || isNodeDragging) {
            strokeColor = "#2196F3";
            strokeWidth = 3;
            if (isNodeDragging) {
                opacity = 0.9;
                filter = "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))";
            } else if (isSelected) {
                filter = "drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))";
            }
        }

        nodeElement.style("opacity", opacity).style("filter", filter);
        nodeBackground.attr("stroke", strokeColor).attr("stroke-width", strokeWidth);
    });
}

export function updateArchOutline(
    nodeGroups: SelG<WorkflowNode>,
    deps: {
        isArchMode: boolean;
        getNodeTypeInfo: (type: string) => Partial<NodeTypeInfo> | undefined;
        getConfigurableDimensions: (d: WorkflowNode) => { width: number; height: number };
    }
) {
    const { isArchMode, getNodeTypeInfo, getConfigurableDimensions } = deps;

    const outlineEnabledNodes = nodeGroups.filter((d: WorkflowNode) => {
        const info = getNodeTypeInfo(d.type as string);
        return isArchMode && (info?.archOutline ?? false);
    });

    outlineEnabledNodes.select(".node-arch-outline").each(function (d: WorkflowNode) {
        const outline = d3.select<SVGRectElement, WorkflowNode>(this as unknown as SVGRectElement);
        const dims = getConfigurableDimensions(d);
        const typeInfo = getNodeTypeInfo(d.type as string);
        const pad = typeInfo?.archOutlinePadding ?? 8;
        const corner = typeInfo?.archOutlineCornerRadius ?? 16;
        const color = typeInfo?.archOutlineColor || "#3b82f6";
        const strokeW = typeInfo?.archOutlineWidth ?? 2;
        const dash = typeInfo?.archOutlineDash ?? "6,6";
        const opacity = typeInfo?.archOutlineOpacity ?? 0.8;

        outline
            .attr("x", -dims.width / 2 - pad)
            .attr("y", -dims.height / 2 - pad)
            .attr("width", dims.width + pad * 2)
            .attr("height", dims.height + pad * 2)
            .attr("rx", corner)
            .attr("vector-effect", "non-scaling-stroke")
            .style("display", null)
            .style("stroke", color)
            .style("stroke-width", strokeW as unknown as string)
            .style("stroke-dasharray", String(dash))
            .style("opacity", opacity);
    });

    const outlineDisabledNodes = nodeGroups.filter((d: WorkflowNode) => {
        const info = getNodeTypeInfo(d.type as string);
        return !(isArchMode && (info?.archOutline ?? false));
    });
    outlineDisabledNodes.select(".node-arch-outline").style("display", "none");
}

export function updateIconsAndLabels(
    nodeGroups: SelG<WorkflowNode>,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    deps: {
        designerMode: DesignerMode;
        getConfigurableDimensions: (d: WorkflowNode) => DimInfo;
        NodeTypes: Record<string, { label?: string }>;
        getNodeIcon: (type: string) => string;
        renderIconUse: (
            gSel: d3.Selection<SVGGElement, unknown, null, undefined>,
            defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
            type: string,
            size: number,
            color: string,
            dx: number,
            dy: number
        ) => void;
    }
) {
    const { designerMode, getConfigurableDimensions, NodeTypes, getNodeIcon, renderIconUse } = deps;

    nodeGroups
        .select<SVGTextElement>(".node-icon")
        .style("display", () => (designerMode === "architecture" ? "none" : null))
        .attr("x", (d: WorkflowNode) => getConfigurableDimensions(d).iconOffset?.x ?? 0)
        .attr("y", (d: WorkflowNode) => getConfigurableDimensions(d).iconOffset?.y ?? -8)
        .attr("dy", () => (designerMode === "architecture" ? "0.1em" : "0"))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", (d: WorkflowNode) => getConfigurableDimensions(d).iconSize || 18)
        .attr("fill", "#8d8d8d")
        .text((d: WorkflowNode) => getNodeIcon(d.type));

    nodeGroups
        .select<SVGGElement>(".node-icon-svg")
        .style("display", () => (designerMode === "architecture" ? null : "none"))
        .style("stroke-width", 1.8 as unknown as string)
        .each(function (d: WorkflowNode) {
            const gSel = d3.select<SVGGElement, WorkflowNode>(this as SVGGElement);
            if (designerMode !== "architecture") {
                gSel.html("");
                return;
            }
            const dimensions = getConfigurableDimensions(d);
            const size = dimensions.iconSize || 24;
            const color = "#8d8d8d";
            const key = `${d.type}:${size}`;
            const nodeEl = gSel.node() as IconKeyElement | null;
            if (!nodeEl) {
                return;
            }
            if (nodeEl.__iconKey !== key) {
                renderIconUse(
                    gSel as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
                    defs,
                    d.type,
                    size,
                    color,
                    dimensions.iconOffset?.x ?? 0,
                    dimensions.iconOffset?.y ?? 0
                );
                nodeEl.__iconKey = key;
            }
        });

    nodeGroups
        .select<SVGTextElement>(".node-label")
        .attr("x", (d: WorkflowNode) =>
            designerMode === "architecture"
                ? getConfigurableDimensions(d).width / 2 + 18
                : getConfigurableDimensions(d).labelOffset?.x || 0
        )
        .attr("y", (d: WorkflowNode) =>
            designerMode === "architecture" ? -6 : getConfigurableDimensions(d).labelOffset?.y || 15
        )
        .attr("text-anchor", () => (designerMode === "architecture" ? "start" : "middle"))
        .attr("dominant-baseline", "middle")
        .attr("font-size", (d: WorkflowNode) => (getConfigurableDimensions(d).fontSize || 12) - 1)
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .text((d: WorkflowNode) => {
            const nodeTypeInfo = NodeTypes[d.type as keyof typeof NodeTypes];
            return nodeTypeInfo?.label || d.label || d.type;
        });

    nodeGroups
        .select<SVGTextElement>(".node-sublabel")
        .attr("x", (d: WorkflowNode) =>
            designerMode === "architecture" ? getConfigurableDimensions(d).width / 2 + 18 : 0
        )
        .attr("y", () => (designerMode === "architecture" ? 10 : 99999))
        .attr("text-anchor", () => (designerMode === "architecture" ? "start" : "middle"))
        .attr("dominant-baseline", "middle")
        .attr("font-size", (d: WorkflowNode) => (getConfigurableDimensions(d).fontSize || 12) - 3)
        .attr("fill", "#6b7280")
        .style("display", () => (designerMode === "architecture" ? null : "none"))
        .text((d: WorkflowNode) => d.metadata?.version || d.id);
}