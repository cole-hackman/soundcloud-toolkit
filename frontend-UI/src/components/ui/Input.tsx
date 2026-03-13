import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({
  className,
  error,
  ...props
}: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground shadow-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        error
          ? "border-red-500 focus-visible:ring-red-500/40 animate-[shake_150ms_ease-in-out_1]"
          : "border-input focus-visible:ring-primary/60",
        "dark:bg-white/5",
        "transition-colors duration-150",
        className,
      )}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  );
}

