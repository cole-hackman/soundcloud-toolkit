import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-4 py-3 rounded-lg border-2 border-gray-200",
        "focus:border-[#FF5500] focus:outline-none transition",
        className
      )}
      {...props}
    />
  );
}
