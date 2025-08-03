/**
 * Production Connection Configuration
 * 
 * Centralized configuration for the enhanced connection system
 * with environment-specific optimizations
 */

import type { ProductionConnectionConfig } from './enhanced-connection-production'

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

/**
 * Default production configuration optimized for performance
 */
export const PRODUCTION_CONFIG: ProductionConnectionConfig = {
  enableSmoothing: true,
  enableAnimation: !isProduction, // Disable animations in production for better performance
  enableHoverEffects: true,
  enableCaching: true,
  maxCacheSize: isProduction ? 500 : 1000, // Smaller cache in production
  enableDebugMode: isDevelopment
}

/**
 * High-performance configuration for dense workflows (1000+ connections)
 */
export const HIGH_PERFORMANCE_CONFIG: ProductionConnectionConfig = {
  enableSmoothing: false, // Disable for maximum performance
  enableAnimation: false,
  enableHoverEffects: false,
  enableCaching: true,
  maxCacheSize: 200, // Very small cache for memory efficiency
  enableDebugMode: false
}

/**
 * Enhanced visual configuration for demos and presentations
 */
export const ENHANCED_VISUAL_CONFIG: ProductionConnectionConfig = {
  enableSmoothing: true,
  enableAnimation: true,
  enableHoverEffects: true,
  enableCaching: true,
  maxCacheSize: 2000,
  enableDebugMode: isDevelopment
}

/**
 * Mobile-optimized configuration
 */
export const MOBILE_CONFIG: ProductionConnectionConfig = {
  enableSmoothing: false, // Disable for touch performance
  enableAnimation: false,
  enableHoverEffects: false, // No hover on mobile
  enableCaching: true,
  maxCacheSize: 100, // Very small cache for mobile memory constraints
  enableDebugMode: false
}

/**
 * Get optimal configuration based on context
 */
export function getOptimalConfig(context: {
  nodeCount: number
  connectionCount: number
  isMobile?: boolean
  isArchitectureMode?: boolean
}): ProductionConnectionConfig {
  const { nodeCount, connectionCount, isMobile, isArchitectureMode } = context

  // Mobile optimization
  if (isMobile) {
    return MOBILE_CONFIG
  }

  // High-density workflow optimization
  if (nodeCount > 100 || connectionCount > 500) {
    return HIGH_PERFORMANCE_CONFIG
  }

  // Architecture mode optimization (many connections)
  if (isArchitectureMode && connectionCount > 100) {
    return {
      ...PRODUCTION_CONFIG,
      enableAnimation: false, // Disable animations in complex architecture views
      maxCacheSize: 1000
    }
  }

  // Standard production configuration
  return PRODUCTION_CONFIG
}

/**
 * Performance monitoring thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  // Cache performance
  MAX_CACHE_SIZE: 1000,
  CACHE_CLEANUP_THRESHOLD: 800,
  
  // Rendering performance
  MAX_RENDER_TIME_MS: 16, // 60fps target
  HIGH_DENSITY_NODE_COUNT: 100,
  HIGH_DENSITY_CONNECTION_COUNT: 500,
  
  // Memory management
  MEMORY_CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_MEMORY_USAGE_MB: 50
}

/**
 * Feature flags for gradual rollout
 */
export const FEATURE_FLAGS = {
  ENABLE_ENHANCED_CONNECTIONS: true,
  ENABLE_SMOOTH_CURVES: true,
  ENABLE_ANIMATIONS: !isProduction,
  ENABLE_PERFORMANCE_MONITORING: isDevelopment,
  ENABLE_FALLBACK_SYSTEM: true
}

export type ConnectionContextType = 'standard' | 'architecture' | 'mobile' | 'demo'

/**
 * Get configuration for specific context type
 */
export function getContextualConfig(contextType: ConnectionContextType): ProductionConnectionConfig {
  switch (contextType) {
    case 'architecture':
      return {
        ...PRODUCTION_CONFIG,
        enableAnimation: false,
        maxCacheSize: 1000
      }
    
    case 'mobile':
      return MOBILE_CONFIG
    
    case 'demo':
      return ENHANCED_VISUAL_CONFIG
    
    default:
      return PRODUCTION_CONFIG
  }
}