import { describe, expect, it } from "vitest";
import { computeHealth, HEALTH_WEIGHTS } from "../src/core/projects/health";

const now = Date.parse("2026-10-10T00:00:00Z");
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("computeHealth", () => {
  it("gives full marks to a big, active, established repo", () => {
    const h = computeHealth({ stars: 9000, forks: 3000, contributors: 50, lastCommitAt: daysAgo(1), createdAt: daysAgo(800), now });
    expect(h.score).toBe(100);
  });

  it("scores a brand-new weekend project low but not zero", () => {
    const h = computeHealth({ stars: 0, forks: 0, contributors: 1, lastCommitAt: daysAgo(2), createdAt: daysAgo(3), now });
    expect(h.score).toBeGreaterThan(20);
    expect(h.score).toBeLessThan(40);
    expect(h.breakdown.activity.points).toBe(25);
  });

  it("drops activity points for stale or archived repos", () => {
    const stale = computeHealth({ stars: 100, forks: 10, contributors: 3, lastCommitAt: daysAgo(500), createdAt: daysAgo(900), now });
    expect(stale.breakdown.activity.points).toBe(0);
    const archived = computeHealth({ stars: 100, forks: 10, contributors: 3, lastCommitAt: daysAgo(1), createdAt: daysAgo(900), archived: true, now });
    expect(archived.breakdown.activity.points).toBe(0);
  });

  it("keeps every part within its weight and the parts summing to the score", () => {
    for (const stars of [0, 5, 50, 500, 50_000]) {
      const h = computeHealth({ stars, forks: stars / 10, contributors: stars / 100, lastCommitAt: daysAgo(40), createdAt: daysAgo(200), now });
      for (const [key, part] of Object.entries(h.breakdown)) {
        expect(part.points).toBeLessThanOrEqual(HEALTH_WEIGHTS[key as keyof typeof HEALTH_WEIGHTS]);
      }
      const sum = Object.values(h.breakdown).reduce((s, p) => s + p.points, 0);
      expect(Math.abs(h.score - sum)).toBeLessThanOrEqual(0.5);
    }
  });

  it("handles missing dates", () => {
    expect(computeHealth({ stars: 1, forks: 0, contributors: 0, lastCommitAt: null, createdAt: null, now }).breakdown.activity.points).toBe(0);
  });
});
