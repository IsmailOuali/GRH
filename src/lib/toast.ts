/**
 * Pop-up notifications for the result of an action. A tiny module-level store,
 * shown by <Toaster /> in the root layout: a message survives the form or row
 * that raised it disappearing (a validated request, a page change).
 */

import { useCallback, useState } from "react";

export type ToastType = "ok" | "err";
export type Toast = { id: number; type: ToastType; text: string };

const MAX_VISIBLE = 3;
const EMPTY: Toast[] = [];

let toasts: Toast[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: Toast[]) {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export function showToast(type: ToastType, text: string) {
  // The same message again restarts it instead of stacking a copy.
  const others = toasts.filter((t) => t.text !== text);
  publish([...others, { id: nextId++, type, text }].slice(-MAX_VISIBLE));
}

export function dismissToast(id: number) {
  publish(toasts.filter((t) => t.id !== id));
}

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => toasts,
  getServerSnapshot: () => EMPTY,
};

/**
 * For a server action's result: shows its `error`, otherwise `okText`.
 * Returns true on success.
 */
export function toastResult(result: unknown, okText: string): boolean {
  const error =
    result && typeof result === "object" && "error" in result
      ? (result as { error?: string }).error
      : undefined;
  showToast(error ? "err" : "ok", error ?? okText);
  return !error;
}

export type Feedback = { type: ToastType; text: string };

/** A form's message state that also pops the message up when it is set. */
export function useFeedback() {
  const [msg, setState] = useState<Feedback | null>(null);
  const setMsg = useCallback((next: Feedback | null) => {
    setState(next);
    if (next) showToast(next.type, next.text);
  }, []);
  return [msg, setMsg] as const;
}
