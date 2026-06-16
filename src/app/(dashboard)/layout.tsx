import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/dashboard/Sidebar";
import CommandPalette from "@/components/dashboard/CommandPalette";
import ProjectProvider from "@/components/dashboard/ProjectProvider";
import ThemeToggle from "@/components/dashboard/ThemeToggle";
import NotificationBell from "@/components/dashboard/NotificationBell";
import ExtensionStatusBar from "@/components/dashboard/ExtensionStatusBar";

// Server-side pre-fetch of the workspace + project state. Without this the
// client `ProjectProvider` was doing a 2-round waterfall on every dashboard
// navigation: client mount -> /api/workspaces -> /api/projects, and every
// child page gated its own useEffect on `loading` going false. Resolving
// the data here (in the layout, in parallel) lets pages render with
// `activeProject` and `activeWorkspace` already populated on the very first
// paint.
async function loadDashboardContext(userId: string) {
  const [memberships, projects, dbUser] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: { _count: { select: { projects: true, members: true } } },
        },
      },
    }),
    prisma.workspaceMember
      .findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { workspaceId: true },
      })
      .then((m) =>
        m
          ? prisma.project.findMany({
              where: { workspaceId: m.workspaceId },
              orderBy: { updatedAt: "desc" },
              take: 25,
              select: {
                id: true,
                name: true,
                slug: true,
                workspaceId: true,
                storageKey: true,
                description: true,
                createdAt: true,
                updatedAt: true,
              },
            })
          : []
      ),
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }),
  ]);

  const workspaces = memberships
    .filter((m) => m.workspace)
    .map((m) => {
      const w = m.workspace;
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        ownerId: w.ownerId,
        role: m.role,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
        memberCount: w._count.members,
        projectCount: w._count.projects,
      };
    });

  const projectsStr = projects.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  const preferences =
    (dbUser?.preferences as Record<string, unknown> | null) ?? {};
  const onboardingCompleted = preferences.onboardingCompleted === true;

  return { workspaces, projects: projectsStr, onboardingCompleted };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const initial = userId
    ? await loadDashboardContext(userId)
    : { workspaces: [], projects: [], onboardingCompleted: true };

  // Server-side onboarding gate: avoid flashing the dashboard for users who
  // haven't completed onboarding (previously done client-side, which
  // triggered a render + client fetch + router.push waterfall).
  if (!initial.onboardingCompleted) {
    redirect("/dashboard/onboarding");
  }

  return (
    <ProjectProvider
      initialWorkspaces={initial.workspaces}
      initialProjects={initial.projects}
    >
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        {/* Sidebar uses useSearchParams; wrap in Suspense so statically
            prerendered dashboard pages (e.g. /dashboard/settings) build. */}
        <Suspense fallback={<div className="w-64 shrink-0 border-r border-[var(--border)]" />}>
          <Sidebar />
        </Suspense>
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#F7F7F5] dark:bg-[#0A0A0A]">
          <header className="absolute right-4 top-4 z-10 flex h-10 items-center justify-end gap-2 rounded-2xl border border-white/60 bg-white/70 px-4 shadow-[0_8px_32px_rgba(17,24,39,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/50">
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
