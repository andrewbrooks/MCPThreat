import type { ZodSchema } from "zod";
import { AuthzError } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Parse and validate a JSON request body, throwing AuthzError(400) on failure. */
export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AuthzError(400, "Invalid JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join(".");
    throw new AuthzError(400, `Validation failed${path ? ` for "${path}"` : ""}: ${first?.message ?? "invalid input"}`);
  }
  return parsed.data;
}

/** Ensure a project has a ThreatModel and return its id. */
export async function ensureThreatModelId(projectId: string): Promise<string> {
  const existing = await prisma.threatModel.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.threatModel.create({
    data: { projectId },
    select: { id: true },
  });
  return created.id;
}

/** Normalize a validated dueDate ("" | null | ISO string) to Date | null. */
export function normalizeDueDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined; // not provided -> leave unchanged
  if (value === null || value === "") return null;
  return new Date(value);
}

/** Given a review interval in days (or null), compute the next review date from now. */
export function computeReviewDue(intervalDays: number | null | undefined): Date | null {
  if (!intervalDays) return null;
  return new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
}

/** Given a reminder interval in days (or null), compute the next reminder time from now. */
export function computeReminderNext(intervalDays: number | null | undefined): Date | null {
  if (!intervalDays) return null;
  return new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
}

// The following guards prevent cross-project tampering: a child resource id from
// the URL must actually belong to the project the caller was authorized against.

export async function assertBoundaryInProject(boundaryId: string, projectId: string) {
  const boundary = await prisma.trustBoundary.findUnique({
    where: { id: boundaryId },
    select: { threatModel: { select: { projectId: true } } },
  });
  if (!boundary || boundary.threatModel.projectId !== projectId) {
    throw new AuthzError(404, "Trust boundary not found in this project.");
  }
}

export async function assertVectorInProject(vectorId: string, projectId: string) {
  const vector = await prisma.threatVector.findUnique({
    where: { id: vectorId },
    select: { trustBoundary: { select: { threatModel: { select: { projectId: true } } } } },
  });
  if (!vector || vector.trustBoundary.threatModel.projectId !== projectId) {
    throw new AuthzError(404, "Threat vector not found in this project.");
  }
}

export async function assertFindingInProject(findingId: string, projectId: string) {
  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    select: { projectId: true },
  });
  if (!finding || finding.projectId !== projectId) {
    throw new AuthzError(404, "Finding not found in this project.");
  }
}
