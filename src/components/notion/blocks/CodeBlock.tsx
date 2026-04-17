"use client";

import { BlockWrapper } from "./BlockWrapper";

interface CodeBlockProps {
  readonly content?: string;
  readonly language?: string;
  readonly onChange?: (value: string) => void;
}

export function CodeBlock({ content = "", language = "plain text", onChange }: CodeBlockProps) {
  return (
    <BlockWrapper>
      <div className="rounded-notion-md bg-[var(--notion-sidebar)] border border-[var(--notion-border)] overflow-hidden">
        {/* Language badge */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--notion-border)]">
          <span className="text-[12px] text-[var(--notion-text-2)] font-notion-mono">{language}</span>
        </div>
        {/* Code content */}
        <div
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className="notion-block w-full px-4 py-3 text-[14px] leading-[1.6] font-notion-mono text-[var(--notion-text)] outline-none cursor-text break-all whitespace-pre-wrap"
          data-placeholder="// Write your code here..."
          onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </BlockWrapper>
  );
}
