import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({
  children,
  className,
  interactive,
  ...props
}: React.PropsWithChildren<CardProps>) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface text-foreground shadow-elevation-1 transition-all duration-200",
        "dark:glass-card",
        interactive && "hover:border-primary/60 hover:shadow-elevation-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

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

