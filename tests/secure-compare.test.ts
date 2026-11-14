import { describe, expect, it } from "vitest";
import { safeEqual } from "@/lib/secure-compare";

describe("safeEqual", () => {
  it("is true only for identical strings", () => {
    expect(safeEqual("s3cret-value", "s3cret-value")).toBe(true);
    expect(safeEqual("s3cret-value", "s3cret-valuf")).toBe(false);
  });

  it("handles different lengths without throwing", () => {
    expect(safeEqual("short", "a much longer value")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });

  it("treats the empty string as equal only to itself", () => {
    expect(safeEqual("", "")).toBe(true);
  });

  it("is case sensitive and does not trim", () => {
    expect(safeEqual("Token", "token")).toBe(false);
    expect(safeEqual("token", "token ")).toBe(false);
  });
});
