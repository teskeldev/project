import { Suspense } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import CommandPalette from "@/components/dashboard/CommandPalette";
import ProjectProvider from "@/components/dashboard/ProjectProvider";
import ThemeToggle from "@/components/dashboard/ThemeToggle";
import NotificationBell from "@/components/dashboard/NotificationBell";
import ExtensionStatusBar from "@/components/dashboard/ExtensionStatusBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProjectProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        {/* Sidebar uses useSearchParams; wrap in Suspense so statically
            prerendered dashboard pages (e.g. /dashboard/settings) build. */}
        <Suspense fallback={<div className="w-64 shrink-0 border-r border-[var(--border)]" />}>
          <Sidebar />
        </Suspense>
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-10 shrink-0 items-center justify-end gap-2 border-b px-4" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <ThemeToggle />
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
          <Suspense fallback={null}>
            <ExtensionStatusBar />
          </Suspense>
        </div>
        <CommandPalette />
      </div>
    </ProjectProvider>
  );
}
