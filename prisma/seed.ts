import { PrismaClient, Role, FileType, RuleScope } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password", 10);

  // Demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@teskel.dev" },
    update: {
      preferences: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      },
    },
    create: {
      email: "demo@teskel.dev",
      name: "Demo User",
      passwordHash,
      preferences: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      },
    },
  });

  // Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-workspace" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo-workspace",
      ownerId: user.id,
    },
  });

  // Workspace member (OWNER)
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: { role: Role.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: Role.OWNER,
    },
  });

  // Project
  const project = await prisma.project.upsert({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: "demo-project" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: "Demo Project",
      slug: "demo-project",
      description: "A demo project for Teskel.",
      storageKey: "demo-project",
      defaultBranch: "main",
    },
  });

  // File nodes
  const srcFolder = await prisma.fileNode.upsert({
    where: { projectId_path: { projectId: project.id, path: "src" } },
    update: {},
    create: {
      projectId: project.id,
      type: FileType.FOLDER,
      name: "src",
      path: "src",
    },
  });

  const indexContent = 'export function main() {\n  console.log("Hello from Teskel!");\n}\n';
  await prisma.fileNode.upsert({
    where: { projectId_path: { projectId: project.id, path: "src/index.ts" } },
    update: { content: indexContent, size: indexContent.length },
    create: {
      projectId: project.id,
      parentId: srcFolder.id,
      type: FileType.FILE,
      name: "index.ts",
      path: "src/index.ts",
      language: "typescript",
      content: indexContent,
      size: indexContent.length,
    },
  });

  const readmeContent = "# Demo Project\n\nThis is a demo project seeded for Teskel.\n";
  await prisma.fileNode.upsert({
    where: { projectId_path: { projectId: project.id, path: "README.md" } },
    update: { content: readmeContent, size: readmeContent.length },
    create: {
      projectId: project.id,
      type: FileType.FILE,
      name: "README.md",
      path: "README.md",
      language: "markdown",
      content: readmeContent,
      size: readmeContent.length,
    },
  });

  // Global rules (idempotent via deterministic ids)
  await prisma.rule.upsert({
    where: { id: "seed-rule-style" },
    update: {},
    create: {
      id: "seed-rule-style",
      scope: RuleScope.GLOBAL,
      title: "Follow existing code style",
      content: "Always match the existing project conventions, formatting, and naming patterns.",
      enabled: true,
    },
  });

  await prisma.rule.upsert({
    where: { id: "seed-rule-tests" },
    update: {},
    create: {
      id: "seed-rule-tests",
      scope: RuleScope.GLOBAL,
      title: "Write tests for new behavior",
      content: "Add or update tests when introducing new features or fixing bugs.",
      enabled: true,
    },
  });

  console.log("Seed complete. Demo user: demo@teskel.dev / password");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });