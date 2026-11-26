"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dismissToast, toastStore, type Toast } from "@/lib/toast";

/** Errors stay longer: they usually ask the user to do something. */
const DURATION_MS = { ok: 5000, err: 9000 };

export function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getServerSnapshot);

  return (
    // Top of the screen, in the middle, where it cannot be missed: across the
    // width on a phone (clear of the notch), a centred column on desktop.
    // Above the modals and sheets (z-50), which also contain actions.
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] flex flex-col gap-2 sm:mx-auto sm:max-w-lg"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), DURATION_MS[toast.type]);
    return () => clearTimeout(timer);
  }, [toast.id, toast.type]);

  const ok = toast.type === "ok";
  const Icon = ok ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "pointer-events-auto flex animate-rise items-start gap-3 rounded-2xl p-4 text-white shadow-overlay ring-1 ring-black/10",
        ok ? "bg-emerald-700" : "bg-red-700",
      )}
    >
      <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">{ok ? "C'est fait" : "Attention"}</p>
        <p className="mt-0.5 break-words text-sm sm:text-base">{toast.text}</p>
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Fermer la notification"
        className="-m-1.5 grid size-9 shrink-0 place-items-center rounded-lg hover:bg-white/15"
      >
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
