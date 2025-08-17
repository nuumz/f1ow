import { useRef } from 'react';

/**
 * Hook to create stable callback references that prevent unnecessary re-renders
 * in layer components. Uses refs to maintain the latest callback while keeping
 * the reference stable.
 */

export function useStableCallbacks<T extends Record<string, (...args: any[]) => any>>(
  callbacks: T
): T {
  const callbackRefs = useRef<T>(callbacks);

  // Update refs with latest callbacks
  callbackRefs.current = callbacks;

  // Create stable references that delegate to current callbacks
  const stableCallbacks = useRef<T>({} as T);

  // Initialize stable callbacks only once
  if (Object.keys(stableCallbacks.current).length === 0) {
    Object.keys(callbacks).forEach(key => {
      (stableCallbacks.current as any)[key] = (...args: any[]) => {
        return callbackRefs.current[key](...args);
      };
    });
  }

  return stableCallbacks.current;
}

/**
 * Hook for stable callback groups used in layer architecture
 */
export function useStableLayerCallbacks(
  callbacks: any,
  context: any,
  visuals: any,
  utils: any
) {
  const stableCallbacks = useStableCallbacks(callbacks);
  const stableContext = useStableCallbacks(context);
  const stableVisuals = useStableCallbacks(visuals);
  const stableUtils = useStableCallbacks(utils);

  return {
    callbacks: stableCallbacks,
    context: stableContext,
    visuals: stableVisuals,
    utils: stableUtils
  };
}