import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export { prisma };

const tag = () => randomUUID().slice(0, 8);

export interface TestUser {
  id: string;
  email: string;
}

export async function makeUser(label = "user"): Promise<TestUser> {
  const email = `${label}-${tag()}@example.com`;
  const user = await prisma.user.create({ data: { email, name: label } });
  return { id: user.id, email };
}

export interface TestProject {
  id: string;
  name: string;
  boundaryId: string | null;
  vectorId: string | null;
  findingId: string | null;
}

/**
 * A project owned by `owner`. With `complete: true` it has one boundary, one vector and one
 * finding, which is enough to pass the readiness blockers so a snapshot can be issued.
 */
export async function makeProject(
  owner: TestUser,
  opts: { policy?: "OFF" | "SINGLE" | "DUAL"; complete?: boolean; name?: string } = {},
): Promise<TestProject> {
  const name = opts.name ?? `Project ${tag()}`;
  const project = await prisma.project.create({
    data: {
      name,
      description: "Integration test project.",
      ownerId: owner.id,
      acceptancePolicy: opts.policy ?? "OFF",
    },
  });
  if (!opts.complete) return { id: project.id, name, boundaryId: null, vectorId: null, findingId: null };

  const tm = await prisma.threatModel.create({ data: { projectId: project.id } });
  const boundary = await prisma.trustBoundary.create({
    data: { threatModelId: tm.id, label: "Agent to server", type: "LLM_TO_MCP" },
  });
  const vector = await prisma.threatVector.create({
    data: {
      trustBoundaryId: boundary.id,
      title: "Tool poisoning",
      strideCategory: "TAMPERING",
      mcpCategory: "TOOL_POISONING",
      likelihood: "HIGH",
      impact: "HIGH",
    },
  });
  const finding = await prisma.finding.create({
    data: {
      projectId: project.id,
      threatVectorId: vector.id,
      title: "Tool schemas are not pinned",
      description: "Schemas are trusted as-is.",
      recommendation: "Pin them with a hash.",
      severity: "HIGH",
      owner: owner.email,
    },
  });
  return { id: project.id, name, boundaryId: boundary.id, vectorId: vector.id, findingId: finding.id };
}

export async function addMember(
  projectId: string,
  user: TestUser,
  role: "ADMIN" | "MEMBER" | "VIEWER",
  side: "ASSESSOR" | "CLIENT",
): Promise<void> {
  await prisma.projectMember.create({
    data: { projectId, email: user.email, userId: user.id, role, side },
  });
}

/** A Request for a route handler. */
export function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: p });

export async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
