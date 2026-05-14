"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type ValidElement =
  | "article"
  | "div"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "li"
  | "p"
  | "section"
  | "span";

interface TypingAnimationProps {
  children?: string;
  words?: string[];
  className?: string;
  duration?: number;
  typeSpeed?: number;
  deleteSpeed?: number;
  delay?: number;
  pauseDelay?: number;
  loop?: boolean;
  as?: ValidElement;
  startOnView?: boolean;
  showCursor?: boolean;
  blinkCursor?: boolean;
  cursorStyle?: "line" | "block" | "underscore";
}

export function TypingAnimation({
  children,
  words,
  className,
  typeSpeed = 80,
  deleteSpeed = 40,
  delay = 0,
  pauseDelay = 1500,
  loop = true,
  as: Tag = "span",
  startOnView = true,
  showCursor = true,
  blinkCursor = true,
  cursorStyle = "line",
}: TypingAnimationProps) {
  const wordList = words ?? (children ? [children] : [""]);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnView);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  // IntersectionObserver for startOnView
  useEffect(() => {
    if (!startOnView) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [startOnView]);

  // Typing engine
  useEffect(() => {
    if (!isVisible) return;
    if (!started) {
      const t = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(t);
    }

    const currentWord = wordList[wordIndex];

    if (!isDeleting && displayed === currentWord) {
      // Pause then start deleting
      if (wordList.length === 1 && !loop) return; // single word, no loop — stop
      const t = setTimeout(() => setIsDeleting(true), pauseDelay);
      return () => clearTimeout(t);
    }

    if (isDeleting && displayed === "") {
      // Move to next word
      setIsDeleting(false);
      setWordIndex((i) => (loop ? (i + 1) % wordList.length : Math.min(i + 1, wordList.length - 1)));
      return;
    }

    const speed = isDeleting ? deleteSpeed : typeSpeed;
    const t = setTimeout(() => {
      setDisplayed(
        isDeleting
          ? currentWord.slice(0, displayed.length - 1)
          : currentWord.slice(0, displayed.length + 1),
      );
    }, speed);

    return () => clearTimeout(t);
  }, [displayed, isDeleting, wordIndex, isVisible, started, wordList, typeSpeed, deleteSpeed, pauseDelay, loop, delay]);

  const cursorChar = cursorStyle === "block" ? "▌" : cursorStyle === "underscore" ? "_" : "|";

  return (
    <Tag
      ref={ref as React.RefObject<never>}
      className={cn("inline", className)}
    >
      {displayed}
      {showCursor && (
        <span
          className={cn(
            "ml-0.5 inline-block select-none text-current",
            blinkCursor && "animate-blink-cursor",
          )}
          aria-hidden="true"
        >
          {cursorChar}
        </span>
      )}
    </Tag>
  );
}
