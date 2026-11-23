"use client";

import { motion, MotionConfig } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface ShardDef {
  id: string;
  clipPath: string;
  centroid: [number, number];
  explode: [number, number, number];
}

// 10 polygonal glass shards tiling 0..100% with tiny 0.3% seam overlap to avoid hairline gaps when assembled
const GLASS_SHARDS: ShardDef[] = [
  {
    id: "s0",
    clipPath: "polygon(-0.3% -0.3%, 22.3% -0.3%, 16.3% 56.3%, -0.3% 44.3%)",
    centroid: [10, 25],
    explode: [-52, -46, -16],
  },
  {
    id: "s1",
    clipPath: "polygon(-0.3% 43.7%, 16.3% 55.7%, 24.3% 100.3%, -0.3% 100.3%)",
    centroid: [10, 74],
    explode: [-58, 48, 14],
  },
  {
    id: "s2",
    clipPath: "polygon(21.7% -0.3%, 44.3% -0.3%, 36.3% 50.3%, 15.7% 56.3%)",
    centroid: [29, 26],
    explode: [-24, -56, 12],
  },
  {
    id: "s3",
    clipPath: "polygon(15.7% 55.7%, 36.3% 49.7%, 45.3% 100.3%, 23.7% 100.3%)",
    centroid: [30, 76],
    explode: [-20, 56, -11],
  },
  {
    id: "s4",
    clipPath: "polygon(43.7% -0.3%, 65.3% -0.3%, 57.3% 54.3%, 35.7% 50.3%)",
    centroid: [50, 26],
    explode: [4, -64, -8],
  },
  {
    id: "s5",
    clipPath: "polygon(35.7% 49.7%, 57.3% 53.7%, 63.3% 100.3%, 44.7% 100.3%)",
    centroid: [50, 76],
    explode: [6, 64, 9],
  },
  {
    id: "s6",
    clipPath: "polygon(64.7% -0.3%, 84.3% -0.3%, 78.3% 48.3%, 56.7% 54.3%)",
    centroid: [71, 26],
    explode: [28, -54, 15],
  },
  {
    id: "s7",
    clipPath: "polygon(56.7% 53.7%, 78.3% 47.7%, 85.3% 100.3%, 62.7% 100.3%)",
    centroid: [71, 75],
    explode: [26, 54, -13],
  },
  {
    id: "s8",
    clipPath: "polygon(83.7% -0.3%, 100.3% -0.3%, 100.3% 58.3%, 77.7% 48.3%)",
    centroid: [90, 26],
    explode: [58, -44, -14],
  },
  {
    id: "s9",
    clipPath: "polygon(77.7% 47.7%, 100.3% 57.7%, 100.3% 100.3%, 84.7% 100.3%)",
    centroid: [90, 75],
    explode: [54, 48, 17],
  },
];

export interface ShatterTypeProps {
  text: string;
  highlightPhrase?: string;
  highlightColor?: string;
  className?: string;
}

export default function ShatterType({
  text,
  highlightPhrase,
  highlightColor = "#38bdf8",
  className = "",
}: ShatterTypeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [shattered, setShattered] = useState(false);
  const [pointer, setPointer] = useState<[number, number] | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const triggerShatter = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setShattered(true);
    timerRef.current = window.setTimeout(() => {
      setShattered(false);
      timerRef.current = null;
    }, 680);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    setPointer([px, py]);
  };

  const renderStyledText = () => {
    if (!highlightPhrase) return text;
    const idx = text.indexOf(highlightPhrase);
    if (idx < 0) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + highlightPhrase.length);
    const after = text.slice(idx + highlightPhrase.length);
    return (
      <>
        {before}
        <span style={{ color: highlightColor }}>{match}</span>
        {after}
      </>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <h1 className={className}>
        <span className="sr-only">{text}</span>
        <div
          ref={containerRef}
          aria-hidden="true"
          onClick={triggerShatter}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setPointer(null)}
          className="relative inline-block w-full cursor-pointer select-none py-1"
        >
          {/* Invisible sizing copy keeps exact bounding height */}
          <span className="pointer-events-none block opacity-0" aria-hidden="true">
            {renderStyledText()}
          </span>

          {GLASS_SHARDS.map((shard) => {
            let hoverX = 0;
            let hoverY = 0;
            let hoverRot = 0;
            let cracked = false;

            if (pointer && !shattered) {
              const dx = shard.centroid[0] - pointer[0];
              const dy = shard.centroid[1] - pointer[1];
              const dist = Math.hypot(dx, dy);
              const radius = 34;
              if (dist < radius) {
                cracked = true;
                const strength = 1 - dist / radius;
                const len = Math.max(1, dist);
                hoverX = (dx / len) * strength * 11;
                hoverY = (dy / len) * strength * 9;
                hoverRot = (dx >= 0 ? 1 : -1) * strength * 3.5;
              }
            }

            const targetX = shattered ? shard.explode[0] : hoverX;
            const targetY = shattered ? shard.explode[1] : hoverY;
            const targetRot = shattered ? shard.explode[2] : hoverRot;

            return (
              <motion.span
                key={shard.id}
                className="pointer-events-none absolute inset-0 block"
                style={{
                  clipPath: shard.clipPath,
                  willChange: "transform, opacity",
                  filter:
                    shattered || cracked
                      ? "drop-shadow(0 0 8px rgba(56, 189, 248, 0.55))"
                      : undefined,
                }}
                initial={{
                  opacity: 0,
                  x: shard.explode[0] * 0.55,
                  y: shard.explode[1] * 0.55,
                  rotate: shard.explode[2] * 0.65,
                  scale: 0.94,
                }}
                animate={{
                  opacity: shattered ? 0.2 : 1,
                  x: targetX,
                  y: targetY,
                  rotate: targetRot,
                  scale: shattered ? 0.97 : 1,
                }}
                transition={{
                  type: "spring",
                  stiffness: shattered ? 240 : 210,
                  damping: shattered ? 18 : 22,
                }}
              >
                {renderStyledText()}
              </motion.span>
            );
          })}
        </div>
      </h1>
    </MotionConfig>
  );
}
