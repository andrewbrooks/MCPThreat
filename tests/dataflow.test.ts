import { describe, expect, it } from "vitest";
import { parseDataflow, serializeDataflow, type Dataflow } from "@/lib/dataflow";

const valid: Dataflow = {
  nodes: [
    { id: "a", label: "Agent", type: "external_entity", tier: 0 },
    { id: "s", label: "Server", type: "process", tier: 1 },
  ],
  edges: [{ id: "e1", from: "a", to: "s", label: "call", crossesBoundary: true }],
};

describe("parseDataflow", () => {
  it("returns null for empty/absent input", () => {
    expect(parseDataflow(null)).toBeNull();
    expect(parseDataflow("")).toBeNull();
  });

  it("returns null for non-JSON", () => {
    expect(parseDataflow("{not json")).toBeNull();
  });

  it("returns null when the shape is invalid", () => {
    expect(parseDataflow(JSON.stringify({ nodes: [{ id: "x" }], edges: [] }))).toBeNull();
  });

  it("round-trips a valid dataflow", () => {
    const parsed = parseDataflow(serializeDataflow(valid));
    expect(parsed?.nodes).toHaveLength(2);
    expect(parsed?.edges).toHaveLength(1);
    expect(parsed?.edges[0].crossesBoundary).toBe(true);
  });

  it("drops edges that reference unknown nodes (no dangling arrows)", () => {
    const withDangling: Dataflow = {
      nodes: valid.nodes,
      edges: [
        ...valid.edges,
        { id: "e2", from: "a", to: "ghost", label: "", crossesBoundary: false },
      ],
    };
    const parsed = parseDataflow(JSON.stringify(withDangling));
    expect(parsed?.edges).toHaveLength(1);
    expect(parsed?.edges[0].id).toBe("e1");
  });
});
