import { Suspense } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import CommandPalette from "@/components/dashboard/CommandPalette";
import ProjectProvider from "@/components/dashboard/ProjectProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProjectProvider>
      <div className="flex h-screen overflow-hidden bg-white">
        {/* Sidebar uses useSearchParams; wrap in Suspense so statically
            prerendered dashboard pages (e.g. /dashboard/settings) build. */}
        <Suspense fallback={<div className="w-64 shrink-0 border-r border-gray-200" />}>
          <Sidebar />
        </Suspense>
        <main className="flex-1 overflow-y-auto">{children}</main>
        <CommandPalette />
      </div>
    </ProjectProvider>
  );
}
