"use client";

import { BlockWrapper } from "./BlockWrapper";

type CalloutColor = "gray" | "blue" | "green" | "yellow" | "red" | "purple";

interface CalloutBlockProps {
  readonly icon?: string;
  readonly content?: string;
  readonly color?: CalloutColor;
  readonly onChange?: (value: string) => void;
}

const COLOR_CLASSES: Record<CalloutColor, string> = {
  gray: "bg-[rgba(241,241,239,1)] dark:bg-[rgba(47,47,47,1)]",
  blue: "bg-[rgba(231,243,248,1)] dark:bg-[rgba(20,58,86,0.5)]",
  green: "bg-[rgba(237,243,236,1)] dark:bg-[rgba(15,79,55,0.4)]",
  yellow: "bg-[rgba(251,243,219,1)] dark:bg-[rgba(79,64,15,0.4)]",
  red: "bg-[rgba(253,235,236,1)] dark:bg-[rgba(100,20,20,0.4)]",
  purple: "bg-[rgba(244,240,247,1)] dark:bg-[rgba(60,20,80,0.4)]",
};

export function CalloutBlock({
  icon = "💡",
  content = "",
  color = "gray",
  onChange,
}: Readonly<CalloutBlockProps>) {
  const colorCls = COLOR_CLASSES[color];
  return (
    <BlockWrapper>
      <div
        className={"flex items-start gap-3 px-4 py-3 rounded-notion-md " + colorCls}
      >
        <span className="flex-shrink-0 text-[18px] leading-[1.6] select-none">
          {icon}
        </span>
        <div
          contentEditable
          suppressContentEditableWarning
          className="notion-block flex-1 text-[16px] leading-[1.6] text-[var(--notion-text)] outline-none cursor-text break-words"
          data-placeholder="Type something..."
          onInput={(e) => onChange?.((e.currentTarget.textContent ?? ""))}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </BlockWrapper>
  );
}
