# U-Shape Routing Guide

This document explains all U-shape connection routing behaviors implemented in the workflow designer, for both final (architecture mode) rendering and preview, including triggers, endpoints, and tunables. Use this as a reference for maintenance and future improvements.

## Where the logic lives

- File: `web/src/components/workflow-designer/utils/connection-utils.ts`
- Final (architecture mode): `generateArchitectureModeConnectionPath(...)`
- Preview: `calculateConnectionPreviewPath(...)`
- Dependencies/helpers:
  - `FIXED_LEAD_LENGTH` (from `path-generation.ts`) – default 50px
  - `buildNodeBox` / `buildNodeBoxModeAware`
  - `detectPortSideModeAware`, `getVirtualSidePortPositionForMode`
  - Fallback path generators: `generateAdaptiveOrthogonalRoundedPathSmart`, `generateConnectionPath`, `generatePreviewPath`

## Terminology

- "Same-side port": The target node port on the same side as the source’s starting side (e.g., start from right ⇒ end at target right port).
- `safeClear`: Horizontal clearance beyond the outer edge of node boxes to draw the U loop without overlapping node frames.

## Summary of U-shape variants

### 1) Bottom-to-Bottom U-shape (existing baseline)

- Applies when: A bottom→bottom connection would overlap or lacks vertical room, so a U path is drawn to avoid collision.
- Endpoint policy: Ends at target bottom port (same side by orientation: bottom).
- Clearance:
  - Final: `safeClear = 16`
  - Preview: `safeClear = 16` (unified)
- Notes: Maintains minimum vertical lead segments; used historically to avoid bottom-overlap artifacts.

### 2) Horizontal U-shape — Start RIGHT ⇒ End RIGHT (same-side)

- Trigger (final): Only when target is horizontally close:
  - `(targetNode.x - sourcePos.x) < FIXED_LEAD_LENGTH`
- Trigger (preview): CenterX-based proximity:
  - `(tgtCenterX - sourcePos.x) < FIXED_LEAD_LENGTH`
- Pathing strategy: Route around the outer right side using a midX beyond both nodes’ rightmost edges with `safeClear`.
- Endpoint policy: Force terminate at target right port (final) / right-edge center (preview) to avoid side flip.
- Clearance:
  - Final: `safeClear = 16`
  - Preview: `safeClear = 16` (unified)

### 3) Horizontal U-shape — Start LEFT ⇒ End LEFT (same-side)

- Trigger (final): Only when target is horizontally close:
  - `(sourcePos.x - targetNode.x) < FIXED_LEAD_LENGTH`
- Trigger (preview): CenterX-based proximity:
  - `(sourcePos.x - tgtCenterX) < FIXED_LEAD_LENGTH`
- Pathing strategy: Route around the outer left side using a midX beyond both nodes’ leftmost edges with `safeClear`.
- Endpoint policy: Force terminate at target left port (final) / left-edge center (preview) to avoid side flip.
- Clearance:
  - Final: `safeClear = 16`
  - Preview: `safeClear = 16` (unified)

## Fallback behavior

If none of the U-shape triggers match, the system uses the adaptive orthogonal router:

- Final (architecture mode): `generateAdaptiveOrthogonalRoundedPathSmart`
- Preview (architecture mode): `generateAdaptiveOrthogonalRoundedPathSmart`
- Preview (workflow mode): `generatePreviewPath`

## Rationale & design notes

- U-shapes are limited to “close horizontal” layouts to prevent accidental side-flips and to keep lines visually tidy.
- Preview mirrors final behavior to reduce surprise when dropping a connection.
- Same-side endpoint policy ensures the arrow head consistently lands where users expect during short horizontal drags.

## Tunables & constants

- `FIXED_LEAD_LENGTH` (default 50): Minimum straight segment used when computing the U’s horizontal legs and proximity threshold.
- `safeClear`: unified to `16` across preview and final for all U-shape variants.
- `HALF_MARKER` (≈ 5.5): arrowhead outward trimming amount applied to final segments so arrowheads do not enter target nodes.

### Arrowhead trimming (new)

- Both preview and final trim the endpoint “outward” from the node by ~5.5px depending on the chosen side:
  - Left: x + 5.5, Right: x - 5.5, Top: y + 5.5, Bottom: y - 5.5.
- Bottom U-shape: trim is applied on the final upward segment so the arrowhead stays clear of the node frame.

## Known inconsistencies / improvement backlog

1. Obstacle awareness: account for intermediate nodes/labels when choosing midX; consider simple occupancy checks.
2. Configurability: expose `FIXED_LEAD_LENGTH`, `safeClear`, and `HALF_MARKER` via theme/config for per-tenant tuning.
3. Tests: add unit tests for each U-shape trigger and path shape (happy path + edge thresholds near `< FIXED_LEAD_LENGTH`).
4. Preview smoothing: ensure exact parity of rounding radius and trimming in rare edge layouts.

## Quick reference (pseudo-conditions)

- Start RIGHT → Same-side U:
  - Final: if `(target.x - source.x) < FIXED_LEAD_LENGTH` ⇒ route right-outer, end at target RIGHT.
  - Preview: if `(tgtCenterX - source.x) < FIXED_LEAD_LENGTH` ⇒ route right-outer, end at right-edge center.
- Start LEFT → Same-side U:
  - Final: if `(source.x - target.x) < FIXED_LEAD_LENGTH` ⇒ route left-outer, end at target LEFT.
  - Preview: if `(source.x - tgtCenterX) < FIXED_LEAD_LENGTH` ⇒ route left-outer, end at left-edge center.
- Bottom-to-Bottom U:
  - Apply when bottom overlap/clearance issues are detected; end at bottom; higher preview `safeClear`.

## Edit pointers

- Horizontal U (final): search for `startSide === 'right'` / `startSide === 'left'` U-shape blocks in `generateArchitectureModeConnectionPath`.
- Horizontal U (preview): search for `startSidePrev === 'right'` / `startSidePrev === 'left'` in `calculateConnectionPreviewPath`.
- Bottom U: dedicated block within both functions; look for comments mentioning bottom U-shape or vertical clearance.

## Compatibility

- Changes preserve existing APIs. Only routing heuristics are adjusted. Non-U cases continue to use the adaptive orthogonal router.
