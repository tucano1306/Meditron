"use client";

import {
  ChevronsRight,
  ChevronRight,
  Star,
  MessageSquare,
  Share2,
  MoreHorizontal,
  Moon,
  Sun,
  Clock,
} from "lucide-react";

interface NotionTopbarProps {
  readonly sidebarOpen: boolean;
  readonly onToggleSidebar: () => void;
  readonly breadcrumbs?: string[];
  readonly pageTitle?: string;
  readonly darkMode: boolean;
  readonly onToggleDark: () => void;
}

export function NotionTopbar({
  sidebarOpen,
  onToggleSidebar,
  breadcrumbs = [],
  pageTitle = "Untitled",
  darkMode,
  onToggleDark,
}: NotionTopbarProps) {
  return (
    <div className="h-[45px] flex items-center px-3 gap-1 border-b border-[var(--notion-border)] bg-[var(--notion-bg)] flex-shrink-0 z-10">
      {/* Sidebar toggle (only when collapsed) */}
      {!sidebarOpen && (
        <div className="flex items-center gap-0.5 mr-1">
          <button
            className="w-[26px] h-[26px] flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-2)]"
            onClick={onToggleSidebar}
            title="Open sidebar"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 flex-1 overflow-hidden min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={`${crumb}-${i}`} className="flex items-center gap-0.5 flex-shrink-0">
            <button className="flex items-center gap-1 h-[26px] px-1.5 rounded-notion hover:bg-[var(--notion-hover)] text-[14px] text-[var(--notion-text-2)] truncate max-w-[160px]">
              {crumb}
            </button>
            <ChevronRight
              size={12}
              className="text-[var(--notion-text-3)] flex-shrink-0"
            />
          </span>
        ))}
        <button className="flex items-center gap-1.5 h-[26px] px-1.5 rounded-notion hover:bg-[var(--notion-hover)] text-[14px] font-medium text-[var(--notion-text)] truncate max-w-[240px]">
          {pageTitle}
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          className="w-[26px] h-[26px] flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-2)]"
          onClick={onToggleDark}
          title={darkMode ? "Light mode" : "Dark mode"}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          className="w-[26px] h-[26px] flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-2)]"
          title="Updates & notifications"
        >
          <Clock size={15} />
        </button>
        <button
          className="w-[26px] h-[26px] flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-2)]"
          title="Favorite"
        >
          <Star size={15} />
        </button>
        <button
          className="w-[26px] h-[26px] flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-2)]"
          title="Comments"
        >
          <MessageSquare size={15} />
        </button>

        <button className="flex items-center gap-1.5 h-[26px] px-2.5 ml-1 rounded-notion hover:bg-[var(--notion-hover)] text-[13px] font-medium text-[var(--notion-text)] border border-[var(--notion-border-2)]">
          <Share2 size={12} />
          Share
        </button>

        <button
          className="w-[26px] h-[26px] flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-2)]"
          title="More options"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>
    </div>
  );
}
