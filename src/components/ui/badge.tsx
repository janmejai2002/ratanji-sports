import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wide uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-amber-500 text-black hover:bg-amber-400 font-black shadow-sm",
        secondary:
          "border-transparent bg-slate-800 text-slate-200 hover:bg-slate-700",
        destructive:
          "border-transparent bg-red-950 text-red-300 border border-red-800/60 shadow-sm",
        outline: "text-slate-300 border-white/10 hover:border-white/20",
        senior: "border-blue-500/30 bg-blue-500/20 text-blue-300 font-bold",
        junior: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300 font-bold",
        live: "border-red-500/40 bg-red-500/20 text-red-400 animate-pulse font-black",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
