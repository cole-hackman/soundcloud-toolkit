import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin",
        size === "sm" && "w-4 h-4",
        size === "md" && "w-5 h-5",
        size === "lg" && "w-8 h-8",
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
