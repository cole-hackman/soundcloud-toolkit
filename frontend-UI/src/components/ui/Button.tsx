import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "ghost"
  | "outline";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children?: React.ReactNode;
}

export function Button({
  variant = "default",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.98]",
        variant === "default" && [
          "bg-primary text-primary-foreground shadow-elevation-1",
          "hover:shadow-glow-sm hover:-translate-y-0.5",
        ],
        variant === "secondary" && [
          "border border-border/70 bg-surface text-foreground",
          "hover:border-primary/40 hover:bg-surface-hover",
        ],
        variant === "destructive" && [
          "bg-red-600 text-white shadow-sm",
          "hover:bg-red-500",
          "data-[shake=true]:animate-[shake_150ms_ease-in-out_1]",
        ],
        variant === "ghost" && [
          "bg-transparent text-foreground",
          "hover:bg-surface-hover/70",
        ],
        variant === "outline" && [
          "border border-border bg-transparent text-foreground",
          "hover:border-primary/50 hover:bg-surface-hover",
        ],
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

