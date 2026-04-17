"use client";

interface DividerBlockProps {
  readonly className?: string;
}

export function DividerBlock({ className = "" }: DividerBlockProps) {
  return (
    <div className={`group relative flex items-center py-[1px] ${className}`}>
      <div className="w-full h-px bg-[var(--notion-border)]" />
    </div>
  );
}
