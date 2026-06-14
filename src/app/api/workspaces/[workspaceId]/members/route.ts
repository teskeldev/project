import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ApiError,
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
} from "@/lib/api";
import { sendTeamInviteEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";

const inviteMemberSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await requireUser();
    const { workspaceId } = await params;

    // Verify the current user is a member of this workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });

    if (!membership) {
      throw new ApiError(
        "You are not a member of this workspace",
        403,
        "FORBIDDEN"
      );
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      createdAt: m.createdAt,
    }));

    return apiSuccess({ members: result });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await requireUser();
    const { workspaceId } = await params;
    const { email, role } = await validateBody(req, inviteMemberSchema);

    await enforceRateLimit(`invite:workspace:${workspaceId}`, 20, 60_000);

    // Verify the current user is OWNER or ADMIN
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      throw new ApiError(
        "Only owners and admins can invite members",
        403,
        "FORBIDDEN"
      );
    }

    // Find or create user stub
    let targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!targetUser) {
      targetUser = await prisma.user.create({
        data: { email: email.toLowerCase() },
      });
    }

    // Check if already a member
    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUser.id },
      },
    });

    if (existing) {
      throw new ApiError("User is already a member", 409, "ALREADY_MEMBER");
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: role || "MEMBER",
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Send email invite notification to the user
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const inviter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    // Fire-and-forget: don't block the response on email delivery
    sendTeamInviteEmail(email.toLowerCase(), {
      workspaceName: workspace?.name || "a workspace",
      inviterName: inviter?.name ?? null,
      role: role || "MEMBER",
    }).catch((err) => {
      console.error("[workspace-members] Failed to send invite email:", err);
    });

    return apiSuccess(
      {
        member: {
          id: member.id,
          userId: member.user.id,
          name: member.user.name,
          email: member.user.email,
          image: member.user.image,
          role: member.role,
          createdAt: member.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
