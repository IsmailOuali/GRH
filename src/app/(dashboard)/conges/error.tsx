"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Safety net for the Congés page: if anything in it throws while rendering, the
 * salarié gets a clear message and a retry instead of a blank crash screen.
 * (This Next.js version passes `retry`, not `reset`.)
 */
export default function CongesError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[conges]", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
      <TriangleAlert className="mx-auto size-8 text-amber-500" aria-hidden />
      <h2 className="mt-3 text-lg font-semibold text-slate-900">Un problème est survenu</h2>
      <p className="mt-1 text-sm text-slate-500">
        La page Congés n&apos;a pas pu s&apos;afficher. Vos données n&apos;ont pas été modifiées.
      </p>
      <Button className="mt-5" onClick={() => retry()}>
        Réessayer
      </Button>
    </div>
  );
}
