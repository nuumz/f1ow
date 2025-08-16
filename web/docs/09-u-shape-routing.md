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
  - Preview: `safeClear = 50`
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
  - Preview: `safeClear = 50`

### 3) Horizontal U-shape — Start LEFT ⇒ End LEFT (same-side)
- Trigger (final): Only when target is horizontally close:
  - `(sourcePos.x - targetNode.x) < FIXED_LEAD_LENGTH`
- Trigger (preview): CenterX-based proximity:
  - `(sourcePos.x - tgtCenterX) < FIXED_LEAD_LENGTH`
- Pathing strategy: Route around the outer left side using a midX beyond both nodes’ leftmost edges with `safeClear`.
- Endpoint policy: Force terminate at target left port (final) / left-edge center (preview) to avoid side flip.
- Clearance:
  - Final: `safeClear = 16`
  - Preview: `safeClear = 16`

## Fallback behavior
If none of the U-shape triggers match, the system uses the adaptive orthogonal router:
- Final: `generateAdaptiveOrthogonalRoundedPathSmart`
- Preview: `generatePreviewPath` / `generateConnectionPath`

## Rationale & design notes
- U-shapes are limited to “close horizontal” layouts to prevent accidental side-flips and to keep lines visually tidy.
- Preview mirrors final behavior to reduce surprise when dropping a connection.
- Same-side endpoint policy ensures the arrow head consistently lands where users expect during short horizontal drags.

## Tunables & constants
- `FIXED_LEAD_LENGTH` (default 50): Minimum straight segment used when computing the U’s horizontal legs and proximity threshold.
- `safeClear`:
  - Final: 16
  - Preview: currently 50 (RIGHT-start) and 16 (LEFT-start) for horizontal U; 50 for bottom U.

## Known inconsistencies / improvement backlog
1. Unify `safeClear` between preview and final, and across LEFT/RIGHT cases for consistent visual spacing.
2. Arrow marker clearance: add a few extra pixels at the very end segment to ensure arrowheads don’t touch node frames.
3. Obstacle awareness: account for intermediate nodes/labels when choosing midX; consider simple occupancy checks.
4. Configurability: expose `FIXED_LEAD_LENGTH` and `safeClear` via theme/config for per-tenant tuning.
5. Tests: add unit tests for each U-shape trigger and path shape (happy path + edge thresholds near `< FIXED_LEAD_LENGTH`).
6. Preview smoothing: match the exact `safeClear` and rounding radius in final to eliminate "snap" differences at drop time.

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

