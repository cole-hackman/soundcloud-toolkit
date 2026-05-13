"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface WordRotateProps {
  words: string[];
  duration?: number;
  className?: string;
}

/**
 * Rotates through an array of words with a smooth vertical slide + fade transition.
 */
export function WordRotate({
  words,
  duration = 2200,
  className,
}: WordRotateProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cycle = () => {
      // Fade out
      setVisible(false);
      timerRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        // Fade in
        setVisible(true);
      }, 350); // matches transition duration
    };

    const interval = setInterval(cycle, duration);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [words, duration]);

  return (
    <span
      className={cn(
        "inline-block transition-all duration-300",
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-2 opacity-0",
        className
      )}
    >
      {words[index]}
    </span>
  );
}
