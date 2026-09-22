import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * The ring is `border-current` with one transparent side, tinted by `text-*`
 * rather than `border-*`.
 *
 * That split is load-bearing. `cn` is `tailwind-merge`, which treats
 * `border-<color>` as the parent of `border-t-<color>` — so a caller passing
 * `border-white` (or `border-current`) silently *removes* `border-t-transparent`
 * from the merged result. The ring comes out uniform, and a uniform ring under
 * `animate-spin` shows no motion at all: the spinner looks frozen. Colouring
 * through `text-*` leaves the border classes alone, so the gap always survives.
 *
 * `e2e/primitives.spec.ts` pins this by measuring the rendered border colours.
 */
export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "border-2 border-current border-t-transparent text-primary rounded-full animate-spin",
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
