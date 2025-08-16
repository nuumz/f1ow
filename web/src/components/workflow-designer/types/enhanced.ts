/**
 * Enhanced type definitions for the refactored WorkflowCanvas architecture
 * Provides strict typing and eliminates 'any' types for better type safety
 */

import type { WorkflowNode, Connection, NodeVariant, CanvasTransform, NodePort } from './index';
import * as d3 from 'd3';

// Enhanced D3 selection types for type safety
export type D3Element = SVGElement | HTMLElement;
export type D3Selection<T extends D3Element = SVGElement> = d3.Selection<T, unknown, null, undefined>;
export type D3NodeSelection = d3.Selection<SVGGElement, WorkflowNode, SVGGElement, unknown>;
export type D3ConnectionSelection = d3.Selection<SVGPathElement, Connection, SVGGElement, unknown>;
export type D3PortSelection = d3.Selection<SVGCircleElement, NodePort & { nodeId: string }, SVGGElement, unknown>;

// Event handler type definitions
export interface MouseEventHandler<T = unknown> {
  (event: MouseEvent, data: T): void;
}

export interface DragEventHandler<T = unknown> {
  (event: d3.D3DragEvent<Element, T, T>, data: T): void;
}

// Enhanced rendering configuration
export interface RenderingConfiguration {
  readonly variant: NodeVariant;
  readonly showGrid: boolean;
  readonly showPorts: boolean;
  readonly showLabels: boolean;
  readonly showIcons: boolean;
  readonly showStatus: boolean;
  readonly showAnimations: boolean;
  readonly gridSize: number;
  readonly designerMode: 'workflow' | 'architecture';
  readonly enableCaching: boolean;
  readonly enablePerformanceMonitoring: boolean;
}

// Canvas bounds interface
export interface CanvasBounds {
  readonly width: number;
  readonly height: number;
}

// Enhanced node dimensions interface
export interface NodeDimensions {
  readonly width: number;
  readonly height: number;
  readonly portRadius: number;
  readonly iconSize: number;
  readonly fontSize: number;
  readonly iconOffset: { x: number; y: number };
  readonly labelOffset: { x: number; y: number };
}

// Enhanced port position interface
export interface PortPosition {
  readonly x: number;
  readonly y: number;
  readonly type: 'input' | 'output' | 'bottom' | 'side';
  readonly index: number;
}

// Connection path cache key interface
export interface ConnectionPathKey {
  readonly connectionId: string;
  readonly sourceNodeId: string;
  readonly sourcePortId: string;
  readonly targetNodeId: string;
  readonly targetPortId: string;
  readonly variant: NodeVariant;
  readonly mode: 'workflow' | 'architecture';
  readonly isDragging: boolean;
}

// Performance metrics interface
export interface PerformanceMetrics {
  readonly renderCount: number;
  readonly averageRenderTime: number;
  readonly peakRenderTime: number;
  readonly cacheHitRate: number;
  readonly memoryUsage: number;
  readonly lastRenderTime: number;
}

// Error handling interfaces
export interface RenderingError {
  readonly type: 'cache' | 'rendering' | 'event' | 'performance';
  readonly message: string;
  readonly context: Record<string, unknown>;
  readonly timestamp: number;
}

// Validation result interface
export interface ValidationResult<T = unknown> {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly data?: T;
}

// Enhanced event interfaces
export interface NodeEventData {
  readonly node: WorkflowNode;
  readonly position: { x: number; y: number };
  readonly isSelected: boolean;
  readonly isDragging: boolean;
}

export interface PortEventData {
  readonly nodeId: string;
  readonly portId: string;
  readonly portType: 'input' | 'output';
  readonly position: { x: number; y: number };
  readonly canConnect: boolean;
}

export interface ConnectionEventData {
  readonly connection: Connection;
  readonly isSelected: boolean;
  readonly path: string;
}

// Rendering strategy interfaces
export interface RenderingStrategy {
  readonly name: string;
  readonly canHandle: (context: RenderingContext) => boolean;
  readonly render: (context: RenderingContext) => void;
  readonly cleanup?: () => void;
}

export interface RenderingContext {
  readonly svgRef: React.RefObject<SVGSVGElement>;
  readonly nodes: readonly WorkflowNode[];
  readonly connections: readonly Connection[];
  readonly config: RenderingConfiguration;
  readonly transform: CanvasTransform;
  readonly bounds: CanvasBounds;
}

// Cache interfaces
export interface CacheEntry<T = unknown> {
  readonly value: T;
  readonly timestamp: number;
  readonly accessCount: number;
  readonly lastAccess: number;
  readonly size: number;
}

export interface CacheStatistics {
  readonly hitCount: number;
  readonly missCount: number;
  readonly hitRate: number;
  readonly totalSize: number;
  readonly entryCount: number;
  readonly averageEntrySize: number;
}

// Interaction interfaces
export interface InteractionHandler<T = MouseEvent> {
  readonly type: string;
  readonly handler: (event: T, context: InteractionContext) => void;
  readonly priority: number;
  readonly canHandle: (event: T, context: InteractionContext) => boolean;
}

export interface InteractionContext {
  readonly element: Element;
  readonly data: unknown;
  readonly transform: CanvasTransform;
  readonly bounds: CanvasBounds;
}

// Service interfaces
export interface RenderingService {
  readonly initialize: (config: RenderingConfiguration) => Promise<void>;
  readonly render: (context: RenderingContext) => Promise<void>;
  readonly cleanup: () => Promise<void>;
  readonly getMetrics: () => PerformanceMetrics;
}

export interface CacheService<T = unknown> {
  readonly get: (key: string) => T | undefined;
  readonly set: (key: string, value: T) => void;
  readonly delete: (key: string) => boolean;
  readonly clear: () => void;
  readonly getStatistics: () => CacheStatistics;
}

// Hook return types
export interface RenderingHookReturn {
  readonly renderingEngine: unknown;
  readonly renderingState: {
    readonly isInitialized: boolean;
    readonly isRendering: boolean;
    readonly lastRenderTime: number;
    readonly renderCount: number;
  };
  readonly forceRender: () => void;
  readonly invalidateCache: () => void;
  readonly getPerformanceReport: () => PerformanceMetrics | null;
  readonly cleanup: () => void;
}

export interface InteractionHookReturn {
  readonly interactionState: {
    readonly isDragging: boolean;
    readonly isConnecting: boolean;
    readonly isPanning: boolean;
    readonly isSelecting: boolean;
  };
  readonly zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null;
  readonly getWorldPosition: (screenX: number, screenY: number) => { x: number; y: number };
  readonly getScreenPosition: (worldX: number, worldY: number) => { x: number; y: number };
  readonly enableInteractions: () => void;
  readonly disableInteractions: () => void;
  readonly cleanup: () => void;
}

// Component props interfaces
export interface BaseComponentProps {
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly testId?: string;
}

export interface RenderingComponentProps extends BaseComponentProps {
  readonly renderingEngine: unknown;
  readonly config: RenderingConfiguration;
}

// Type guards
export function isValidNode(node: unknown): node is WorkflowNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'id' in node &&
    'type' in node &&
    'x' in node &&
    'y' in node &&
    'inputs' in node &&
    'outputs' in node
  );
}

export function isValidConnection(connection: unknown): connection is Connection {
  return (
    typeof connection === 'object' &&
    connection !== null &&
    'id' in connection &&
    'sourceNodeId' in connection &&
    'sourcePortId' in connection &&
    'targetNodeId' in connection &&
    'targetPortId' in connection
  );
}

export function isValidCanvasTransform(transform: unknown): transform is CanvasTransform {
  return (
    typeof transform === 'object' &&
    transform !== null &&
    'x' in transform &&
    'y' in transform &&
    'k' in transform &&
    typeof (transform as CanvasTransform).x === 'number' &&
    typeof (transform as CanvasTransform).y === 'number' &&
    typeof (transform as CanvasTransform).k === 'number'
  );
}

// Utility types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T[P] extends Record<string, unknown>
    ? DeepReadonly<T[P]>
    : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// Configuration validation
export interface ConfigurationValidator {
  readonly validate: (config: unknown) => ValidationResult<RenderingConfiguration>;
  readonly getDefaults: () => RenderingConfiguration;
  readonly merge: (base: RenderingConfiguration, override: Partial<RenderingConfiguration>) => RenderingConfiguration;
}

// Factory interfaces
export interface ComponentFactory {
  readonly createNodeRenderer: (props: RenderingComponentProps) => React.ComponentType;
  readonly createConnectionRenderer: (props: RenderingComponentProps) => React.ComponentType;
  readonly createGridRenderer: (props: RenderingComponentProps) => React.ComponentType;
}

export interface ServiceFactory {
  readonly createRenderingService: (config: RenderingConfiguration) => RenderingService;
  readonly createCacheService: <T>() => CacheService<T>;
  readonly createPerformanceService: () => unknown;
}

// Export all from base types for convenience
export * from './index';