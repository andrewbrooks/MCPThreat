// Dataflow diagram (DFD) shape stored as JSON on ThreatModel.dataflow.
//
// Nodes are DFD elements — an external entity (user / third-party), a process
// (the MCP server, a tool handler), or a datastore. `tier` is a 0-based layer
// index used to lay the diagram out left→right (external → process → datastore).
// Edges are labeled dataflows; `crossesBoundary` marks a flow that leaves a trust
// zone (rendered dashed + red in the DFD, mirroring TrustBoundaryMap).
//
// This module is Prisma-free and safe to import from client components.

import { z } from "zod";

export const DATAFLOW_NODE_TYPES = ["external_entity", "process", "datastore"] as const;
export type DataflowNodeType = (typeof DATAFLOW_NODE_TYPES)[number];

export const DATAFLOW_NODE_TYPE_LABELS: Record<DataflowNodeType, string> = {
  external_entity: "External entity",
  process: "Process",
  datastore: "Datastore",
};

const zNode = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  type: z.enum(DATAFLOW_NODE_TYPES),
  tier: z.number().int().min(0).max(12).default(0),
  trustZone: z.string().max(120).optional(),
});

const zEdge = z.object({
  id: z.string().min(1).max(120),
  from: z.string().min(1).max(120),
  to: z.string().min(1).max(120),
  label: z.string().max(200).default(""),
  dataClass: z.string().max(120).optional(),
  crossesBoundary: z.boolean().default(false),
});

export const dataflowSchema = z.object({
  nodes: z.array(zNode).max(60),
  edges: z.array(zEdge).max(120),
});

export type DataflowNode = z.infer<typeof zNode>;
export type DataflowEdge = z.infer<typeof zEdge>;
export type Dataflow = z.infer<typeof dataflowSchema>;

/**
 * Parse the JSON string stored on ThreatModel.dataflow. Returns null on absent or
 * malformed data, and drops edges that reference unknown nodes so the DFD never
 * renders a dangling arrow.
 */
export function parseDataflow(raw: string | null | undefined): Dataflow | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = dataflowSchema.safeParse(json);
  if (!parsed.success) return null;
  const df = parsed.data;
  const ids = new Set(df.nodes.map((n) => n.id));
  const edges = df.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  return { nodes: df.nodes, edges };
}

/** Serialize a validated Dataflow for storage. */
export function serializeDataflow(df: Dataflow): string {
  return JSON.stringify(df);
}
