import React from "react";
import type { Connection, WorkflowNode } from "../../types";
import { useConnectionRendering } from "../../hooks/useConnectionRendering";

export type ConnectionLayerProps = {
  svgRef: React.RefObject<SVGSVGElement>;
  connections: Connection[];
  designerMode?: "workflow" | "architecture";
  nodeMap: Map<string, WorkflowNode>;
  onConnectionClick: (connection: Connection) => void;
  getConnectionPath: (c: Connection) => string;
  getConnectionMarker: (c: Connection, state?: "default" | "hover" | "selected") => string;
  createFilledPolygonFromPath: (d: string) => string;
};

function ConnectionLayer(props: ConnectionLayerProps) {
  useConnectionRendering({
    svgRef: props.svgRef,
    connections: props.connections,
    getConnectionPath: (c) => props.getConnectionPath(c),
    getConnectionMarker: props.getConnectionMarker,
    designerMode: props.designerMode,
    nodeMap: props.nodeMap,
    onConnectionClick: (c) => props.onConnectionClick(c),
    createFilledPolygonFromPath: props.createFilledPolygonFromPath,
  });
  return null;
}

export default React.memo(ConnectionLayer);
