import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PartySide, ProjectRole } from "@/lib/taxonomy";

// Central authorization. Every project-scoped API route and server component must
// resolve access through requireProjectAccess so a user can only ever read or mutate
// projects they own or are a member of — closing the confused-deputy gap where a
// server acts with ambient authority instead of the requester's.

export class AuthzError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

const WRITE_ROLES: ProjectRole[] = ["OWNER", "ADMIN", "MEMBER"];

export interface ProjectAccess {
  project: Awaited<ReturnType<typeof loadProject>>;
  role: ProjectRole;
  isOwner: boolean;
  side: PartySide;
}

async function loadProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true, threatModel: true },
  });
}

/**
 * Assert the authenticated user may access a project.
 * @throws AuthzError 401 if not signed in, 404 if the project is missing or not
 *   visible to the user (404 rather than 403 to avoid leaking existence), or 403
 *   when `write` is required but the user only has viewer access.
 */
export async function requireProjectAccess(
  userId: string | null,
  projectId: string,
  opts: { write?: boolean } = {},
): Promise<ProjectAccess> {
  if (!userId) throw new AuthzError(401, "Authentication required.");

  const [user, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    loadProject(projectId),
  ]);

  if (!project) throw new AuthzError(404, "Project not found.");

  const isOwner = project.ownerId === userId;
  const membership = project.members.find(
    (m) => m.userId === userId || (user?.email && m.email.toLowerCase() === user.email.toLowerCase()),
  );

  if (!isOwner && !membership) throw new AuthzError(404, "Project not found.");

  const role: ProjectRole = isOwner ? "OWNER" : ((membership?.role as ProjectRole) ?? "VIEWER");
  const side: PartySide = isOwner ? "ASSESSOR" : ((membership?.side as PartySide) ?? "ASSESSOR");

  if (opts.write && !WRITE_ROLES.includes(role)) {
    throw new AuthzError(403, "You do not have permission to modify this project.");
  }

  return { project, role, isOwner, side };
}

/** Map thrown errors (AuthzError or otherwise) to a JSON NextResponse. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AuthzError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("Unhandled route error:", err);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}
