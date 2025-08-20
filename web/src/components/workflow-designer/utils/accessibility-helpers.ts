/**
 * Accessibility utilities for workflow canvas
 * Handles ARIA live regions, focus management, and keyboard navigation
 */
import * as d3 from 'd3';

// Lightweight ARIA live region for screen reader announcements
export const ensureLiveRegion = (): HTMLElement => {
    const id = 'workflow-aria-live';
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.style.position = 'absolute';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.margin = '-1px';
        el.style.border = '0';
        el.style.padding = '0';
        // Visually hidden styles
        el.style.whiteSpace = 'nowrap';
        el.style.clipPath = 'inset(50%)';
        el.style.overflow = 'hidden';
        document.body.appendChild(el);
    }
    return el;
};

export const announce = (message: string): void => {
    try {
        const el = ensureLiveRegion();
        // Clear then set to force announcement even when same text repeats
        el.textContent = '';
        setTimeout(() => {
            el.textContent = message;
        }, 0);
    } catch {
        // noop
    }
};

// Inject keyboard focus styles once for visible focus indication on ports
export const ensureFocusStyles = (): void => {
    try {
        const id = 'wf-port-focus-styles';
        if (document.getElementById(id)) {
            return;
        }
        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
      /* Visible focus ring for keyboard navigation on ports */
      .workflow-canvas .port-group:focus-visible .port-circle {
        stroke: #2196F3 !important;
        stroke-width: 3 !important;
      }
      .workflow-canvas .port-group:focus-visible .side-port-rect {
        stroke: #2196F3 !important;
        stroke-width: 2 !important;
      }
    `;
        document.head.appendChild(style);
    } catch {
        // noop
    }
};

// ---------- Roving Tabindex helpers ----------
const isArrowKey = (key: string) =>
    key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';

export function setupRovingTabIndex(svgSel: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
    const groups = svgSel.selectAll<SVGGElement, unknown>('g.port-group');
    groups.attr('tabindex', -1);
    const first = groups.nodes()[0];
    if (first) {
        d3.select(first).attr('tabindex', 0);
    }
}

function moveFocusBetweenPortGroups(
    svgSel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    current: SVGGElement,
    delta: 1 | -1
) {
    const groups = svgSel.selectAll<SVGGElement, unknown>('g.port-group').nodes();
    if (!groups.length) {
        return;
    }
    const idx = groups.indexOf(current);
    const nextIdx = (idx + delta + groups.length) % groups.length;
    const nextEl = groups[nextIdx];
    // Update roving tabindex
    groups.forEach((el) => d3.select(el).attr('tabindex', -1));
    d3.select(nextEl).attr('tabindex', 0);
    (nextEl as unknown as HTMLElement).focus();
}

export function attachRovingHandlers(svgSel: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
    svgSel
        .selectAll<SVGGElement, unknown>('g.port-group')
        .on('keydown.roving', function (this: SVGGElement, event: KeyboardEvent) {
            if (!isArrowKey(event.key)) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const delta: 1 | -1 = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
            moveFocusBetweenPortGroups(svgSel, this, delta);
        });
}
