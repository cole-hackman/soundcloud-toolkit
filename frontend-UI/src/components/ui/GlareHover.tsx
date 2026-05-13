"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface GlareHoverProps {
  children: React.ReactNode;
  className?: string;
  /** 0–1 opacity of the glare overlay. Default 0.12 */
  glareOpacity?: number;
  /** Size of the glare radial in px. Default 300 */
  glareSize?: number;
  /** Color of the glare. Default white */
  glareColor?: string;
}

/**
 * Follows the mouse with a soft radial gloss overlay — the "Apple product" shine.
 * Renders only on pointer devices; does nothing on touch.
 */
export function GlareHover({
  children,
  className,
  glareOpacity = 0.12,
  glareSize = 300,
  glareColor = "255,255,255",
}: GlareHoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => setPos(null);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("relative overflow-hidden", className)}
    >
      {pos && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(${glareSize}px circle at ${pos.x}px ${pos.y}px, rgba(${glareColor},${glareOpacity}), transparent 70%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
