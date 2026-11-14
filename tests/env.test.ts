import { describe, expect, it } from "vitest";
import { assertProductionEnv, productionEnvProblems } from "@/lib/env";

const GOOD = {
  NEXTAUTH_SECRET: "a".repeat(44),
  NEXTAUTH_URL: "https://mcpthreat.example.com",
  DATABASE_URL: "postgresql://u:p@db/mcpthreat",
};

describe("productionEnvProblems", () => {
  it("accepts a complete configuration", () => {
    expect(productionEnvProblems(GOOD)).toEqual([]);
  });

  it("rejects a missing or blank secret and says how to fix it", () => {
    for (const secret of [undefined, "", "   "]) {
      const p = productionEnvProblems({ ...GOOD, NEXTAUTH_SECRET: secret });
      expect(p).toHaveLength(1);
      expect(p[0]).toMatch(/NEXTAUTH_SECRET is not set.*openssl rand -base64 32/);
    }
  });

  it("rejects the placeholder from .env.example", () => {
    const p = productionEnvProblems({ ...GOOD, NEXTAUTH_SECRET: "change-me-in-production" });
    expect(p[0]).toMatch(/placeholder/);
  });

  it("rejects a short secret and reports its length", () => {
    const p = productionEnvProblems({ ...GOOD, NEXTAUTH_SECRET: "short" });
    expect(p[0]).toMatch(/too short \(5 characters; need at least 32\)/);
  });

  it("requires NEXTAUTH_URL unless the platform provides one", () => {
    expect(productionEnvProblems({ ...GOOD, NEXTAUTH_URL: undefined })[0]).toMatch(/NEXTAUTH_URL/);
    expect(
      productionEnvProblems({ ...GOOD, NEXTAUTH_URL: undefined, VERCEL_URL: "x.vercel.app" }),
    ).toEqual([]);
  });

  it("requires DATABASE_URL", () => {
    expect(productionEnvProblems({ ...GOOD, DATABASE_URL: "" })[0]).toMatch(/DATABASE_URL/);
  });

  it("reports every problem at once", () => {
    expect(productionEnvProblems({})).toHaveLength(3);
  });
});

describe("assertProductionEnv", () => {
  it("does nothing outside production", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: "test" })).not.toThrow();
  });

  it("does nothing while next build collects pages", () => {
    expect(() =>
      assertProductionEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }),
    ).not.toThrow();
  });

  it("throws in production with every problem listed", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production" })).toThrow(
      /NEXTAUTH_SECRET[\s\S]*NEXTAUTH_URL[\s\S]*DATABASE_URL/,
    );
  });

  it("passes in production with a good configuration", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production", ...GOOD })).not.toThrow();
  });
});
