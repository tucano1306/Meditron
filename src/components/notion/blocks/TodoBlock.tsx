"use client";

import { useState } from "react";
import { BlockWrapper } from "./BlockWrapper";

interface TodoBlockProps {
  readonly content?: string;
  readonly checked?: boolean;
  readonly placeholder?: string;
  readonly onChange?: (value: string) => void;
  readonly onToggle?: (checked: boolean) => void;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" aria-hidden="true">
      <polyline
        points="1.5,6 4.5,9 10.5,3"
        fill="none"
        stroke="var(--notion-bg)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TodoBlock({
  content = "",
  checked = false,
  placeholder = "To-do",
  onChange,
  onToggle,
}: Readonly<TodoBlockProps>) {
  const [done, setDone] = useState(checked);

  const toggle = () => {
    setDone((v) => {
      onToggle?.(!v);
      return !v;
    });
  };

  const bgColor = done ? "var(--notion-text)" : "transparent";
  const borderColor = done ? "var(--notion-text)" : undefined;
  const textCls = done
    ? "text-[var(--notion-text-2)] line-through"
    : "text-[var(--notion-text)]";

  return (
    <BlockWrapper>
      <div className="flex items-start gap-[8px]">
        <button
          className="flex-shrink-0 w-[18px] h-[18px] mt-[3px] rounded-notion border-2 border-[var(--notion-border-2)] flex items-center justify-center transition-colors hover:border-[var(--notion-text-2)] focus:outline-none"
          style={{ backgroundColor: bgColor, borderColor }}
          onClick={toggle}
          aria-label={done ? "Mark incomplete" : "Mark complete"}
        >
          {done && <CheckIcon />}
        </button>

        <div
          contentEditable
          suppressContentEditableWarning
          className={"notion-block flex-1 text-[16px] leading-[1.6] outline-none cursor-text break-words transition-colors " + textCls}
          data-placeholder={placeholder}
          onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </BlockWrapper>
  );
}
