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
 *
 * Under `prefers-reduced-motion: reduce` the first word is rendered statically
 * and no interval is ever started — WCAG 2.3.3, and the rotation is decorative.
 */
export function WordRotate({
  words,
  duration = 2200,
  className,
}: WordRotateProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

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
  }, [words, duration, reducedMotion]);

  if (reducedMotion) {
    return <span className={cn("inline-block", className)}>{words[0]}</span>;
  }

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
