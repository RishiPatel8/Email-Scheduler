import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "./Button"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center", className)} {...props}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-bg-secondary mb-4 border border-brand-border">
        <Icon className="h-8 w-8 text-brand-secondary" />
      </div>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button variant="primary">{actionLabel}</Button>
        </Link>
      )}
    </div>
  )
}
