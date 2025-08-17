/**
 * Centralized RAF Coordinator for Layer-Based Architecture
 * 
 * Prevents RAF conflicts between layers and optimizes frame budget allocation.
 * Replaces individual layer RAF scheduling with coordinated batching.
 */

export type RAFPriority = 'critical' | 'high' | 'normal' | 'low';

export interface RAFTask {
  id: string;
  callback: () => void;
  priority: RAFPriority;
  layerType: 'node' | 'connection' | 'visual' | 'grid' | 'interaction';
  scheduledTime: number;
}

class RAFCoordinator {
  private readonly tasks: Map<string, RAFTask> = new Map();
  private rafId: number | null = null;
  private isProcessing: boolean = false;

  // Frame budget allocation per layer type (in milliseconds)
  private readonly budgets = {
    critical: 8,    // Drag updates, immediate visual feedback
    high: 4,        // Z-index changes, selection updates
    normal: 3,      // Connection path updates
    low: 1          // Grid updates, cleanup
  };

  // Maximum frame time to prevent jank
  private readonly MAX_FRAME_TIME = 16.67; // ~60fps

  private getPriorityScore(priority: RAFPriority): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  schedule(task: Omit<RAFTask, 'scheduledTime'>): void {
    const taskWithTime: RAFTask = {
      ...task,
      scheduledTime: performance.now()
    };

    this.tasks.set(task.id, taskWithTime);

    if (!this.isProcessing && !this.rafId) {
      this.rafId = requestAnimationFrame(this.processFrame);
    }
  }

  cancel(taskId: string): void {
    this.tasks.delete(taskId);
  }

  private readonly processFrame = (frameStartTime?: number): void => {
    this.isProcessing = true;
    const actualFrameStart = frameStartTime || performance.now();

    const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => {
      const priorityDiff = this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return a.scheduledTime - b.scheduledTime; // FIFO for same priority
    });

    const processedTasks = new Set<string>();
    const frameDeadline = actualFrameStart + this.MAX_FRAME_TIME;

    for (const task of sortedTasks) {
      const currentTime = performance.now();
      if (currentTime >= frameDeadline) break;

      const taskStart = currentTime;
      const allowedTime = this.budgets[task.priority];
      const remainingFrameTime = frameDeadline - currentTime;

      // Skip task if it would likely exceed frame deadline
      if (allowedTime > remainingFrameTime) break;

      try {
        task.callback();
        processedTasks.add(task.id);

        const taskDuration = performance.now() - taskStart;

        // Early exit if task took too long
        if (taskDuration > allowedTime * 1.5) {
          console.warn(`RAF task ${task.id} exceeded budget: ${taskDuration.toFixed(2)}ms > ${allowedTime}ms`);
          break;
        }
      } catch (error) {
        console.error(`RAF task ${task.id} failed:`, error);
        processedTasks.add(task.id); // Remove failed tasks
      }
    }

    // Clean up processed tasks
    processedTasks.forEach(id => this.tasks.delete(id));

    // Schedule next frame if tasks remain
    if (this.tasks.size > 0) {
      this.rafId = requestAnimationFrame(this.processFrame);
    } else {
      this.rafId = null;
    }

    this.isProcessing = false;
  };

  cancelAll(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.tasks.clear();
    this.isProcessing = false;
  }

  getStats() {
    return {
      pendingTasks: this.tasks.size,
      isProcessing: this.isProcessing,
      tasksByPriority: {
        critical: Array.from(this.tasks.values()).filter(t => t.priority === 'critical').length,
        high: Array.from(this.tasks.values()).filter(t => t.priority === 'high').length,
        normal: Array.from(this.tasks.values()).filter(t => t.priority === 'normal').length,
        low: Array.from(this.tasks.values()).filter(t => t.priority === 'low').length,
      }
    };
  }
}

// Singleton instance for coordinated scheduling
export const rafCoordinator = new RAFCoordinator();

// Convenience functions for layer-specific scheduling
export const scheduleNodeUpdate = (id: string, callback: () => void, priority: RAFPriority = 'high') => {
  rafCoordinator.schedule({ id, callback, priority, layerType: 'node' });
};

export const scheduleConnectionUpdate = (id: string, callback: () => void, priority: RAFPriority = 'normal') => {
  rafCoordinator.schedule({ id, callback, priority, layerType: 'connection' });
};

export const scheduleVisualUpdate = (id: string, callback: () => void, priority: RAFPriority = 'normal') => {
  rafCoordinator.schedule({ id, callback, priority, layerType: 'visual' });
};

export const scheduleDragUpdate = (id: string, callback: () => void) => {
  rafCoordinator.schedule({ id, callback, priority: 'critical', layerType: 'node' });
};

// Optional helpers for other layers (kept for completeness and future use)
export const scheduleGridUpdate = (id: string, callback: () => void, priority: RAFPriority = 'low') => {
  rafCoordinator.schedule({ id, callback, priority, layerType: 'grid' });
};

export const scheduleInteractionUpdate = (id: string, callback: () => void, priority: RAFPriority = 'high') => {
  rafCoordinator.schedule({ id, callback, priority, layerType: 'interaction' });
};