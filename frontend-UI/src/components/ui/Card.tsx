import { cn } from "@/lib/utils";
import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  variant?: "default" | "glass" | "outline";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl text-card-foreground transition-all duration-200",
          variant === "default" && "bg-card border shadow-sm",
          variant === "glass" && "glass-card",
          variant === "outline" && "border-2 border-border bg-transparent",
          interactive && "hover:border-primary/50 hover:shadow-elevation-1 cursor-pointer",
          className
        )}
        {...props}
      />
    );
  }
)
Card.displayName = "Card"
export { Card }

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-border/60 px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-5 py-4 text-sm text-foreground/90", className)}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

