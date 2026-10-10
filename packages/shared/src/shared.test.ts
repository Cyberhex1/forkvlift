import { describe, expect, it } from "vitest";
import { buildPath, buildQuery, describeLicense, ListProjectsQuery, NO_LICENSE_DISCLAIMER } from "./index";

describe("contract helpers", () => {
  it("fills and encodes path params", () => {
    expect(buildPath("/api/projects/:slug/vote", { slug: "a b" })).toBe("/api/projects/a%20b/vote");
    expect(() => buildPath("/api/projects/:slug", {})).toThrow();
  });

  it("serializes queries the way the worker parses them", () => {
    const qs = buildQuery({ stage: ["wip", "finished"], showUnlicensed: false, q: "", sort: "newest" });
    expect(qs).toBe("?stage=wip%2Cfinished&showUnlicensed=false&sort=newest");
    const parsed = ListProjectsQuery.parse(Object.fromEntries(new URLSearchParams(qs)));
    expect(parsed).toMatchObject({ stage: ["wip", "finished"], showUnlicensed: false, sort: "newest" });
  });
});

describe("licenses", () => {
  it("treats missing licenses as none", () => {
    expect(describeLicense(null)).toBeNull();
    expect(describeLicense("NONE")).toBeNull();
    expect(describeLicense("NOASSERTION")?.name).toBe("Custom license");
  });
  it("flags copyleft", () => {
    expect(describeLicense("GPL-3.0-only")?.copyleft).toBe(true);
    expect(describeLicense("MIT")?.copyleft).toBe(false);
  });
  it("keeps the exact disclaimer wording", () => {
    expect(NO_LICENSE_DISCLAIMER.title).toBe("No license: all rights reserved.");
    expect(NO_LICENSE_DISCLAIMER.body).toContain("This is general information, not legal advice.");
  });
});
