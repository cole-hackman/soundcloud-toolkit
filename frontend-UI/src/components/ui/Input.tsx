import { cn } from "@/lib/utils";
import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/**
 * `text-base sm:text-sm` is load-bearing: iOS Safari zooms the viewport when a
 * focused input's font-size is under 16px, so the mobile size stays 16px and
 * only the desktop breakpoint drops to 14px.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-base text-foreground shadow-sm sm:text-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          error
            ? "border-destructive focus-visible:ring-destructive/40 animate-[shake_150ms_ease-in-out_1]"
            : "border-input focus-visible:ring-primary/60",
          "dark:bg-white/5",
          "transition-colors duration-150",
          className,
        )}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
