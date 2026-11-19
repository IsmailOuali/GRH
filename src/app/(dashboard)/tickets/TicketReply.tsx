"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/control";
import { MAX_RESPONSE_LENGTH } from "@/lib/tickets";
import { answerTicket } from "./actions";

/** RH side of a ticket: take it, or answer and resolve it. */
export function TicketReply({
  id,
  status,
  disabledReason,
}: {
  id: string;
  status: string;
  /** Set when the viewer cannot answer (their own ticket): explains why. */
  disabledReason?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState<"IN_PROGRESS" | "RESOLVED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (disabledReason) {
    return <p className="text-xs italic text-slate-500">{disabledReason}</p>;
  }

  async function submit(next: "IN_PROGRESS" | "RESOLVED") {
    setLoading(next);
    setError(null);
    try {
      const res = await answerTicket(id, next, text);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={MAX_RESPONSE_LENGTH}
        placeholder="Votre réponse au salarié"
        aria-label="Réponse au salarié"
        className={`${controlClass} text-sm`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="success"
          loading={loading === "RESOLVED"}
          disabled={!!loading || !text.trim()}
          onClick={() => submit("RESOLVED")}
        >
          {loading !== "RESOLVED" && <CheckCheck className="size-3.5" aria-hidden />}
          Répondre et résoudre
        </Button>
        {status === "OPEN" && (
          <Button
            size="sm"
            variant="secondary"
            loading={loading === "IN_PROGRESS"}
            disabled={!!loading}
            onClick={() => submit("IN_PROGRESS")}
          >
            {loading !== "IN_PROGRESS" && <Hourglass className="size-3.5" aria-hidden />}
            Prendre en charge
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
