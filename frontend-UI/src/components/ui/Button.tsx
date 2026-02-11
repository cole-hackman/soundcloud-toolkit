import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-lg font-semibold transition-all inline-flex items-center justify-center gap-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && [
          "bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white",
          "hover:shadow-lg",
        ],
        variant === "secondary" && [
          "border-2 border-gray-200 text-[#333333]",
          "hover:border-[#FF5500]",
        ],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
