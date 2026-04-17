"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { BlockWrapper } from "./BlockWrapper";

interface ToggleBlockProps {
  readonly summary?: string;
  readonly children?: React.ReactNode;
  readonly defaultOpen?: boolean;
  readonly onChange?: (value: string) => void;
}

export function ToggleBlock({
  summary = "",
  children,
  defaultOpen = false,
  onChange,
}: ToggleBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <BlockWrapper>
      <div>
        {/* Toggle header */}
        <div className="flex items-start gap-[2px]">
          <button
            className="flex-shrink-0 w-[24px] h-[24px] flex items-center justify-center mt-[1px] rounded-notion text-[var(--notion-text-2)] hover:bg-[var(--notion-hover)] transition-transform duration-150"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <ChevronRight size={16} />
          </button>
          <div
            contentEditable
            suppressContentEditableWarning
            className="notion-block flex-1 text-[16px] leading-[1.6] text-[var(--notion-text)] outline-none cursor-text break-words font-medium"
            data-placeholder="Toggle"
            onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
            dangerouslySetInnerHTML={{ __html: summary }}
          />
        </div>

        {/* Toggle content */}
        {open && (
          <div className="pl-[26px] mt-1 animate-fade-in">
            {children ?? (
              <div className="text-[16px] leading-[1.6] text-[var(--notion-text-2)] italic pl-1">
                Empty toggle. Click to add content.
              </div>
            )}
          </div>
        )}
      </div>
    </BlockWrapper>
  );
}
