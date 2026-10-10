import { describe, expect, it } from "vitest";
import { NotificationType } from "@forkvlift/shared";
import { magicLinkEmail, notificationEmail, weeklyDigest } from "../src/email/templates";

const settingsUrl = "https://forklift.example/settings";

describe("email templates", () => {
  it.each(NotificationType.options)("renders %s with subject, html, text and a settings link", (type) => {
    const e = notificationEmail({ type, title: "fx-ada did a thing", url: "https://forklift.example/p/x", settingsUrl });
    expect(e.subject).toBe("fx-ada did a thing");
    expect(e.html).toContain("https://forklift.example/p/x");
    expect(e.html).toContain(settingsUrl);
    expect(e.text).toContain(settingsUrl);
  });

  it("escapes user text everywhere", () => {
    const e = notificationEmail({ type: "comment", title: `<script>alert("x")</script>`, url: `https://x.example/?a=1&b="2"`, settingsUrl });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).toContain("&amp;b=&quot;2&quot;");
    const d = weeklyDigest([{ title: "<b>bold</b>", url: "https://x.example" }], settingsUrl);
    expect(d.html).not.toContain("<b>bold</b>");
  });

  it("counts digest items and keeps a plain-text version", () => {
    const d = weeklyDigest([{ title: "One", url: "https://a" }, { title: "Two", url: "https://b" }], settingsUrl);
    expect(d.subject).toBe("Your week on ForkLift: 2 updates");
    expect(d.text).toContain("- One\n  https://a");
  });

  it("explains the magic link", () => {
    const m = magicLinkEmail("https://forklift.example/api/auth/magic-link/verify?token=t", settingsUrl);
    expect(m.text).toContain("expires in 15 minutes");
  });
});
