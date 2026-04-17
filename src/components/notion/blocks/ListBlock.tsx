"use client";

import { BlockWrapper } from "./BlockWrapper";

interface BulletListItemProps {
  readonly content?: string;
  readonly placeholder?: string;
  readonly depth?: number;
  readonly onChange?: (value: string) => void;
}

export function BulletListBlock({
  content = "",
  placeholder = "List",
  depth = 0,
  onChange,
}: BulletListItemProps) {
  const indent = depth * 24;

  return (
    <BlockWrapper>
      <div className="flex items-start gap-[6px]" style={{ paddingLeft: `${indent}px` }}>
        {/* Bullet dot */}
        <span
          className="flex-shrink-0 w-[24px] flex items-center justify-center text-[var(--notion-text-2)] select-none leading-[1.6] text-[16px]"
          aria-hidden
        >
          •
        </span>
        <div
          contentEditable
          suppressContentEditableWarning
          className="notion-block flex-1 text-[16px] leading-[1.6] text-[var(--notion-text)] outline-none cursor-text break-words"
          data-placeholder={placeholder}
          onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </BlockWrapper>
  );
}

interface NumberedListBlockProps {
  readonly content?: string;
  readonly placeholder?: string;
  readonly index?: number;
  readonly depth?: number;
  readonly onChange?: (value: string) => void;
}

export function NumberedListBlock({
  content = "",
  placeholder = "List",
  index = 1,
  depth = 0,
  onChange,
}: NumberedListBlockProps) {
  const indent = depth * 24;

  return (
    <BlockWrapper>
      <div className="flex items-start gap-[6px]" style={{ paddingLeft: `${indent}px` }}>
        <span className="flex-shrink-0 w-[24px] text-right text-[var(--notion-text-2)] select-none leading-[1.6] text-[16px]">
          {index}.
        </span>
        <div
          contentEditable
          suppressContentEditableWarning
          className="notion-block flex-1 text-[16px] leading-[1.6] text-[var(--notion-text)] outline-none cursor-text break-words"
          data-placeholder={placeholder}
          onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </BlockWrapper>
  );
}
