import { cn } from "@/lib/utils";
import * as React from "react";

export type IconButtonVariant = "ghost" | "outline" | "destructive";
export type IconButtonSize = "sm" | "md";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** Accessible name. Becomes `aria-label`, and the tooltip unless `title={false}`. */
  label: string;
  /** `false` suppresses the native tooltip; a string overrides its text. */
  title?: string | false;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
}

/**
 * A square button whose only child is an icon. Always `<button type="button">`
 * — for a link that should look like one, style the anchor directly; this is
 * deliberately not polymorphic.
 *
 * `touch-44` (globals.css) lifts both sizes to a 44x44 target under
 * `@media (pointer: coarse)`, so `sm` stays visually compact on a desktop
 * without shrinking the tap target on a phone.
 */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, label, title, size = "md", variant = "ghost", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={title === false ? undefined : (title ?? label)}
        className={cn(
          "touch-44 inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variant === "ghost" && "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          variant === "outline" && "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
          variant === "destructive" && "text-destructive-text hover:bg-destructive/10",
          size === "sm" && "h-9 w-9",
          size === "md" && "h-11 w-11",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";

export { IconButton };
