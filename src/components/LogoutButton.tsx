"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/logout/actions";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => logoutAction())}
      className={cn(
        // Lives on the dark nav chrome only — the destructive hover is a red
        // wash plus red-300 text (8.9:1 on --chrome), not the light-surface
        // red-50/red-600 pair, which would be unreadable here.
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-chrome-dim transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-60 md:py-2",
        className
      )}
    >
      {pending ? (
        <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-5 shrink-0 text-chrome-muted" aria-hidden />
      )}
      <span>Se déconnecter</span>
    </button>
  );
}
