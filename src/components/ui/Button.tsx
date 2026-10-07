import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "destructive" | "success";
type Size = "sm" | "md";

/**
 * Single source of truth for every clickable action in the product.
 *
 * Sizes are deliberately larger on touch (`min-h-11` ≈ the 44px WCAG 2.5.5
 * target) and tighten up at `md:` where a mouse is doing the pointing.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-md active:bg-brand-700 active:shadow-sm",
  secondary:
    "border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 hover:shadow-md active:bg-slate-100",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
  /** Opens a destructive flow — still reversible at this point. */
  danger:
    "border border-red-200 bg-white text-red-600 shadow-sm hover:border-red-300 hover:bg-red-50 hover:shadow-md active:bg-red-100",
  /** Commits the destructive action — filled, so it reads as the point of no return. */
  destructive:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md active:bg-red-700 active:shadow-sm",
  success:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md active:bg-emerald-700 active:shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 gap-1.5 rounded-lg px-3 text-xs md:min-h-8",
  md: "min-h-11 gap-2 rounded-xl px-4 text-sm md:min-h-10",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Renders a spinner and blocks input — use for pending server actions. */
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/20 active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none",
        SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        className
      )}
    >
      {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Anchor styled as a `secondary` button — for downloads and cross-links. */
export function LinkButton({
  size = "sm",
  variant = "secondary",
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { size?: Size; variant?: Variant }) {
  return (
    <a
      {...props}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors duration-150",
        SIZES[size],
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </a>
  );
}
