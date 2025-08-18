/**
 * Grid Performance Monitoring and Optimization Utilities
 * 
 * ฟังก์ชันสำหรับ monitor และ optimize grid performance
 * ป้องกัน grid กระพริบและปรับปรุง performance ระหว่าง drag operations
 */

export interface GridPerformanceMetrics {
  totalRenderTime: number;
  renderCount: number;
  cacheHits: number;
  cacheMisses: number;
  lastFrameTime: number;
  avgRenderTime: number;
  cacheHitRate: number;
}

export interface GridCacheInfo {
  transform: string;
  pattern: string;
  lastRenderTime: number;
  viewport: { width: number; height: number };
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export class GridPerformanceMonitor {
  private metrics: GridPerformanceMetrics = {
    totalRenderTime: 0,
    renderCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastFrameTime: 0,
    avgRenderTime: 0,
    cacheHitRate: 0
  };
  private readonly CACHE_DURATION = 5000; // 5 seconds
  private readonly PERFORMANCE_THRESHOLD = 15; // ms
  private readonly GOOD_CACHE_HIT_RATE = 70; // %

  constructor() {
    this.resetMetrics();
  }

  resetMetrics(): void {
    this.metrics = {
      totalRenderTime: 0,
      renderCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastFrameTime: performance.now(),
      avgRenderTime: 0,
      cacheHitRate: 0
    };
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
    this.updateDerivedMetrics();
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
    this.updateDerivedMetrics();
  }

  recordRender(renderTime: number): void {
    this.metrics.renderCount++;
    this.metrics.totalRenderTime += renderTime;
    this.metrics.lastFrameTime = performance.now();
    this.updateDerivedMetrics();
  }

  private updateDerivedMetrics(): void {
    if (this.metrics.renderCount > 0) {
      this.metrics.avgRenderTime = this.metrics.totalRenderTime / this.metrics.renderCount;
    }

    const totalAttempts = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (totalAttempts > 0) {
      this.metrics.cacheHitRate = (this.metrics.cacheHits / totalAttempts) * 100;
    }
  }

  getMetrics(): GridPerformanceMetrics {
    return { ...this.metrics };
  }

  getPerformanceReport(): {
    status: 'excellent' | 'good' | 'warning' | 'poor';
    summary: string;
    recommendations: string[];
  } {
    const { avgRenderTime, cacheHitRate, renderCount } = this.metrics;

    let status: 'excellent' | 'good' | 'warning' | 'poor';
    const recommendations: string[] = [];

    // Determine performance status
    if (avgRenderTime < 5 && cacheHitRate > 90) {
      status = 'excellent';
    } else if (avgRenderTime < 10 && cacheHitRate > this.GOOD_CACHE_HIT_RATE) {
      status = 'good';
    } else if (avgRenderTime < this.PERFORMANCE_THRESHOLD || cacheHitRate > 50) {
      status = 'warning';
    } else {
      status = 'poor';
    }

    // Generate recommendations
    if (avgRenderTime > this.PERFORMANCE_THRESHOLD) {
      recommendations.push('Consider reducing grid density or viewport size');
      recommendations.push('Check for excessive DOM manipulations during grid updates');
    }

    if (cacheHitRate < this.GOOD_CACHE_HIT_RATE && renderCount > 10) {
      recommendations.push('Adjust cache tolerance or transform rounding for better cache efficiency');
      recommendations.push('Consider increasing cache duration for stable transforms');
    }

    if (renderCount > 100 && avgRenderTime > 8) {
      recommendations.push('Implement grid virtualization for large canvases');
      recommendations.push('Consider using WebGL for high-performance grid rendering');
    }

    const summary = `Performance: ${status.toUpperCase()} | Avg Render: ${avgRenderTime.toFixed(2)}ms | Cache Hit Rate: ${cacheHitRate.toFixed(1)}%`;

    return { status, summary, recommendations };
  }

  shouldLogPerformance(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  isCacheExpired(cache: GridCacheInfo | null): boolean {
    if (!cache) {return true;}
    return (performance.now() - cache.lastRenderTime) > this.CACHE_DURATION;
  }

  generateCacheKey(
    transform: { x: number; y: number; k: number },
    viewport: { width: number; height: number },
    tolerance: { position: number; zoom: number; viewport: number } = { position: 10, zoom: 50, viewport: 100 }
  ): string {
    const roundedTransform = {
      x: Math.round(transform.x / tolerance.position) * tolerance.position,
      y: Math.round(transform.y / tolerance.position) * tolerance.position,
      k: Math.round(transform.k * tolerance.zoom) / tolerance.zoom
    };

    const transformString = `${roundedTransform.x},${roundedTransform.y},${roundedTransform.k}`;
    const viewportString = `${Math.round(viewport.width / tolerance.viewport) * tolerance.viewport}x${Math.round(viewport.height / tolerance.viewport) * tolerance.viewport}`;

    return `${transformString}:${viewportString}`;
  }

  validateCacheConsistency(
    cache: GridCacheInfo,
    _currentTransform: { x: number; y: number; k: number },
    currentViewport: { width: number; height: number }
  ): boolean {
    if (!cache) {return false;}

    // Check if viewport dimensions haven't changed significantly
    const viewportDelta = {
      width: Math.abs(cache.viewport.width - currentViewport.width),
      height: Math.abs(cache.viewport.height - currentViewport.height)
    };

    return viewportDelta.width < 100 && viewportDelta.height < 100;
  }
}

// Singleton instance for global use
export const gridPerformanceMonitor = new GridPerformanceMonitor();

// GridOptimizer functions moved to grid-patterns.ts as GridUtils
// This eliminates redundancy while keeping performance monitoring capabilities

// Development utilities
export const GridDebugger = {
  logPerformanceReport(): void {
    if (process.env.NODE_ENV !== 'development') {return;}

    const report = gridPerformanceMonitor.getPerformanceReport();
    const metrics = gridPerformanceMonitor.getMetrics();

    console.group('🔍 Grid Performance Report');
    console.log(`Status: ${report.status.toUpperCase()}`);
    console.log(`Summary: ${report.summary}`);
    console.table({
      'Avg Render Time': `${metrics.avgRenderTime.toFixed(2)}ms`,
      'Total Renders': metrics.renderCount,
      'Cache Hit Rate': `${metrics.cacheHitRate.toFixed(1)}%`,
      'Cache Hits': metrics.cacheHits,
      'Cache Misses': metrics.cacheMisses,
      'Total Render Time': `${metrics.totalRenderTime.toFixed(2)}ms`
    });

    if (report.recommendations.length > 0) {
      console.group('💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.groupEnd();
    }
    console.groupEnd();
  },

  startPerformanceMonitoring(): void {
    if (process.env.NODE_ENV !== 'development') {return;}

    setInterval(() => {
      const metrics = gridPerformanceMonitor.getMetrics();
      if (metrics.renderCount > 0) {
        this.logPerformanceReport();
      }
    }, 30000); // Log every 30 seconds
  }
};
