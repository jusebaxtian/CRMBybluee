import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Canonical variants pulled from the design-system audit — each string here
// is copied verbatim from the most-common existing usage across the app, so
// swapping a call site to <Button variant="..." size="..."> renders
// pixel-identical to what was already there. Do NOT "improve" these values
// without checking every call site that relies on them — see the audit's
// flagged-drift list for spots that intentionally were left unmigrated
// because they differ from these canonical forms.
type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive-outline"
  | "destructive-filled"
  | "ghost-icon"
  | "text";

type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: {
    md: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50",
    sm: "rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50",
  },
  secondary: {
    md: "rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover",
    sm: "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-50",
  },
  "destructive-outline": {
    md: "rounded-lg border border-error px-4 py-2 text-sm font-medium text-error hover:bg-error-hover/10 disabled:opacity-50",
    sm: "rounded-md border border-error px-3 py-1.5 text-xs font-medium text-error hover:bg-error-hover/10 disabled:opacity-50",
  },
  "destructive-filled": {
    md: "rounded-md bg-error-hover px-3 py-1.5 text-sm font-medium text-white hover:bg-error-active disabled:opacity-50",
    sm: "rounded-md bg-error-hover px-3 py-1.5 text-sm font-medium text-white hover:bg-error-active disabled:opacity-50",
  },
  "ghost-icon": {
    md: "flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground",
    sm: "flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground",
  },
  text: {
    md: "text-muted hover:text-foreground",
    sm: "text-xs text-muted hover:text-foreground",
  },
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(variantClasses[variant][size], className)}
      {...props}
    />
  );
});
