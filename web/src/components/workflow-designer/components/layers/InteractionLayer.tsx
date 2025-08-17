/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from "react";

export type InteractionLayerProps = {
  svgRef: React.RefObject<SVGSVGElement>;
  onCanvasClick?: (e: any) => void;
  onCanvasMouseMove?: (x: number, y: number) => void;
  registerEventCleanup: (cleanup: () => void) => void;
};

function InteractionLayer({ svgRef, onCanvasClick, onCanvasMouseMove, registerEventCleanup }: InteractionLayerProps) {
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const controller = new AbortController();
    const { signal } = controller;
    const clickHandler = (e: Event) => {
      (onCanvasClick as unknown as (e: Event) => void | undefined)?.(e);
    };
    const moveHandler = (e: Event) => {
      if (!onCanvasMouseMove) return;
      const evt = e as MouseEvent;
      const svg = svgEl;
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const inv = ctm.inverse();
      const loc = pt.matrixTransform(inv);
      onCanvasMouseMove(loc.x, loc.y);
    };
    if (onCanvasClick) svgEl.addEventListener("click", clickHandler, { signal });
    if (onCanvasMouseMove) svgEl.addEventListener("mousemove", moveHandler, { signal });
    registerEventCleanup(() => controller.abort());
    return () => {
      controller.abort();
    };
  }, [svgRef, onCanvasClick, onCanvasMouseMove, registerEventCleanup]);
  return null;
}

export default React.memo(InteractionLayer);
