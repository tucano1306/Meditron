"use client";

import { Plus } from "lucide-react";

function DotGrid() {
  return (
    <svg viewBox="0 0 8 14" className="w-2 h-3.5" fill="currentColor">
      <circle cx="1.5" cy="1.5" r="1.5" />
      <circle cx="6.5" cy="1.5" r="1.5" />
      <circle cx="1.5" cy="7" r="1.5" />
      <circle cx="6.5" cy="7" r="1.5" />
      <circle cx="1.5" cy="12.5" r="1.5" />
      <circle cx="6.5" cy="12.5" r="1.5" />
    </svg>
  );
}

interface BlockWrapperProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly handleOffset?: string;
}

/**
 * Wraps any Notion block with the hover-revealed drag handle and "+" button.
 * The parent page must have enough left padding (pl-14 or more) to show handles.
 */
export function BlockWrapper({
  children,
  className = "",
  handleOffset = "top-[3px]",
}: BlockWrapperProps) {
  return (
    <div
      className={`notion-block-row group relative flex items-start gap-0.5 py-[1px] ${className}`}
    >
      {/* Handles – positioned into the left gutter */}
      <div
        className={`notion-handles absolute -left-12 ${handleOffset} flex items-center gap-0 flex-shrink-0`}
      >
        <button
          className="w-[22px] h-[22px] flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-3)]"
          title="Add block below"
        >
          <Plus size={14} />
        </button>
        <button
          className="w-[22px] h-[22px] flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-3)] cursor-grab"
          title="Drag to move"
        >
          <DotGrid />
        </button>
      </div>

      {/* Block content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
