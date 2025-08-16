/**
 * Canvas performance and grid constants
 * Centralized configuration for WorkflowCanvas component
 */

// Performance and caching constants
export const PERFORMANCE_CONSTANTS = {
  MAX_CACHE_SIZE: 1000,
  CACHE_CLEANUP_THRESHOLD: 1200,
  GRID_CACHE_DURATION: 30000, // 30 seconds
  CACHE_AGE_LIMIT: 1000, // 1 second
  CLEANUP_INTERVAL: 30000, // 30 seconds
  RAF_THROTTLE_INTERVAL: 16, // ~60fps
} as const;

// Grid rendering constants
export const GRID_CONSTANTS = {
  BASE_GRID_SIZE: 20,
  GRID_CACHE_TOLERANCE: 100, // pixels
  VIEWPORT_CACHE_TOLERANCE: 400, // pixels
  VIEWPORT_HEIGHT_TOLERANCE: 500, // pixels
  CACHE_HIT_LOG_INTERVAL: 100,
  PERFORMANCE_LOG_INTERVAL: 100,
  PERFORMANCE_WARNING_INTERVAL: 50,
} as const;

// Type aliases for better maintainability
export type CallbackPriority = "high" | "normal" | "low";
export type NodeZIndexState = "normal" | "selected" | "dragging";

// RAF priority configuration
export const RAF_PRIORITY_CONFIG = {
  HIGH_PRIORITY_LIMIT: 3,
  OTHER_PRIORITY_LIMIT: 2,
  PRIORITIES: { high: 3, normal: 2, low: 1 } as const,
} as const;

// Cache size limits
export const CACHE_LIMITS = {
  CONNECTION_PATH_CACHE: PERFORMANCE_CONSTANTS.MAX_CACHE_SIZE,
  NODE_POSITION_CACHE: PERFORMANCE_CONSTANTS.MAX_CACHE_SIZE,
  D3_SELECTION_CACHE_TTL: PERFORMANCE_CONSTANTS.CACHE_AGE_LIMIT,
  GRID_CACHE_TTL: PERFORMANCE_CONSTANTS.GRID_CACHE_DURATION,
} as const;