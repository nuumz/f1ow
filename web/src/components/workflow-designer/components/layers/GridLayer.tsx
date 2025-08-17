import React from "react";
import type * as d3 from "d3";
import { useGridEffect } from "../../hooks/useGridEffect";

type GridLayerProps = {
  svgRef: React.RefObject<SVGSVGElement>;
  isInitialized: boolean;
  showGrid: boolean;
  gridCacheRef: React.MutableRefObject<{ lastRenderTime: number; key?: string } | null>;
  createGrid: (
    gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    width: number,
    height: number
  ) => void;
};

function GridLayer({ svgRef, isInitialized, showGrid, createGrid, gridCacheRef }: GridLayerProps) {
  useGridEffect({ svgRef, isInitialized, showGrid, createGrid, gridCacheRef });
  return null;
}

export default React.memo(GridLayer);
