# Connection Path & Multi-Connection Spec (Canonical)

This document is the single source of truth for connection path generation, preview behavior, multi-connection rules, rendering, and markers in both Workflow and Architecture modes. It consolidates and supersedes overlapping content from:

- 08-connection-path-system.md
- 08-multiple-connections-architecture-mode.md
- 08-multiple-connections.md

Keep this spec in sync with implementation under `web/src/components/workflow-designer/utils` and `components`.

## 1) Scope & Terminology

- Mode: `workflow` or `architecture` (a.k.a designer mode)
- Port sides: `top`, `right`, `bottom`, `left`
- Virtual side ports (architecture): `__side-top|right|bottom|left`
- Marker (arrowhead): size 10px, HALF_MARKER = 5

## 2) Functional Requirements (FR)

### FR-ARCH-ROUTING (Smart Orthogonal)

- Use `generateAdaptiveOrthogonalRoundedPathSmart(sourcePos, endPos, 16, opts)` for Architecture paths.
- `opts.clearance = 10`.
- Orientation overrides must match side:
  - top/bottom -> `vertical`
  - left/right -> `horizontal`
- Target-box may be passed to bias bends near the target.

### FR-ENDPOINT-ALIGNMENT (Edge/Port Centering)

- Left/Right sides: end.x = side edge center X; end.y = exact target port Y.
- Top/Bottom sides: if target is an actual bottom port (incl. `__side-bottom`), end.x = exact target port X, else end.x = side edge center X; end.y = top/bottom edge Y.
- Apply trimming after alignment with HALF_MARKER (see FR-TRIM).

### FR-TRIM (Side-Based Arrowhead Offset)

- Strictly side-based; never use approach vector:
  - Left → x − 5; Right → x + 5; Top → y − 5; Bottom → y + 5
- Ensures arrowheads never intrude into node frames.

### FR-PREVIEW (Parity With Final Path)

- `calculateConnectionPreviewPath` must use the same side/orientation/trim rules as the final path.
- Snap rules:
  - If `hoverTargetBox`: choose side via `chooseAutoTargetSide` except for bottom-source proximity where top/bottom is chosen via threshold (`2 * FIXED_LEAD_LENGTH`).
  - Else: `findNearbySnapTargets` chooses the optimal side based on approach vector and distance.
  - Fallback: grid snap to 20px.
- U-shape previews follow FR-U-SHAPE.

### FR-U-SHAPE (Clarity for Tight Layouts)

- Bottom→Bottom: route below both nodes. MidY = max(bottom of src/tgt boxes + 16, minBelow).
- Short horizontal (left or right source): keep termination on same side, route around outer side using a midX beyond both boxes by at least 16px and `FIXED_LEAD_LENGTH`.
- In both cases, trim end with FR-TRIM.

### FR-MULTI-CONNECTIONS (Architecture)

- Validation:
  - Workflow: single input per port; prevent exact duplicates; prevent cycles.
  - Architecture: allow multiple inputs; prevent only exact duplicates; special port rules may relax further.
- Grouping:
  - Group key includes node pair AND port pair using `generateConnectionGroupKey`.
  - `analyzeConnectionGroups` provides `{ index, total }` for each connection.
- Rendering:
  - In Architecture mode, only show the primary (index 0) connection from a group; apply `.connection-multi` to all in group and `.connection-multi-primary` to index 0.
  - Primary connection may display a label (e.g., `"2 connections"`).

### FR-RENDERING (D3 DOM Contract)

- `connection-dom.ts` responsibilities:
  - Use an invisible hitbox (thickness ≈ 8) for interaction; visible path for stroke.
  - Hide non-primary paths in Architecture when in a grouped set.
  - Path d attribute comes from `getConnectionPath` (single source of truth).
  - Arrow marker id comes from `getConnectionMarker(connection, state)`.
  - Label placement: in Architecture mode, at the actual path midpoint when possible; fallback to midpoint between node centers.

### FR-EVENTS (Drag End Contract)

- Drag-end from all sources must pass either:
  - Target node/port IDs, or
  - Sentinel `__CANVAS_DROP__` with `canvasX, canvasY` so the handler can create a new node and connect.

### FR-MARKERS

- Marker size = 10px; refX set so tip aligns with end point.
- All trimming uses HALF_MARKER = 5, in pixels.

### FR-DIMENSIONS (Mode-Aware)

- Architecture node size: 56 × 56 (must match `WorkflowCanvas` and `getModeAwareDimensions`).
- Bottom port horizontal distribution:
  - 1: centered
  - 2: at ±(usableWidth/3)
  - 3: at ±(usableWidth/2) and 0
  - 4+: even spacing across `usableWidth = min(width*0.8, width-70)`

### FR-CACHING

- Path cache keys include mode, source/target node and port IDs.
- Node invalidation should remove only paths touching the node.

## 3) Non-Functional Requirements (NFR)

- Performance: batch DOM updates; reuse caches; avoid path regeneration on every render; smooth drag at 60fps.
- Maintainability: single trim helper used by preview and final; shared side/orientation mapping; mode-aware dimension helpers.
- Testability: unit tests for alignment/trim, U-shape path generation, snap selection; integration tests for drag-end sentinel.

## 4) API Contracts (TS)

### calculateConnectionPreviewPath

- Input: `(sourceNode, sourcePortId, previewPosition, { modeId, variant, config, hoverTargetBox, availableNodes })`
- Output: `string` (SVG path)
- Rules: Apply FR-PREVIEW; use FR-TRIM; honor U-shape specials.

### generateModeAwareConnectionPath

- Input: `(connection, nodes, variant, modeId, config)`
- Output: `string`
- Rules: `architecture` → use smart orth router with FR-ENDPOINT-ALIGNMENT and FR-TRIM; `workflow` → Bézier.

### generateMultipleConnectionPath

- Input: `{ sourceNode, sourcePortId, targetNode, targetPortId, connectionIndex, totalConnections, variant, mode }`
- Output: `string`
- Rules: If `mode === 'architecture'` defer to Architecture mode path (bundled). Else offset curves per connection index.

### analyzeConnectionGroups / getConnectionGroupInfo

- Group key: `source:srcPort->target:tgtPort` (ports are part of the key).
- `getConnectionGroupInfo` returns `{ index, total, isMultiple }`.

## 5) CSS & Markers

- Classes:
  - `.connection-multi`, `.connection-multi-primary` on group members.
  - Label `.connection-label` only on primary.
- Marker configuration must match HALF_MARKER = 5 (tip at end point).

## 6) Migration & File Merge Plan

- Keep this file as the canonical spec.
- Option A (recommended):
  - Add a banner at the top of `08-connection-path-system.md`, `08-multiple-connections-architecture-mode.md`, and `08-multiple-connections.md` linking to this spec.
  - Over time, reduce duplicate sections in those docs and keep only usage guides and examples.
- Option B:
  - Physically merge content into this file and delete the older ones from the docs nav.
- Update any sidebar/navigation to point to this spec as the primary reference.

## 7) Acceptance Criteria (Quick Checklist)

- Arrowheads never enter nodes on left/right/top/bottom.
- Top/bottom endpoints are centered unless the true target is a bottom port.
- Preview path visually matches final path including trims and U-shapes.
- Architecture multi-connections show only a single primary path with a count label.
- Drag-end never logs "Missing target information" (always target or `__CANVAS_DROP__`).
- No TypeScript errors; lint passes for modified files.
