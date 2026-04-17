"use client";

import { BlockWrapper } from "./BlockWrapper";

interface QuoteBlockProps {
  readonly content?: string;
  readonly placeholder?: string;
  readonly onChange?: (value: string) => void;
}

export function QuoteBlock({ content = "", placeholder = "Quote", onChange }: QuoteBlockProps) {
  return (
    <BlockWrapper>
      <div
        contentEditable
        suppressContentEditableWarning
        className={`notion-block w-full text-[16px] leading-[1.6] text-[var(--notion-text)] font-medium outline-none cursor-text break-words border-l-[3px] border-notion-text pl-4`}
        data-placeholder={placeholder}
        onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </BlockWrapper>
  );
}
