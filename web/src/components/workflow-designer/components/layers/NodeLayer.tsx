/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type * as d3 from "d3";
import type { WorkflowNode, Connection } from "../../types";
import { useNodeRendering } from "../../hooks/useNodeRendering";

export type NodeLayerProps = {
  svgRef: React.RefObject<SVGSVGElement>;
  nodes: WorkflowNode[];
  connections: Connection[];
  isDragging: boolean;
  designerMode?: "workflow" | "architecture";
  isNodeSelected: (nodeId: string) => boolean;
  onNodeClick: (node: WorkflowNode, multi?: boolean) => void;
  onNodeDoubleClick: (node: WorkflowNode, event?: any) => void;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  onPortClick: (nodeId: string, portId: string, type: "input" | "output") => void;
  onPlusButtonClick?: (nodeId: string, portId: string) => void;
  onPortDragStart: (nodeId: string, portId: string, type: "input" | "output") => void;
  onPortDrag: (x: number, y: number) => void;
  onPortDragEnd: (targetNodeId?: string, targetPortId?: string, canvasX?: number, canvasY?: number) => void;
  canDropOnNode?: (targetNodeId: string) => boolean;
  isContextDragging: () => boolean;
  getDraggedNodeId: () => string | null;
  startDragging: (id: string, at: { x: number; y: number }) => void;
  updateDragPosition: (x: number, y: number) => void;
  endDragging: () => void;
  setDropFeedback: (
    nodeElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    show: boolean
  ) => void;
  applyDragVisualStyle: (nodeElement: any, nodeId: string) => void;
  updateDraggedNodePosition: (nodeId: string, newX: number, newY: number) => void;
  resetNodeVisualStyle: (nodeElement: any, nodeId: string) => void;
  setNodeAsDragging: (nodeId: string) => void;
  organizeNodeZIndex: (immediate?: boolean) => void;
  getConfigurableDimensions: (n: any) => any;
  getArchitectureIconSvg: (type: string, size: number, color: string) => string;
  isServicesArchitectureNode: (node: any) => boolean;
  getPortHighlightClass: (nodeId: string, portId: string, portType: "input" | "output") => string;
  getConfigurablePortPositions: (node: WorkflowNode, portType: "input" | "output") => Array<{ x: number; y: number }>;
  draggedElementRef: React.MutableRefObject<d3.Selection<any, any, any, any> | null>;
  draggedNodeElementRef: React.MutableRefObject<SVGGElement | null>;
  allNodeElementsRef: React.MutableRefObject<Map<string, SVGGElement>>;
  dragStateCleanupRef: React.MutableRefObject<NodeJS.Timeout | null>;
  currentDragPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  connectionUpdateQueueRef: React.MutableRefObject<Set<string>>;
  visualUpdateQueueRef: React.MutableRefObject<Set<string>>;
};

function NodeLayer(props: NodeLayerProps) {
  useNodeRendering({
    svgRef: props.svgRef,
    nodes: props.nodes,
    connections: props.connections,
    isDragging: props.isDragging,
    designerMode: props.designerMode,
    isNodeSelected: props.isNodeSelected,
    onNodeClick: props.onNodeClick,
    onNodeDoubleClick: props.onNodeDoubleClick,
    onNodeDrag: props.onNodeDrag,
    onPortClick: props.onPortClick,
    onPlusButtonClick: props.onPlusButtonClick,
    onPortDragStart: props.onPortDragStart,
    onPortDrag: props.onPortDrag,
    onPortDragEnd: props.onPortDragEnd,
    canDropOnNode: props.canDropOnNode,
    isContextDragging: props.isContextDragging,
    getDraggedNodeId: props.getDraggedNodeId,
    startDragging: props.startDragging,
    updateDragPosition: props.updateDragPosition,
    endDragging: props.endDragging,
    setDropFeedback: props.setDropFeedback,
    applyDragVisualStyle: props.applyDragVisualStyle,
    updateDraggedNodePosition: props.updateDraggedNodePosition,
    resetNodeVisualStyle: props.resetNodeVisualStyle,
    setNodeAsDragging: props.setNodeAsDragging,
    organizeNodeZIndex: props.organizeNodeZIndex,
    getConfigurableDimensions: props.getConfigurableDimensions as any,
    getArchitectureIconSvg: props.getArchitectureIconSvg,
    isServicesArchitectureNode: props.isServicesArchitectureNode,
    getPortHighlightClass: props.getPortHighlightClass,
    getConfigurablePortPositions: props.getConfigurablePortPositions,
    draggedElementRef: props.draggedElementRef,
    draggedNodeElementRef: props.draggedNodeElementRef,
    allNodeElementsRef: props.allNodeElementsRef,
    dragStateCleanupRef: props.dragStateCleanupRef,
    currentDragPositionsRef: props.currentDragPositionsRef,
    connectionUpdateQueueRef: props.connectionUpdateQueueRef,
    visualUpdateQueueRef: props.visualUpdateQueueRef,
  });
  return null;
}

function nodeLayerPropsAreEqual(prev: NodeLayerProps, next: NodeLayerProps) {
  if (prev.designerMode !== next.designerMode) return false;
  if (prev.isDragging !== next.isDragging) return false;

  const prevNodeFp = prev.nodes
    .map((n) => `${n.id}@${Math.round((n as any).x ?? 0)},${Math.round((n as any).y ?? 0)}#${(n as any).inputs?.length ?? 0}:${(n as any).outputs?.length ?? 0}`)
    .sort()
    .join('|');
  const nextNodeFp = next.nodes
    .map((n) => `${n.id}@${Math.round((n as any).x ?? 0)},${Math.round((n as any).y ?? 0)}#${(n as any).inputs?.length ?? 0}:${(n as any).outputs?.length ?? 0}`)
    .sort()
    .join('|');
  if (prevNodeFp !== nextNodeFp) return false;

  const prevConnIds = prev.connections.map((c) => c.id ?? `${c.sourceNodeId}->${c.targetNodeId}`).sort().join('|');
  const nextConnIds = next.connections.map((c) => c.id ?? `${c.sourceNodeId}->${c.targetNodeId}`).sort().join('|');
  if (prevConnIds !== nextConnIds) return false;

  // Re-render when critical handler/selector functions change to avoid stale closures
  if (prev.onNodeClick !== next.onNodeClick) return false;
  if (prev.isNodeSelected !== next.isNodeSelected) return false;
  if (prev.onNodeDoubleClick !== next.onNodeDoubleClick) return false;
  if (prev.onNodeDrag !== next.onNodeDrag) return false;

  return true;
}

export default React.memo(NodeLayer, nodeLayerPropsAreEqual);
