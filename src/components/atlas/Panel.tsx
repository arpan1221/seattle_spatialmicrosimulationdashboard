import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Atlas Panel — the canonical surface for sections in the dashboard.
 * Differs from shadcn Card in that it uses sharper corners, no shadow,
 * and a hairline border that matches the editorial atlas language.
 */
export function Panel({
  className, children, ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      {...rest}
      className={cn(
        "relative rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-surface)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

type PanelHeaderProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  sectionNo?: string;        // e.g. "§ 01"
  eyebrow?: string;          // e.g. "Spatial autocorrelation"
  title: React.ReactNode;    // headline
  description?: React.ReactNode;
  trailing?: React.ReactNode;
};

export function PanelHeader({
  sectionNo, eyebrow, title, description, trailing,
  className, ...rest
}: PanelHeaderProps) {
  return (
    <header
      {...rest}
      className={cn(
        "flex flex-wrap items-start justify-between gap-4 border-b border-[var(--atlas-rule)] px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        {(sectionNo || eyebrow) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {sectionNo && <span className="atlas-section-no">{sectionNo}</span>}
            {eyebrow && <span className="atlas-eyebrow">{eyebrow}</span>}
          </div>
        )}
        <h2 className="font-display text-[19px] font-medium tracking-tight text-[var(--atlas-ink)]">
          {title}
        </h2>
        {description && (
          <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-[var(--atlas-ink-dim)]">
            {description}
          </p>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </header>
  );
}

export function PanelBody({
  className, children, ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("px-5 py-5", className)}>
      {children}
    </div>
  );
}
