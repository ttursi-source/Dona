import type { CSSProperties } from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 36, className = "" }: LogoProps) {
  const ring = Math.max(3, Math.round(size * 0.11));
  const fontSize = Math.max(9, Math.round(size * 0.27));
  const style: CSSProperties = {
    width: size,
    height: size,
    borderWidth: ring,
    fontSize,
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-[#38bdf8] bg-[#090d16] font-extrabold tracking-tight text-[#f8fafc] select-none ${className}`}
      style={{
        ...style,
        borderStyle: "solid",
        boxShadow: "0 0 18px rgba(56, 189, 248, 0.38), inset 0 0 10px rgba(56, 189, 248, 0.14)",
      }}
      aria-hidden="true"
    >
      doná
    </span>
  );
}
