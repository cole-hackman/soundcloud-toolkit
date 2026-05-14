"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef } from "react";

interface FlickeringGridProps {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  maxOpacity?: number;
}

export function FlickeringGrid({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color = "rgb(255, 85, 0)",
  width,
  height,
  className,
  maxOpacity = 0.15,
}: FlickeringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);

      const cols = Math.ceil(w / (squareSize + gridGap));
      const rows = Math.ceil(h / (squareSize + gridGap));
      const opacities = new Float32Array(cols * rows).map(() => Math.random() * maxOpacity);

      return { ctx, cols, rows, opacities, w, h };
    },
    [squareSize, gridGap, maxOpacity],
  );

  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      cols: number,
      rows: number,
      opacities: Float32Array,
      w: number,
      h: number,
    ) => {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const idx = i * rows + j;

          // Randomly flicker
          if (Math.random() < flickerChance) {
            opacities[idx] = Math.random() * maxOpacity;
          }

          ctx.globalAlpha = opacities[idx];
          ctx.fillStyle = color;
          ctx.fillRect(
            i * (squareSize + gridGap),
            j * (squareSize + gridGap),
            squareSize,
            squareSize,
          );
        }
      }
      ctx.globalAlpha = 1;
    },
    [color, flickerChance, gridGap, maxOpacity, squareSize],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = width ?? container.offsetWidth;
    const h = height ?? container.offsetHeight;

    if (w === 0 || h === 0) return;

    const { ctx, cols, rows, opacities } = setupCanvas(canvas, w, h);

    let rafId: number;
    const loop = () => {
      draw(ctx, cols, rows, opacities, w, h);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    animationRef.current = rafId;

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [width, height, setupCanvas, draw]);

  return (
    <div ref={containerRef} className={cn("h-full w-full", className)}>
      <canvas ref={canvasRef} />
    </div>
  );
}
