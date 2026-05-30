import * as React from "react";
import { cn } from "@/lib/utils";

interface ChipProps {
  children: React.ReactNode;
  tone?: "default" | "evergreen" | "salmon" | "tidal" | "amber" | "crimson";
  className?: string;
  dot?: boolean;
}

const TONE: Record<NonNullable<ChipProps["tone"]>, { fg: string; bg: string; bd: string }> = {
  default:   { fg: "var(--atlas-ink-dim)", bg: "transparent",                          bd: "var(--atlas-rule)" },
  evergreen: { fg: "var(--atlas-evergreen)", bg: "oklch(0.78 0.13 160 / 0.10)",        bd: "oklch(0.78 0.13 160 / 0.35)" },
  salmon:    { fg: "var(--atlas-salmon)",   bg: "oklch(0.78 0.13 30 / 0.10)",          bd: "oklch(0.78 0.13 30 / 0.35)" },
  tidal:     { fg: "var(--atlas-tidal)",    bg: "oklch(0.80 0.12 200 / 0.10)",         bd: "oklch(0.80 0.12 200 / 0.35)" },
  amber:     { fg: "var(--atlas-amber)",    bg: "oklch(0.82 0.14 75 / 0.10)",          bd: "oklch(0.82 0.14 75 / 0.35)" },
  crimson:   { fg: "var(--atlas-crimson)",  bg: "oklch(0.68 0.18 25 / 0.12)",          bd: "oklch(0.68 0.18 25 / 0.35)" },
};

export function Chip({ children, tone = "default", className, dot = false }: ChipProps) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1",
        "font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
        "border",
        className,
      )}
      style={{ color: t.fg, background: t.bg, borderColor: t.bd }}
    >
      {dot && (
        <span
          aria-hidden
          className="inline-block size-[5px] rounded-full"
          style={{ background: t.fg }}
        />
      )}
      {children}
    </span>
  );
}
