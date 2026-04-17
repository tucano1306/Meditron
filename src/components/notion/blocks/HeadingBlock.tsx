"use client";

import { BlockWrapper } from "./BlockWrapper";

interface HeadingBlockProps {
  readonly level: 1 | 2 | 3;
  readonly content?: string;
  readonly placeholder?: string;
  readonly onChange?: (value: string) => void;
}

const LEVEL_STYLES: Record<1 | 2 | 3, { tag: "h1" | "h2" | "h3"; cls: string; offset: string }> = {
  1: {
    tag: "h1",
    cls: "text-[40px] font-bold leading-[1.2] tracking-[-0.02em] mt-[2px] mb-1",
    offset: "top-[6px]",
  },
  2: {
    tag: "h2",
    cls: "text-[30px] font-bold leading-[1.3] tracking-[-0.01em] mt-[1.4em] mb-px",
    offset: "top-[5px]",
  },
  3: {
    tag: "h3",
    cls: "text-[20px] font-semibold leading-[1.3] mt-[1em] mb-px",
    offset: "top-[2px]",
  },
};

export function HeadingBlock({
  level,
  content = "",
  placeholder,
  onChange,
}: HeadingBlockProps) {
  const { tag: Tag, cls, offset } = LEVEL_STYLES[level];
  const ph = placeholder ?? `Heading ${level}`;

  return (
    <BlockWrapper handleOffset={offset}>
      <Tag
        contentEditable
        suppressContentEditableWarning
        className={`notion-block w-full text-[var(--notion-text)] outline-none cursor-text break-words ${cls}`}
        data-placeholder={ph}
        onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </BlockWrapper>
  );
}
