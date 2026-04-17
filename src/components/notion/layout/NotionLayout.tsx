"use client";

import { useState } from "react";
import { NotionSidebar } from "./NotionSidebar";
import { NotionTopbar } from "./NotionTopbar";

interface NotionLayoutProps {
  readonly children: React.ReactNode;
  readonly workspaceName?: string;
  readonly userInitial?: string;
  readonly breadcrumbs?: string[];
  readonly pageTitle?: string;
}

export function NotionLayout({
  children,
  workspaceName,
  userInitial,
  breadcrumbs,
  pageTitle,
}: NotionLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDark = () => setDarkMode((v) => !v);

  return (
    <div
      className={`notion-root flex h-screen w-screen overflow-hidden bg-[var(--notion-bg)] font-notion ${
        darkMode ? "dark" : ""
      }`}
    >
      {/* Sidebar */}
      <NotionSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        workspaceName={workspaceName}
        userInitial={userInitial}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-[var(--notion-bg)]">
        {/* Topbar */}
        <NotionTopbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(true)}
          breadcrumbs={breadcrumbs}
          pageTitle={pageTitle}
          darkMode={darkMode}
          onToggleDark={toggleDark}
        />

        {/* Page content */}
        <main className="notion-content flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
