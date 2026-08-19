"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { labelClass } from "./control";

/**
 * Label + control + hint/error, wired together with a generated id so the
 * label always targets its control and errors are announced.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Inline form feedback. `role="status"` / `role="alert"` means a screen reader
 * announces the result of a submit without the user hunting for it.
 */
export function FormMessage({
  type,
  children,
}: {
  type: "ok" | "err";
  children: React.ReactNode;
}) {
  return (
    <p
      role={type === "err" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-3 py-2 text-sm",
        type === "ok"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      )}
    >
      {children}
    </p>
  );
}
