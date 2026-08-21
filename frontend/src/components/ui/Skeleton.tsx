import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-brand-bg-secondary border border-brand-border", className)}
      {...props}
    />
  )
}

export { Skeleton }
