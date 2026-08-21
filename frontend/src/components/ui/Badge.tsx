import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'outline' | 'info';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-brand-border bg-brand-bg-secondary text-brand-navy",
    success: "border-brand-green/20 bg-brand-green/10 text-brand-green",
    warning: "border-yellow-200 bg-yellow-50 text-yellow-700",
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
    outline: "text-brand-navy border-brand-border",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
