"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteVaultDocument } from "./actions";

/** Removes a native coffre-fort document after an inline confirm. HR only. */
export function VaultDeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteVaultDocument(id);
      if ("error" in res) {
        setConfirming(false);
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button size="sm" variant="destructive" loading={pending} onClick={handleDelete}>
          Supprimer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Annuler
        </Button>
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="danger"
      onClick={() => setConfirming(true)}
      aria-label={`Supprimer ${title}`}
    >
      <Trash2 className="size-3.5" aria-hidden />
      Supprimer
    </Button>
  );
}
