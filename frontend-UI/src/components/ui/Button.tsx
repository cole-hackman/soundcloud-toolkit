import { cn } from "@/lib/utils";
import * as React from "react";

export type ButtonVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "ghost"
  | "outline"
  | "glass";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.98]",
          // Variants
          variant === "default" && [
            "bg-primary text-primary-foreground shadow-elevation-1",
            "hover:shadow-glow-sm hover:-translate-y-0.5",
          ],
          variant === "secondary" && [
            "border border-border/70 bg-secondary text-secondary-foreground shadow-sm",
            "hover:border-primary/40 hover:bg-secondary/80",
          ],
          variant === "destructive" && [
            "bg-destructive text-destructive-foreground shadow-sm",
            "hover:bg-destructive/90",
            "data-[shake=true]:animate-[shake_150ms_ease-in-out_1]",
          ],
          variant === "ghost" && [
            "hover:bg-accent hover:text-accent-foreground text-foreground",
          ],
          variant === "outline" && [
            "border border-input bg-background shadow-sm text-foreground",
            "hover:bg-accent hover:text-accent-foreground",
          ],
          variant === "glass" && [
            "glass-card text-foreground hover:bg-white/10 dark:hover:bg-white/5",
          ],
          // Sizes
          size === "default" && "h-10 px-4 py-2",
          size === "sm" && "h-9 rounded-md px-3",
          size === "lg" && "h-12 rounded-xl px-8 text-base",
          size === "icon" && "h-10 w-10",
          className
        )}
        {...props}
      />
    );
  }
)
Button.displayName = "Button"

export { Button }
