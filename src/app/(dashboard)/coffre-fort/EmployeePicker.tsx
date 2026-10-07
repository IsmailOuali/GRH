"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { controlClass } from "@/components/ui/control";

type Employee = { id: string; name: string };

/** Lets HR pick whose coffre-fort to view; navigates with ?userId=. */
export function EmployeePicker({
  employees,
  selectedId,
}: {
  employees: Employee[];
  selectedId?: string;
}) {
  const router = useRouter();

  return (
    <label className="flex max-w-md items-center gap-2.5">
      <Users className="size-4 shrink-0 text-slate-400" aria-hidden />
      <span className="sr-only">Employé</span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/coffre-fort?userId=${id}` : "/coffre-fort");
        }}
        className={controlClass}
      >
        <option value="">— Sélectionner un employé —</option>
        {employees.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}
