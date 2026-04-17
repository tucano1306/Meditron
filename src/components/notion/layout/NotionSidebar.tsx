"use client";

import { useState } from "react";
import {
  Search,
  Home,
  Inbox,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Clock,
  Trash2,
  ChevronsLeft,
  FileText,
  Star,
} from "lucide-react";

interface PageItem {
  readonly id: string;
  readonly icon: string;
  readonly title: string;
  readonly children?: PageItem[];
}

const MOCK_PAGES: PageItem[] = [
  {
    id: "1",
    icon: "🚀",
    title: "Getting Started",
    children: [],
  },
  {
    id: "2",
    icon: "🏗️",
    title: "Projects",
    children: [
      { id: "2-1", icon: "📄", title: "Project Alpha" },
      { id: "2-2", icon: "📄", title: "Project Beta" },
      { id: "2-3", icon: "📄", title: "Project Gamma" },
    ],
  },
  { id: "3", icon: "📝", title: "Meeting Notes" },
  { id: "4", icon: "🎯", title: "Goals & OKRs" },
  { id: "5", icon: "📚", title: "Resources" },
];

function DotGrid() {
  return (
    <svg viewBox="0 0 8 14" className="w-2 h-3.5" fill="currentColor">
      <circle cx="1.5" cy="1.5" r="1.5" />
      <circle cx="6.5" cy="1.5" r="1.5" />
      <circle cx="1.5" cy="7" r="1.5" />
      <circle cx="6.5" cy="7" r="1.5" />
      <circle cx="1.5" cy="12.5" r="1.5" />
      <circle cx="6.5" cy="12.5" r="1.5" />
    </svg>
  );
}

function PageTreeItem({
  item,
  depth = 0,
  selectedId,
  onSelect,
}: Readonly<{
  item: PageItem;
  depth?: number;
  selectedId: string;
  onSelect: (id: string) => void;
}>) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = !!item.children?.length;
  const isSelected = selectedId === item.id;

  let expandIcon: React.ReactNode;
  if (!hasChildren) {
    expandIcon = <ChevronRight size={12} className="opacity-0" />;
  } else if (expanded) {
    expandIcon = <ChevronDown size={12} />;
  } else {
    expandIcon = <ChevronRight size={12} />;
  }

  return (
    <div>
      <button
        type="button"
        className={`notion-block-row group flex items-center w-full h-[27px] rounded-notion cursor-pointer select-none text-left relative ${
          isSelected
            ? "bg-[var(--notion-selected)]"
            : "hover:bg-[var(--notion-hover)]"
        }`}
        style={{ paddingLeft: `${6 + depth * 12}px`, paddingRight: "6px" }}
        onClick={() => onSelect(item.id)}
      >
        {/* Expand/collapse chevron */}
        <button
          className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-notion text-[var(--notion-text-2)] opacity-0 group-hover:opacity-100 hover:bg-[var(--notion-selected)]"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
        >
          {expandIcon}
        </button>

        {/* Page icon */}
        <span className="flex-shrink-0 text-[14px] leading-none mr-[6px]">
          {item.icon}
        </span>

        {/* Title */}
        <span className="flex-1 text-[14px] leading-[1.4] text-[var(--notion-text)] truncate">
          {item.title}
        </span>

        {/* Inline actions (shown on hover) */}
        <div className="notion-handles flex items-center gap-0.5 ml-1">
          <button
            className="w-5 h-5 flex items-center justify-center rounded-notion hover:bg-[var(--notion-selected)] text-[var(--notion-text-2)]"
            onClick={(e) => e.stopPropagation()}
            title="Add page"
          >
            <Plus size={12} />
          </button>
          <button
            className="w-5 h-5 flex items-center justify-center rounded-notion hover:bg-[var(--notion-selected)] text-[var(--notion-text-2)] cursor-grab"
            onClick={(e) => e.stopPropagation()}
          >
            <DotGrid />
          </button>
        </div>
      </button>

      {expanded && hasChildren && (
        <div>
          {(item.children ?? []).map((child) => (
            <PageTreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface NotionSidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly workspaceName?: string;
  readonly userInitial?: string;
  readonly selectedPageId?: string;
  readonly onSelectPage?: (id: string) => void;
}

export function NotionSidebar({
  isOpen,
  onClose,
  workspaceName = "My Workspace",
  userInitial = "W",
  selectedPageId,
  onSelectPage,
}: NotionSidebarProps) {
  const [selected, setSelected] = useState(selectedPageId ?? "1");
  const [activeNav, setActiveNav] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelected(id);
    onSelectPage?.(id);
  };

  const navItems = [
    { icon: <Search size={14} />, label: "Search", shortcut: "⌘K" },
    { icon: <Home size={14} />, label: "Home" },
    { icon: <Inbox size={14} />, label: "Inbox", badge: 3 },
    { icon: <Settings size={14} />, label: "Settings & members" },
  ];

  return (
    <aside
      className={`notion-sidebar flex flex-col h-full bg-[var(--notion-sidebar)] border-r border-[var(--notion-border)] flex-shrink-0 overflow-hidden transition-all duration-200 ${
        isOpen ? "w-[240px]" : "w-0"
      }`}
    >
      <div className="flex flex-col h-full w-[240px]">
        {/* Workspace header */}
        <div className="flex items-center gap-2 px-2 pt-2 pb-1">
          <div
            className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-notion hover:bg-[var(--notion-hover)] cursor-pointer"
            title={workspaceName}
          >
            <div className="w-[22px] h-[22px] rounded-notion bg-gradient-to-br from-gray-500 to-gray-700 dark:from-gray-400 dark:to-gray-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {userInitial}
            </div>
            <span className="flex-1 text-[14px] font-semibold text-[var(--notion-text)] truncate leading-none">
              {workspaceName}
            </span>
            <ChevronDown size={13} className="text-[var(--notion-text-2)] flex-shrink-0" />
          </div>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-2)] flex-shrink-0"
            onClick={onClose}
            title="Close sidebar"
          >
            <ChevronsLeft size={15} />
          </button>
        </div>

        {/* Primary navigation */}
        <div className="px-1 py-0.5 space-y-[1px]">
          {navItems.map(({ icon, label, shortcut, badge }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-2 px-2 h-[27px] rounded-notion text-[14px] text-[var(--notion-text)] transition-none ${
                activeNav === label
                  ? "bg-[var(--notion-selected)]"
                  : "hover:bg-[var(--notion-hover)]"
              }`}
              onClick={() =>
                setActiveNav(activeNav === label ? null : label)
              }
            >
              <span className="w-5 h-5 flex items-center justify-center text-[var(--notion-text-2)] flex-shrink-0">
                {icon}
              </span>
              <span className="flex-1 text-left truncate">{label}</span>
              {shortcut && (
                <span className="text-[11px] text-[var(--notion-text-3)]">
                  {shortcut}
                </span>
              )}
              {badge != null && (
                <span className="text-[10px] font-semibold bg-notion-blue text-white rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="h-px bg-[var(--notion-border)] mx-2 my-1" />

        {/* Favorites section */}
        <div className="px-1">
          <SectionHeader icon={<Star size={10} />} label="Favorites" />
          <p className="text-[12px] text-[var(--notion-text-3)] px-3 py-1">
            No favorites yet
          </p>
        </div>

        <div className="h-px bg-[var(--notion-border)] mx-2 my-1" />

        {/* Private pages */}
        <div className="flex-1 overflow-y-auto px-1 pb-2 notion-sidebar">
          <SectionHeader icon={<FileText size={10} />} label="Private" />
          {MOCK_PAGES.map((page) => (
            <PageTreeItem
              key={page.id}
              item={page}
              selectedId={selected}
              onSelect={handleSelect}
            />
          ))}
          <button className="w-full flex items-center gap-2 px-2 h-[27px] rounded-notion text-[14px] text-[var(--notion-text-2)] hover:bg-[var(--notion-hover)] mt-0.5">
            <Plus size={14} />
            <span>Add a page</span>
          </button>
        </div>

        {/* Bottom nav */}
        <div className="border-t border-[var(--notion-border)] px-1 py-1">
          {[
            { icon: <Clock size={14} />, label: "Recently deleted" },
            { icon: <Trash2 size={14} />, label: "Trash" },
          ].map(({ icon, label }) => (
            <button
              key={label}
              className="w-full flex items-center gap-2 px-2 h-[27px] rounded-notion text-[14px] text-[var(--notion-text)] hover:bg-[var(--notion-hover)]"
            >
              <span className="w-5 h-5 flex items-center justify-center text-[var(--notion-text-2)] flex-shrink-0">
                {icon}
              </span>
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function SectionHeader({
  icon,
  label,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
}>) {
  return (
    <div className="group flex items-center gap-1.5 px-2 h-[24px]">
      <span className="text-[var(--notion-text-2)]">{icon}</span>
      <span className="flex-1 text-[11px] font-semibold text-[var(--notion-text-2)] uppercase tracking-wide">
        {label}
      </span>
      <button className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-notion hover:bg-[var(--notion-hover)] text-[var(--notion-text-2)]">
        <Plus size={11} />
      </button>
    </div>
  );
}
