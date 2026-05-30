import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A small editorial brandmark for the top-left of the page.
 *
 *   ◭  SEATTLE / SPATIAL ATLAS         CBSA · 42660
 *
 * The triangle glyph is an SVG; the type is composed in Geist/JetBrains.
 * Kept compact so it sits comfortably next to the hero.
 */
export function Brandmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Glyph />
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--atlas-ink)]">
          Seattle / Spatial Atlas
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--atlas-ink-subtle)]">
          CBSA · 42660 · WA
        </span>
      </div>
    </div>
  );
}

function Glyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-[var(--atlas-tidal)]"
      aria-hidden
    >
      {/* A stylised mountain + horizon — Mt Rainier silhouette by way of
          a topographic abstraction. */}
      <path
        d="M2 18.5L9 8L12.5 12.5L15.5 9L22 18.5H2Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M2 18.5H22"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
