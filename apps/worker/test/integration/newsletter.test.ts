import { describe, expect, it } from "vitest";
import { forkReportEmail, newsletterConfirmationEmail } from "../../src/email/templates";

describe("Fork Report newsletter email template (task 4.10)", () => {
  it("renders the Fork Report issue email with highlights and stats", () => {
    const email = forkReportEmail({
      issueNumber: 42,
      title: "The Agent Revolution",
      date: "October 2026",
      curatorNote: "Here are the top vibe-coded apps this week.",
      weeklyForkCount: 350,
      highlights: [
        {
          slug: "vibesdk",
          title: "VibeSDK",
          description: "Full-stack vibe coding environment",
          url: "https://forkvlift.com/p/vibesdk",
          author: "cloudflare",
          forks: 120,
          category: "Developer Tools",
        },
      ],
      unsubscribeUrl: "https://forkvlift.com/api/newsletter/unsubscribe?token=abc",
    });

    expect(email.subject).toBe("The Fork Report #42: The Agent Revolution");
    expect(email.html).toContain("The Fork Report #42");
    expect(email.html).toContain("VibeSDK");
    expect(email.html).toContain("350 new forks this week");
    expect(email.html).toContain("https://forkvlift.com/api/newsletter/unsubscribe?token=abc");

    expect(email.text).toContain("The Fork Report #42: The Agent Revolution");
    expect(email.text).toContain("VibeSDK (by @cloudflare)");
    expect(email.text).toContain("https://forkvlift.com/api/newsletter/unsubscribe?token=abc");
  });

  it("renders double opt-in confirmation email", () => {
    const email = newsletterConfirmationEmail({
      confirmUrl: "https://forkvlift.com/api/newsletter/confirm/tok123",
      unsubscribeUrl: "https://forkvlift.com/api/newsletter/unsubscribe?token=tok123",
    });

    expect(email.subject).toContain("Confirm your subscription");
    expect(email.html).toContain("The Fork Report");
    expect(email.html).toContain("https://forkvlift.com/api/newsletter/confirm/tok123");
    expect(email.text).toContain("https://forkvlift.com/api/newsletter/confirm/tok123");
  });
});
