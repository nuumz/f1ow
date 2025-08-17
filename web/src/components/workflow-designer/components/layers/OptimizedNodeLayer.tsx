/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import type * as d3 from "d3";
import type { WorkflowNode, Connection } from "../../types";
import { useNodeRendering } from "../../hooks/useNodeRendering";

// Consolidated props interface to reduce prop drilling
export interface NodeLayerConfig {
  svgRef: React.RefObject<SVGSVGElement>;
  nodes: WorkflowNode[];
  connections: Connection[];
  isDragging: boolean;
  designerMode?: "workflow" | "architecture";
}

export interface NodeLayerCallbacks {
  isNodeSelected: (nodeId: string) => boolean;
  onNodeClick: (node: WorkflowNode, multi?: boolean) => void;
  onNodeDoubleClick: (node: WorkflowNode, event?: any) => void;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  onPortClick: (nodeId: string, portId: string, type: "input" | "output") => void;
  onPlusButtonClick?: (nodeId: string, portId: string) => void;
  onPortDragStart: (nodeId: string, portId: string, type: "input" | "output") => void;
  onPortDrag: (x: number, y: number) => void;
  onPortDragEnd: (targetNodeId?: string, targetPortId?: string) => void;
  canDropOnNode?: (targetNodeId: string) => boolean;
}

export interface NodeLayerContext {
  isContextDragging: () => boolean;
  getDraggedNodeId: () => string | null;
  startDragging: (id: string, at: { x: number; y: number }) => void;
  updateDragPosition: (x: number, y: number) => void;
  endDragging: () => void;
}

export interface NodeLayerVisuals {
  setDropFeedback: (
    nodeElement: d3.Selection<SVGGElement, unknown, null, undefined>,
    show: boolean
  ) => void;
  applyDragVisualStyle: (nodeElement: any, nodeId: string) => void;
  updateDraggedNodePosition: (nodeId: string, newX: number, newY: number) => void;
  resetNodeVisualStyle: (nodeElement: any, nodeId: string) => void;
  setNodeAsDragging: (nodeId: string) => void;
  organizeNodeZIndex: (immediate?: boolean) => void;
}

export interface NodeLayerUtils {
  getConfigurableDimensions: (n: any) => any;
  getArchitectureIconSvg: (type: string, size: number, color: string) => string;
  isServicesArchitectureNode: (node: any) => boolean;
  getPortHighlightClass: (nodeId: string, portId: string, portType: "input" | "output") => string;
  getConfigurablePortPositions: (node: WorkflowNode, portType: "input" | "output") => Array<{ x: number; y: number }>;
}

export interface NodeLayerRefs {
  draggedElementRef: React.MutableRefObject<d3.Selection<any, any, any, any> | null>;
  draggedNodeElementRef: React.MutableRefObject<SVGGElement | null>;
  allNodeElementsRef: React.MutableRefObject<Map<string, SVGGElement>>;
  dragStateCleanupRef: React.MutableRefObject<NodeJS.Timeout | null>;
  currentDragPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  connectionUpdateQueueRef: React.MutableRefObject<Set<string>>;
  visualUpdateQueueRef: React.MutableRefObject<Set<string>>;
}

// Consolidated props object
export type OptimizedNodeLayerProps = {
  config: NodeLayerConfig;
  callbacks: NodeLayerCallbacks;
  context: NodeLayerContext;
  visuals: NodeLayerVisuals;
  utils: NodeLayerUtils;
  refs: NodeLayerRefs;
};

function OptimizedNodeLayer({ config, callbacks, context, visuals, utils, refs }: OptimizedNodeLayerProps) {
  // Memoize the params object to prevent useNodeRendering re-execution
  const nodeRenderingParams = useMemo(() => ({
    svgRef: config.svgRef,
    nodes: config.nodes,
    connections: config.connections,
    isDragging: config.isDragging,
    designerMode: config.designerMode,
    isNodeSelected: callbacks.isNodeSelected,
    onNodeClick: callbacks.onNodeClick,
    onNodeDoubleClick: callbacks.onNodeDoubleClick,
    onNodeDrag: callbacks.onNodeDrag,
    onPortClick: callbacks.onPortClick,
    onPlusButtonClick: callbacks.onPlusButtonClick,
    onPortDragStart: callbacks.onPortDragStart,
    onPortDrag: callbacks.onPortDrag,
    onPortDragEnd: callbacks.onPortDragEnd,
    canDropOnNode: callbacks.canDropOnNode,
    isContextDragging: context.isContextDragging,
    getDraggedNodeId: context.getDraggedNodeId,
    startDragging: context.startDragging,
    updateDragPosition: context.updateDragPosition,
    endDragging: context.endDragging,
    setDropFeedback: visuals.setDropFeedback,
    applyDragVisualStyle: visuals.applyDragVisualStyle,
    updateDraggedNodePosition: visuals.updateDraggedNodePosition,
    resetNodeVisualStyle: visuals.resetNodeVisualStyle,
    setNodeAsDragging: visuals.setNodeAsDragging,
    organizeNodeZIndex: visuals.organizeNodeZIndex,
    getConfigurableDimensions: utils.getConfigurableDimensions,
    draggedElementRef: refs.draggedElementRef,
    draggedNodeElementRef: refs.draggedNodeElementRef,
    allNodeElementsRef: refs.allNodeElementsRef,
    dragStateCleanupRef: refs.dragStateCleanupRef,
    currentDragPositionsRef: refs.currentDragPositionsRef,
    connectionUpdateQueueRef: refs.connectionUpdateQueueRef,
    visualUpdateQueueRef: refs.visualUpdateQueueRef,
    getArchitectureIconSvg: utils.getArchitectureIconSvg,
    isServicesArchitectureNode: utils.isServicesArchitectureNode,
    getPortHighlightClass: utils.getPortHighlightClass,
    getConfigurablePortPositions: utils.getConfigurablePortPositions,
  }), [
    // Only depend on data that actually changes
    config.nodes,
    config.isDragging,
    config.designerMode,
    config.svgRef,
    config.connections,
    // Callback objects should be stable, but include them for exhaustive deps
    callbacks.canDropOnNode,
    callbacks.isNodeSelected,
    callbacks.onNodeClick,
    callbacks.onNodeDoubleClick,
    callbacks.onNodeDrag,
    callbacks.onPlusButtonClick,
    callbacks.onPortClick,
    callbacks.onPortDrag,
    callbacks.onPortDragEnd,
    callbacks.onPortDragStart,
    context.endDragging,
    context.getDraggedNodeId,
    context.isContextDragging,
    context.startDragging,
    context.updateDragPosition,
    visuals.applyDragVisualStyle,
    visuals.organizeNodeZIndex,
    visuals.resetNodeVisualStyle,
    visuals.setDropFeedback,
    visuals.setNodeAsDragging,
    visuals.updateDraggedNodePosition,
    utils.getArchitectureIconSvg,
    utils.getConfigurableDimensions,
    utils.getConfigurablePortPositions,
    utils.getPortHighlightClass,
    utils.isServicesArchitectureNode,
    refs.allNodeElementsRef,
    refs.connectionUpdateQueueRef,
    refs.currentDragPositionsRef,
    refs.dragStateCleanupRef,
    refs.draggedElementRef,
    refs.draggedNodeElementRef,
    refs.visualUpdateQueueRef,
  ]);

  useNodeRendering(nodeRenderingParams);
  return null;
}

// Shallow comparison helper for callback objects
function shallowEqual(obj1: any, obj2: any): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) {
    return false;
  }
  
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }
  
  return true;
}

export default React.memo(OptimizedNodeLayer, (prevProps, nextProps) => {
  // Essential config comparison
  const prevConfig = prevProps.config;
  const nextConfig = nextProps.config;
  
  if (
    prevConfig.nodes !== nextConfig.nodes ||
    prevConfig.connections !== nextConfig.connections ||
    prevConfig.isDragging !== nextConfig.isDragging ||
    prevConfig.designerMode !== nextConfig.designerMode ||
    prevConfig.svgRef !== nextConfig.svgRef
  ) {
    return false; // Re-render needed
  }
  
  // With stable callbacks, reference equality should work
  // But add fallback deep comparison for safety
  if (
    prevProps.callbacks !== nextProps.callbacks ||
    prevProps.context !== nextProps.context ||
    prevProps.visuals !== nextProps.visuals ||
    prevProps.utils !== nextProps.utils ||
    prevProps.refs !== nextProps.refs
  ) {
    // If references differ, do shallow comparison of callback properties
    const callbacksEqual = shallowEqual(prevProps.callbacks, nextProps.callbacks);
    const contextEqual = shallowEqual(prevProps.context, nextProps.context);
    const visualsEqual = shallowEqual(prevProps.visuals, nextProps.visuals);
    const utilsEqual = shallowEqual(prevProps.utils, nextProps.utils);
    
    return callbacksEqual && contextEqual && visualsEqual && utilsEqual;
  }
  
  return true; // No re-render needed
});