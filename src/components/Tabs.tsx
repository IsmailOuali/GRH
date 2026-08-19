"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  key: string;
  label: string;
  /** Optional count shown as a badge on the tab. */
  badge?: number;
  content: ReactNode;
};

/**
 * Generic tab switcher. Each tab's already-rendered content is passed in as a
 * `content` node, so server components can build the sections and hand them off.
 *
 * Implements the WAI-ARIA tabs pattern: roving tabindex (only the selected tab
 * is a tab stop), ←/→ to move between tabs, Home/End to jump to the ends.
 */
export function Tabs({ tabs, defaultKey }: { tabs: TabItem[]; defaultKey?: string }) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  function focusTab(index: number) {
    const next = tabs[(index + tabs.length) % tabs.length];
    if (!next) return;
    setActive(next.key);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab-key="${CSS.escape(next.key)}"]`)
      ?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const index = tabs.findIndex((t) => t.key === active);
    if (e.key === "ArrowRight") focusTab(index + 1);
    else if (e.key === "ArrowLeft") focusTab(index - 1);
    else if (e.key === "Home") focusTab(0);
    else if (e.key === "End") focusTab(tabs.length - 1);
    else return;
    e.preventDefault();
  }

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="scrollbar-none mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 md:mb-6"
      >
        {tabs.map((t) => {
          const selected = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.key}`}
              data-tab-key={t.key}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors md:py-2.5",
                selected
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              )}
            >
              {t.label}
              {t.badge ? (
                <span
                  className={cn(
                    "grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                    selected ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-800"
                  )}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Only the selected panel is mounted, so tabIndex={0} makes the panel
          itself reachable when it holds no focusable content. */}
      {current && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${current.key}`}
          aria-labelledby={`${baseId}-tab-${current.key}`}
          tabIndex={0}
          className="animate-rise focus-visible:outline-none"
        >
          {current.content}
        </div>
      )}
    </div>
  );
}
