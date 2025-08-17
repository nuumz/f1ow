import { useEffect, useRef } from "react";

/**
 * Centralized cleanup registry for timeouts, rAFs, and arbitrary disposers.
 * Use addTimeout/addRAF when scheduling, and addDisposer to register any cleanup callback.
 * All registered items are cleaned up reliably on unmount.
 */
export function useCleanupRegistry() {
    const timeouts = useRef<Set<NodeJS.Timeout>>(new Set());
    const rafs = useRef<Set<number>>(new Set());
    const disposers = useRef<Set<() => void>>(new Set());

    const addTimeout = (id: NodeJS.Timeout) => {
        timeouts.current.add(id);
        return id;
    };

    const addRAF = (id: number) => {
        rafs.current.add(id);
        return id;
    };

    const addDisposer = (fn: () => void) => {
        disposers.current.add(fn);
        return fn;
    };

    useEffect(() => {
        // Capture current sets to satisfy rules of hooks and avoid using ref.current in cleanup
        const timeoutsSet = timeouts.current;
        const rafsSet = rafs.current;
        const disposersSet = disposers.current;
        return () => {
            // Clear timers
            timeoutsSet.forEach((t) => clearTimeout(t));
            timeoutsSet.clear();

            // Cancel animation frames
            rafsSet.forEach((r) => cancelAnimationFrame(r));
            rafsSet.clear();

            // Execute registered disposers
            disposersSet.forEach((d) => {
                try {
                    d();
                } catch {
                    // noop – defensive cleanup
                }
            });
            disposersSet.clear();
        };
    }, []);

    return { addTimeout, addRAF, addDisposer };
}
