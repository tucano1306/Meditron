"use client";

import { BlockWrapper } from "./BlockWrapper";

interface TextBlockProps {
  readonly content?: string;
  readonly placeholder?: string;
  readonly onChange?: (value: string) => void;
  readonly className?: string;
}

export function TextBlock({
  content = "",
  placeholder = "Type '/' for commands",
  onChange,
  className = "",
}: TextBlockProps) {
  return (
    <BlockWrapper>
      <div
        contentEditable
        suppressContentEditableWarning
        className={`notion-block w-full text-[16px] leading-[1.6] text-[var(--notion-text)] outline-none cursor-text break-words ${className}`}
        data-placeholder={placeholder}
        onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </BlockWrapper>
  );
}
