import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    
    const variants = {
      primary: "bg-brand-green text-white hover:bg-brand-green-hover focus-visible:ring-brand-green border border-transparent",
      secondary: "bg-brand-bg-secondary text-brand-navy hover:bg-gray-100 focus-visible:ring-gray-300 border border-brand-border",
      outline: "border border-brand-border bg-white hover:bg-brand-bg-secondary hover:text-brand-navy focus-visible:ring-gray-300",
      ghost: "hover:bg-brand-bg-secondary hover:text-brand-navy focus-visible:ring-gray-300",
      destructive: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500 border border-transparent"
    };

    const sizes = {
      sm: "h-8 rounded-md px-3 text-xs",
      md: "h-10 rounded-md px-4 py-2",
      lg: "h-11 rounded-md px-8",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
