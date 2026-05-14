"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface MeteorProps {
  number?: number;
  minDelay?: number;
  maxDelay?: number;
  minDuration?: number;
  maxDuration?: number;
  angle?: number;
  className?: string;
}

export function Meteors({
  number = 20,
  minDelay = 0.2,
  maxDelay = 1.2,
  minDuration = 2,
  maxDuration = 10,
  angle = 215,
  className,
}: MeteorProps) {
  const [meteorStyles, setMeteorStyles] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    const styles = Array.from({ length: number }, () => ({
      top: `${Math.floor(Math.random() * 100)}%`,
      left: `${Math.floor(Math.random() * 100)}%`,
      "--meteor-duration": `${(Math.random() * (maxDuration - minDuration) + minDuration).toFixed(2)}s`,
      animationDelay: `${(Math.random() * (maxDelay - minDelay) + minDelay).toFixed(2)}s`,
    }));
    setMeteorStyles(styles);
  }, [number, minDelay, maxDelay, minDuration, maxDuration]);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ "--meteor-angle": `${angle}deg` } as React.CSSProperties}
    >
      {meteorStyles.map((style, i) => (
        <span
          key={i}
          className="absolute h-px w-[100px] rotate-[var(--meteor-angle)] animate-meteor rounded-full bg-gradient-to-r from-white via-white/60 to-transparent shadow-[0_0_0_1px_#ffffff20]"
          style={style}
        >
          {/* Tail glow */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-white/80 to-transparent blur-[2px]" />
        </span>
      ))}
    </div>
  );
}
