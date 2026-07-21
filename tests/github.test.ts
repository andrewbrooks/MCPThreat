import { describe, expect, it } from "vitest";
import { GithubError, parseRepoUrl } from "@/lib/github";

// The analysis pipeline is host-locked to github.com. parseRepoUrl is the guard
// that enforces it and normalizes owner/repo.
describe("parseRepoUrl", () => {
  it("parses a standard repo URL", () => {
    expect(parseRepoUrl("https://github.com/owner/repo")).toEqual({ owner: "owner", repo: "repo" });
  });

  it("strips a trailing .git and extra path segments", () => {
    expect(parseRepoUrl("https://github.com/acme/widgets.git")).toEqual({
      owner: "acme",
      repo: "widgets",
    });
    expect(parseRepoUrl("https://github.com/acme/widgets/tree/main")).toEqual({
      owner: "acme",
      repo: "widgets",
    });
  });

  it("accepts the www host", () => {
    expect(parseRepoUrl("https://www.github.com/a/b")).toEqual({ owner: "a", repo: "b" });
  });

  it("rejects non-github hosts (host lock)", () => {
    for (const url of [
      "https://gitlab.com/a/b",
      "https://evil.com/github.com/a/b",
      "https://github.com.evil.com/a/b",
      "https://raw.githubusercontent.com/a/b",
    ]) {
      expect(() => parseRepoUrl(url), url).toThrow(GithubError);
    }
  });

  it("rejects URLs without an owner/repo", () => {
    expect(() => parseRepoUrl("https://github.com/owner")).toThrow(GithubError);
    expect(() => parseRepoUrl("https://github.com/")).toThrow(GithubError);
  });

  it("rejects owner/repo with unsafe characters", () => {
    expect(() => parseRepoUrl("https://github.com/../secrets")).toThrow(GithubError);
  });

  it("rejects a non-URL string", () => {
    expect(() => parseRepoUrl("owner/repo")).toThrow(GithubError);
  });
});
