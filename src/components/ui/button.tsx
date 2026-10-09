import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-amber-500 text-black hover:bg-amber-400 font-black shadow-md",
        destructive:
          "bg-red-600 text-white hover:bg-red-500 shadow-sm",
        outline:
          "border border-white/10 bg-transparent hover:bg-white/5 text-slate-200",
        secondary:
          "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700",
        ghost: "hover:bg-white/5 hover:text-white text-slate-400",
        link: "text-amber-400 underline-offset-4 hover:underline",
        senior: "bg-blue-600 hover:bg-blue-500 text-white font-black shadow-md",
        junior: "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-[11px]",
        lg: "h-11 rounded-xl px-6 text-sm font-black",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
