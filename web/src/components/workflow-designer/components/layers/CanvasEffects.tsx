/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from "react";
import * as d3 from "d3";
import type { Connection } from "../../types";

export type CanvasEffectsProps = {
  svgRef: React.RefObject<SVGSVGElement>;
  isInitialized: boolean;
  isDragging: boolean;
  selectedNodes: Set<string>;
  selectedConnectionId?: string;
  isNodeSelected: (nodeId: string) => boolean;
  getConnectionMarker: (c: Connection, state?: "default" | "hover" | "selected") => string;
};

function CanvasEffects({ svgRef, isInitialized, isDragging, selectedNodes, selectedConnectionId, isNodeSelected, getConnectionMarker }: CanvasEffectsProps) {
  useEffect(() => {
    if (!svgRef.current || !isInitialized) return;

    const svg = d3.select(svgRef.current);
    const mainNodeLayer = svg.select(".node-layer");
    const connectionLayer = svg.select(".connection-layer");

    // Update node visual states only
    mainNodeLayer.selectAll(".node").each(function (d: any) {
      const nodeElement = d3.select(this);
      const selected = isNodeSelected(d.id);
      const dragging = nodeElement.classed("dragging");
      const nodeBackground = nodeElement.select(".node-background");

      nodeElement.classed("selected", selected);

      if (!dragging) {
        if (selected) {
          nodeElement.style("filter", "drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))");
          nodeBackground.attr("stroke", "#2196F3").attr("stroke-width", 3);
        } else {
          nodeElement.style("filter", "none");
          // Stroke reset left to node utils in main component; keep simple here
        }
      }
    });

    // Update connection selection state only - don't touch hover state
    connectionLayer.selectAll(".connection").each(function (d: any) {
      const connectionGroup = d3.select(this as SVGGElement);
      const pathElement = connectionGroup.select(".connection-path");
      const isSelected = selectedConnectionId === d.id;
      const isCurrentlyHovered = connectionGroup.classed("connection-hover");

      connectionGroup.classed("connection-selected", isSelected);
      if (!isCurrentlyHovered) {
        if (isSelected) {
          pathElement
            .attr("stroke", "#2196F3")
            .attr("stroke-width", 3)
            .attr("marker-end", getConnectionMarker(d, "selected"));
        } else {
          pathElement
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("marker-end", getConnectionMarker(d, "default"));
        }
      }
    });
  }, [svgRef, isInitialized, isDragging, selectedNodes, selectedConnectionId, isNodeSelected, getConnectionMarker]);

  return null;
}

export default React.memo(CanvasEffects);
