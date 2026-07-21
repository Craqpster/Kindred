"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/// A single stack of transient notifications for the authenticated shell.
///
/// Callers describe what happened - a message arrived, XP was earned - and this decides
/// how it looks and how long it lives. Kinds rather than styling props: a caller that can
/// hand-style a toast eventually produces four slightly different toasts.
export type ToastKind = "message" | "xp" | "milestone";

export type ToastInput = {
    kind: ToastKind;
    title: string;
    body?: string;
    /// How many things this toast stands for. Carried so a `merge` can accumulate
    /// ("+1 XP" then "+2 XP") without the caller keeping its own running total, since the
    /// toast on screen is the only record of what has already been shown.
    count?: number;
    /// Optional identity for coalescing. Raising a toast with a `mergeKey` that is already
    /// on screen replaces it in place instead of stacking a second one - see `merge`.
    mergeKey?: string;
    /// Given the toast already on screen under the same mergeKey, return the replacement.
    /// Lets a caller accumulate ("+1 XP" then "+2 XP") without tracking the running total
    /// itself, and without the stack knowing anything about XP.
    merge?: (previous: Toast) => ToastInput;
};

export type Toast = ToastInput & { id: string };

// Long enough to read a two-line toast, short enough not to linger over the dock.
const DURATION_MS = 5000;

// Older toasts are evicted rather than queued: this is ambient feedback, and a backlog
// that keeps displaying after the moment has passed is worse than dropping it.
const MAX_VISIBLE = 4;

const ToastContext = createContext<{ showToast: (input: ToastInput) => void } | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within ToastProvider");
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Timers are tracked so they can be cleared - both when a toast is superseded by a
    // merge (whose replacement deserves the full duration again) and on unmount.
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const dismiss = useCallback((id: string) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);

    const showToast = useCallback(
        (input: ToastInput) => {
            setToasts((current) => {
                const existing = input.mergeKey
                    ? current.find((toast) => toast.mergeKey === input.mergeKey)
                    : undefined;

                if (existing) {
                    // Restart the clock: the merged toast is new information, so it should
                    // get its own full reading time rather than inheriting the remainder.
                    const previousTimer = timers.current.get(existing.id);
                    if (previousTimer) clearTimeout(previousTimer);
                    timers.current.set(
                        existing.id,
                        setTimeout(() => dismiss(existing.id), DURATION_MS),
                    );

                    const merged = input.merge ? input.merge(existing) : input;
                    return current.map((toast) =>
                        toast.id === existing.id ? { ...merged, id: existing.id } : toast,
                    );
                }

                const id = crypto.randomUUID();
                timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS));

                return [...current, { ...input, id }].slice(-MAX_VISIBLE);
            });
        },
        [dismiss],
    );

    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach(clearTimeout);
            pending.clear();
        };
    }, []);

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastViewport toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
}

// False while rendering on the server and on the very first client render, true after.
//
// useSyncExternalStore rather than the usual useEffect(() => setMounted(true)) mount
// flag: setting state straight from an effect makes React Compiler's lint (rightly)
// complain about cascading renders, and this expresses the same thing as what it
// actually is — a value React reads differently on the server than on the client.
// Same shape as useHoverCapable in components/ui/Button.tsx.
const subscribeToNothing = () => () => {};

function useHasMounted() {
    return useSyncExternalStore(
        subscribeToNothing,
        () => true,
        () => false,
    );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    const reduceMotion = useReducedMotion();

    // document.body doesn't exist during the server render, and the portal has to be
    // skipped on the first client render too or the markup won't match.
    if (!useHasMounted()) return null;

    // Portalled to the body rather than positioned in place: in app/(app)/layout.tsx the
    // scroll container is <main>, and a `fixed` element inside a scrolling ancestor
    // positions against that ancestor, not the viewport.
    return createPortal(
        <div
            // aria-live so a toast is announced when it appears; the region itself is
            // always mounted, because a live region added to the document at the same
            // moment as its content is not reliably announced.
            aria-live="polite"
            // z-[90] clears the dock's z-50 — a toast that slides under the nav is worse
            // than no toast, since it looks like a rendering fault rather than a message.
            className="pointer-events-none fixed right-4 bottom-4 z-90 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2"
        >
            <AnimatePresence initial={false} mode="popLayout">
                {toasts.map((toast) => (
                    <ToastCard
                        key={toast.id}
                        toast={toast}
                        reduceMotion={!!reduceMotion}
                        onDismiss={() => onDismiss(toast.id)}
                    />
                ))}
            </AnimatePresence>
        </div>,
        document.body,
    );
}

const KIND_STYLES: Record<ToastKind, string> = {
    message: "border-bone-300 bg-surface",
    xp: "border-accent-100 bg-surface",
    // The one toast that should feel like an event rather than a notification.
    milestone: "border-accent-600 bg-accent-50",
};

function ToastCard({
    toast,
    reduceMotion,
    onDismiss,
}: {
    toast: Toast;
    reduceMotion: boolean;
    onDismiss: () => void;
}) {
    // Reduced motion still gets a fade - the alternative is toasts blinking in and out,
    // which is harder to track than a gentle one, not easier.
    const motionProps = reduceMotion
        ? {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0.15 },
          }
        : {
              initial: { opacity: 0, y: 22, scale: 0.96, filter: "blur(10px)" },
              animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
              exit: { opacity: 0, x: 32, scale: 0.96, transition: { duration: 0.18 } },
              transition: { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.75 },
          };

    return (
        <motion.div
            layout={!reduceMotion}
            {...motionProps}
            className={`pointer-events-auto flex items-start gap-3 rounded-card border p-3 shadow-card ${KIND_STYLES[toast.kind]}`}
        >
            <div className="min-w-0 flex-1">
                <p className="text-meta font-medium text-ink-900">{toast.title}</p>
                {toast.body && <p className="mt-0.5 text-label text-ink-600">{toast.body}</p>}
            </div>

            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-full px-1.5 py-0.5 text-label text-ink-600 transition-colors hover:bg-bone-200 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
            >
                ✕
            </button>
        </motion.div>
    );
}
