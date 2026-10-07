import { type LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-slate-100 ring-1 ring-inset ring-slate-200/70 dark:bg-white/5 dark:ring-white/10">
        <Icon className="size-6 text-slate-400 dark:text-neutral-500" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-neutral-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
