import type { ReactNode } from "react";
import { Link } from "react-router";
import { SITE_NAME, SITE_TAGLINE } from "@forkvlift/shared";
import { Badge, buttonClasses, Card } from "@forkvlift/ui";
import { NoLicenseBanner } from "./NoLicenseDisclaimer";

interface StaticPageLayoutProps {
  badge: string;
  title: string;
  description: string;
  updatedAt?: string;
  children: ReactNode;
}

const staticNavLinks = [
  { to: "/about", label: "About" },
  { to: "/licensing", label: "Licensing 101" },
  { to: "/rules", label: "Rules" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/dmca", label: "DMCA" },
] as const;

function StaticPageLayout({
  badge,
  title,
  description,
  updatedAt = "October 2026",
  children,
}: StaticPageLayoutProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top breadcrumbs & navigation */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-xs text-muted">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-mono text-muted hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
        >
          ← Back to catalog
        </Link>
        <nav aria-label="Static pages navigation" className="flex flex-wrap items-center gap-2">
          {staticNavLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-pixel px-2 py-1 text-muted hover:bg-surface-2 hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Page Header */}
      <header className="mb-10 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{badge}</Badge>
          <span className="font-mono text-xs text-muted">Updated {updatedAt}</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          {description}
        </p>
      </header>

      {/* Main Content */}
      <div className="space-y-10 text-fg">{children}</div>
    </div>
  );
}

/**
 * About page (/about) — Task 1.14
 */
export function AboutPage() {
  return (
    <StaticPageLayout
      badge="About"
      title={`About ${SITE_NAME}`}
      description={`${SITE_TAGLINE} A free, social catalog of vibe-coded projects with public code you can clone and point your agents at.`}
    >
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          Why {SITE_NAME} exists
        </h2>
        <p className="leading-relaxed text-muted">
          In the vibe-coding era, builders create working applications in hours using AI coding
          assistants like Claude Code, Cursor, Codex, Bolt, Lovable, v0, and Antigravity. Yet
          without a shared, organized index, thousands of developers spend countless hours
          rebuilding the exact same starter apps, CRUD boilers, and utilities.
        </p>
        <p className="leading-relaxed text-muted">
          {SITE_NAME} organizes the vibe-coding scene. Every listed project has public code you can
          clone and point your agents at. Finished or not, licensed or not, each card says plainly
          what you are allowed to do with it so you can pick up where others left off.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          Guiding principles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              1. Public code, honestly labeled
            </h3>
            <p className="text-sm text-muted">
              Every card requires a public repository. Open licenses get clear badges; repos without
              a license are hidden by default behind an explicit disclaimer. Unfinished projects are
              honestly marked by stage.
            </p>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              2. Credit the original
            </h3>
            <p className="text-sm text-muted">
              Every fork shows its lineage. When someone builds on your foundation, you get visible
              credit and recognition across the platform.
            </p>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              3. No dark patterns
            </h3>
            <p className="text-sm text-muted">
              No paywalled core features, no algorithmic rage-bait feed, and no selling your data.
              Our mission is to help people find free, open software, not trap them in subscriptions.
            </p>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              4. Fun, not corporate
            </h3>
            <p className="text-sm text-muted">
              16-bit avatars, elevator tunes, retro accents, and a warm clubhouse feel. Building
              software is creative and fun—your catalog should be too.
            </p>
          </Card>

          <Card className="space-y-2 sm:col-span-2">
            <h3 className="font-display text-base font-semibold text-fg">
              5. Cheap to run and permanently free
            </h3>
            <p className="text-sm text-muted">
              Architected on Cloudflare serverless edge primitives (Workers, D1, KV, Durable Objects)
              so operational costs remain near zero. No venture capital, no ads, no paywalls.
            </p>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          How it works
        </h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted sm:text-base">
          <li>
            <strong className="text-fg">Browse & Filter:</strong> Find projects by AI tool used,
            language, stage (Finished, Work in Progress, Up for Adoption), or search for free
            alternatives to paid subscription software.
          </li>
          <li>
            <strong className="text-fg">Inspect Cards:</strong> Flip cards to see tech stacks, build
            facts, live releases, or open the focused panel to inspect the README and fork lineage.
          </li>
          <li>
            <strong className="text-fg">Fork & Prompt:</strong> Grab the quick-copy clone command or
            starter prompt and feed it straight into your agent to continue the work.
          </li>
          <li>
            <strong className="text-fg">Share & Adopt:</strong> Submit your own repositories or
            adopt unfinished gems left by fellow vibe-coders.
          </li>
        </ol>
      </section>

      <section className="rounded-card border border-border bg-surface-2 p-6">
        <h3 className="font-display text-lg font-semibold text-fg">
          Ready to discover or share?
        </h3>
        <p className="mt-2 text-sm text-muted">
          Start exploring projects on the feed or submit your own vibe-coded creation.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/" className={buttonClasses("primary", "md")}>
            Explore the feed
          </Link>
          <Link to="/rules" className={buttonClasses("secondary", "md")}>
            Community rules
          </Link>
        </div>
      </section>
    </StaticPageLayout>
  );
}

/**
 * Licensing 101 page (/licensing) — Task 1.14
 */
export function LicensingPage() {
  return (
    <StaticPageLayout
      badge="Guide"
      title="Licensing 101 for Vibe-Coders"
      description="A plain-English guide to open source licenses, copyright, and why 'No license' does not mean public domain."
    >
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          Why licenses matter
        </h2>
        <p className="leading-relaxed text-muted">
          When you vibe-code and ask an AI agent to build on someone else&apos;s code, software
          copyright laws still apply. An open source license is the author&apos;s explicit grant of
          legal permission telling you what you are permitted to do with their work: copy it, modify
          it, redistribute it, or use it commercially.
        </p>
        <p className="leading-relaxed text-muted">
          Without a license, you do not have permission to build on, modify, or redistribute the code
          outside of GitHub—even if the repository is publicly accessible.
        </p>
      </section>

      {/* Featured No-License Section with the EXACT DISCLAIMER */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          What &ldquo;No license&rdquo; means
        </h2>
        <NoLicenseBanner />

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            <strong className="text-fg">Public does not equal Public Domain:</strong> Under modern
            copyright conventions (including the Berne Convention), the creator of software code
            automatically retains full copyright (&ldquo;all rights reserved&rdquo;) the moment the
            code is written.
          </p>
          <p>
            <strong className="text-fg">What GitHub Terms of Service allow:</strong> By publishing
            publicly on GitHub, the author grants GitHub and its users the right to view and fork the
            repository on GitHub itself. However, that license does <em>not</em> extend to copying the
            code elsewhere, distributing modifications, building closed or commercial forks, or
            redistributing the project.
          </p>
          <p>
            <strong className="text-fg">How {SITE_NAME} protects you:</strong> By default, we hide
            unlicensed repositories across feeds, categories, and search. Anyone can choose to reveal
            them in Settings or the filter drawer, but we display the exact disclaimer above so you
            know the legal boundaries.
          </p>
          <p>
            <strong className="text-fg">What you should do:</strong> If you find an unlicensed
            project you want to build on, politely ask the author to add an open source license (such
            as MIT or Apache-2.0) by filing a GitHub issue or sending a Collab request.
          </p>
        </div>
      </section>

      {/* Common Licenses Breakdown */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          Common open source licenses
        </h2>

        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone="license-open">Permissive</Badge>
              <h3 className="font-display text-base font-semibold text-fg">
                Do anything, keep the credit
              </h3>
            </div>
            <p className="text-sm text-muted">
              Permissive licenses allow anyone to use, modify, redistribute, and even sell the code
              in proprietary software, provided the original copyright notice is preserved.
            </p>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <span className="font-mono font-medium text-fg">MIT:</span> Do anything, keep the
                credit. The gold standard for modern vibe-coding.
              </li>
              <li>
                <span className="font-mono font-medium text-fg">Apache-2.0:</span> Do anything, keep
                credit and notices; includes an explicit patent grant and trademark protections.
              </li>
              <li>
                <span className="font-mono font-medium text-fg">BSD-2-Clause / BSD-3-Clause:</span>{" "}
                Permissive terms with simple disclaimer clauses.
              </li>
              <li>
                <span className="font-mono font-medium text-fg">ISC:</span> Functionally identical
                to MIT with simplified language.
              </li>
            </ul>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone="license-open">Public Domain</Badge>
              <h3 className="font-display text-base font-semibold text-fg">
                Zero restrictions
              </h3>
            </div>
            <p className="text-sm text-muted">
              Dedicated to the public commons. Anyone can use the code for any purpose with no
              attribution required.
            </p>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <span className="font-mono font-medium text-fg">The Unlicense:</span> Public domain
                dedication with a disclaimer of warranty.
              </li>
              <li>
                <span className="font-mono font-medium text-fg">CC0-1.0:</span> Universal public
                domain dedication recognized worldwide.
              </li>
              <li>
                <span className="font-mono font-medium text-fg">0BSD:</span> Zero-clause BSD; no
                attribution requirement whatsoever.
              </li>
            </ul>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone="warning">Copyleft</Badge>
              <h3 className="font-display text-base font-semibold text-fg">
                Your fork must stay open
              </h3>
            </div>
            <p className="text-sm text-muted">
              Copyleft licenses ensure code remains open. If you modify or redistribute the software,
              your derivative works must also be released under the same open license.
            </p>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <span className="font-mono font-medium text-fg">GPL-2.0 / GPL-3.0:</span> Your fork
                must stay open under the GPL with source code published upon distribution.
              </li>
              <li>
                <span className="font-mono font-medium text-fg">AGPL-3.0:</span> Network copyleft. If
                you run the project as a web service accessible over a network, you must offer the
                source code to users.
              </li>
              <li>
                <span className="font-mono font-medium text-fg">MPL-2.0 / LGPL-3.0:</span> File-level
                or library-level copyleft. Modifications to the covered files must stay open, but
                they can be combined with larger proprietary codebases.
              </li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          How to add a license to your project
        </h2>
        <p className="leading-relaxed text-muted">
          Adding a license takes less than 30 seconds and empowers other vibe-coders to legitimately
          use and improve your work:
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Create a new file named <code className="rounded-pixel bg-surface-2 px-1 py-0.5 font-mono text-fg">LICENSE</code> (or <code className="rounded-pixel bg-surface-2 px-1 py-0.5 font-mono text-fg">LICENSE.md</code>) in your repository root.</li>
          <li>Choose a license (we recommend MIT for maximum reuse, or AGPL-3.0 if you want web derivatives to stay open).</li>
          <li>Paste the license text with your name and the current year, then commit the file.</li>
        </ol>
      </section>
    </StaticPageLayout>
  );
}

/**
 * Community Rules page (/rules) — Task 1.14
 */
export function RulesPage() {
  return (
    <StaticPageLayout
      badge="Policy"
      title="Community Rules"
      description={`Keeping ${SITE_NAME} a welcoming, productive, and safe clubhouse for builders and vibe-coders.`}
    >
      <section className="space-y-4">
        <p className="leading-relaxed text-muted">
          {SITE_NAME} is built for collaboration, learning, and open software remixing. To protect
          our community and maintain high signal, all participants must follow these rules.
        </p>

        <div className="space-y-4">
          <Card className="space-y-2 border-l-4 border-l-accent">
            <h3 className="font-display text-base font-semibold text-fg">
              1. Public code only
            </h3>
            <p className="text-sm text-muted">
              Every submitted project must link to a real, accessible public repository. Private
              repositories, dead links, or paywalled download links will be removed.
            </p>
          </Card>

          <Card className="space-y-2 border-l-4 border-l-accent">
            <h3 className="font-display text-base font-semibold text-fg">
              2. Credit original authors
            </h3>
            <p className="text-sm text-muted">
              Always respect fork lineage. When submitting a fork or adaptation, preserve original
              author attribution, copyright headers, and license terms. Never claim someone
              else&apos;s project as solely your own.
            </p>
          </Card>

          <Card className="space-y-2 border-l-4 border-l-danger">
            <h3 className="font-display text-base font-semibold text-fg">
              3. Zero tolerance for malware and exploits
            </h3>
            <p className="text-sm text-muted">
              Never submit malicious software, token stealers, cryptominers, spyware, keyloggers, or
              backdoored packages. Automated security checks scan candidate repos, and violators are
              permanently banned.
            </p>
          </Card>

          <Card className="space-y-2 border-l-4 border-l-danger">
            <h3 className="font-display text-base font-semibold text-fg">
              4. No committed secrets or unsafe install scripts
            </h3>
            <p className="text-sm text-muted">
              Check your repositories before submitting. Never commit live API keys, private tokens,
              or credentials. If our automated scanner discovers committed secrets, we warn the author
              privately rather than publicly exposing the leak. Repositories containing install scripts
              that download and run code are flagged publicly with a &ldquo;Review before running&rdquo;
              notice.
            </p>
          </Card>

          <Card className="space-y-2 border-l-4 border-l-warning">
            <h3 className="font-display text-base font-semibold text-fg">
              5. No spam, bots, or duplicate flood
            </h3>
            <p className="text-sm text-muted">
              Do not flood the feed with duplicate repos, empty starter templates, or SEO spam. New
              accounts are rate-limited to maintain catalog quality.
            </p>
          </Card>

          <Card className="space-y-2 border-l-4 border-l-accent">
            <h3 className="font-display text-base font-semibold text-fg">
              6. Respectful and constructive conduct
            </h3>
            <p className="text-sm text-muted">
              Treat other builders with respect. Harassment, hate speech, threats, trolling, and
              abusive behavior in comments, forum threads, or Plaza chat will result in immediate
              moderation (mute, kick, or ban).
            </p>
          </Card>

          <Card className="space-y-2 border-l-4 border-l-accent">
            <h3 className="font-display text-base font-semibold text-fg">
              7. Honest project metadata
            </h3>
            <p className="text-sm text-muted">
              Accurately label project stage (Finished, Work in Progress, or Up for Adoption), AI
              tools used, and license. Do not misrepresent project readiness or authorship.
            </p>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          Reporting violations
        </h2>
        <p className="leading-relaxed text-muted">
          Notice a broken repo, stolen code, malicious script, or abusive comment? Click the
          &ldquo;Report&rdquo; button on any project card or contact our moderation team directly.
          Reports feed directly into our moderation review queue.
        </p>
      </section>
    </StaticPageLayout>
  );
}

/**
 * Privacy Policy page (/privacy) — Task 1.14
 */
export function PrivacyPage() {
  return (
    <StaticPageLayout
      badge="Legal"
      title="Privacy Policy"
      description={`How ${SITE_NAME} handles information with minimal data collection and zero selling of user data.`}
    >
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          Our privacy commitments
        </h2>
        <p className="leading-relaxed text-muted">
          We believe in radical simplicity and privacy-by-design. We do not sell user data, run third-party
          behavioral ad networks, or deploy cross-site tracking cookies.
        </p>

        <div className="space-y-4">
          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              1. Information we collect
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>
                <strong className="text-fg">GitHub Profile & Email:</strong> When signing in via GitHub
                OAuth, we request the <code className="font-mono text-xs">read:user user:email</code> scopes.
                We store your public GitHub username, avatar, GitHub user ID, and your primary verified
                GitHub email (used for account linking and magic-link sign-in). We do not keep your
                GitHub access token, and we never receive or store your GitHub password or private
                repository contents.
              </li>
              <li>
                <strong className="text-fg">Content You Submit:</strong> Projects you submit, bookmarks,
                collections, forum posts, comments, and profile preferences.
              </li>
              <li>
                <strong className="text-fg">Operational Logs:</strong> Standard request logs (IP
                address, user agent) collected at the Cloudflare edge for security, DDoS prevention,
                and rate limiting.
              </li>
            </ul>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              2. How we use your information
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>To provide, maintain, and secure the catalog and your account session.</li>
              <li>To attribute projects, forks, and comments to your profile.</li>
              <li>To enforce security rules and prevent abuse or spam.</li>
            </ul>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              3. Cookies and local storage
            </h3>
            <p className="text-sm text-muted">
              We only use cookies strictly necessary for service operation:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>
                <code className="font-mono text-fg">fv_session</code>: Secure HTTP-only session cookie.
              </li>
              <li>
                <code className="font-mono text-fg">fv_oauth_state</code>: Temporary CSRF defense cookie
                during GitHub authentication.
              </li>
              <li>
                <code className="font-mono text-fg">localStorage</code>: Remembers client settings
                (theme, reduced motion, music volume, show unlicensed switch).
              </li>
            </ul>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              4. Your data rights (GDPR & CCPA)
            </h3>
            <p className="text-sm text-muted">
              You retain ownership of your personal data. Self-service data export and account deletion
              are planned and in active development (task 2.10). In the meantime, you can request an
              export or deletion by opening an issue on our repository. When processed, account deletion
              permanently purges your user record and active sessions.
            </p>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              5. Age limitations
            </h3>
            <p className="text-sm text-muted">
              {SITE_NAME} is intended for individuals aged 13 and older (or 16 in applicable EU
              jurisdictions). We do not knowingly collect personal data from children under these ages.
            </p>
          </Card>
        </div>
      </section>
    </StaticPageLayout>
  );
}

/**
 * Terms of Service page (/terms) — Task 1.14
 */
export function TermsPage() {
  return (
    <StaticPageLayout
      badge="Legal"
      title="Terms of Service"
      description={`Terms and conditions governing your access to and use of ${SITE_NAME}.`}
    >
      <section className="space-y-4">
        <p className="leading-relaxed text-muted">
          By accessing or using {SITE_NAME}, you agree to be bound by these Terms of Service and our
          Community Rules. If you do not agree, do not use the service.
        </p>

        <div className="space-y-4">
          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              1. Catalog & discovery service only
            </h3>
            <p className="text-sm text-muted">
              {SITE_NAME} is an indexing and discovery platform. We do not host, execute, compile, or
              run third-party software repositories on our servers. All projects link to external,
              publicly hosted code repositories (such as GitHub).
            </p>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              2. User responsibility & code safety
            </h3>
            <p className="text-sm text-muted">
              Any code you clone, fork, or run on your local computer or servers is executed solely at
              your own risk. While {SITE_NAME} runs automated heuristic checks, we cannot guarantee
              that third-party code is free from defects, bugs, security vulnerabilities, or malicious
              behavior. Always review code before executing it.
            </p>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              3. Submissions and licensing
            </h3>
            <p className="text-sm text-muted">
              When submitting a project, you represent that the repository is publicly accessible and
              that indexing it does not violate third-party rights. Original licenses on external
              repositories govern code usage, modifications, and redistribution.
            </p>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              4. Termination & content moderation
            </h3>
            <p className="text-sm text-muted">
              We reserve the right to remove any listed project, comment, or account at our discretion
              if it violates our Community Rules, distributes malware, infringes copyright, or disrupts
              the platform.
            </p>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-display text-base font-semibold text-fg">
              5. Disclaimer of warranties & liability
            </h3>
            <p className="text-sm text-muted">
              {SITE_NAME} is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis
              without warranties of any kind. In no event shall {SITE_NAME} or its maintainers be liable
              for any direct, indirect, incidental, or consequential damages resulting from your use of
              indexed projects or the platform.
            </p>
          </Card>
        </div>
      </section>
    </StaticPageLayout>
  );
}

/**
 * DMCA and Copyright Takedown page (/dmca) — Task 1.14
 */
export function DmcaPage() {
  return (
    <StaticPageLayout
      badge="Legal"
      title="DMCA & Copyright Takedowns"
      description={`Procedures for reporting copyright infringement on ${SITE_NAME} under the Digital Millennium Copyright Act.`}
    >
      <section className="space-y-4">
        <p className="leading-relaxed text-muted">
          {SITE_NAME} respects the intellectual property rights of software creators and responds
          promptly to valid notices of alleged copyright infringement under the Digital Millennium
          Copyright Act (17 U.S.C. § 512).
        </p>

        <Card className="space-y-3 border-l-4 border-l-warning bg-surface-2 p-4">
          <h3 className="font-display text-base font-semibold text-fg">
            Notice regarding code hosting
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            {SITE_NAME} does not host repository source code or download binaries. We index public
            metadata and link to external hosts (primarily GitHub). If you want infringing source code
            completely removed from the internet, you should also file a takedown notice directly with
            the hosting service (such as GitHub&apos;s DMCA Takedown process).
          </p>
          <p className="text-sm text-muted">
            However, we will promptly delist and remove index entries, cards, and previews from{" "}
            {SITE_NAME} upon receiving a valid notification.
          </p>
        </Card>

        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
            How to file a DMCA takedown notice
          </h2>
          <p className="text-sm text-muted">
            To submit a valid notice, please provide our designated copyright agent with the following
            information in writing:
          </p>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              A physical or electronic signature of a person authorized to act on behalf of the owner
              of the copyright work.
            </li>
            <li>
              Identification of the copyrighted work claimed to have been infringed (e.g. link to your
              original repository or registration).
            </li>
            <li>
              Identification of the material on {SITE_NAME} claimed to be infringing (URL to the
              project card or project slug).
            </li>
            <li>
              Your contact information (legal name, mailing address, telephone number, and email
              address).
            </li>
            <li>
              A statement that you have a good faith belief that use of the material is not authorized
              by the copyright owner, its agent, or the law.
            </li>
            <li>
              A statement, made under penalty of perjury, that the information in your notification is
              accurate and that you are authorized to act on behalf of the copyright owner.
            </li>
          </ol>
        </div>

        <Card className="space-y-2">
          <h3 className="font-display text-base font-semibold text-fg">
            Designated copyright contact
          </h3>
          <p className="text-sm text-muted">
            Until a dedicated takedown address is configured, submit takedown notices via our
            repository issue tracker:
          </p>
          <p>
            <a
              href="https://github.com/Cyberhex1/forkvlift/issues/new?title=Takedown:%20"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-focus"
            >
              github.com/Cyberhex1/forkvlift/issues (title prefix &ldquo;Takedown:&rdquo;) ↗
            </a>
          </p>
          <p className="text-xs text-muted">
            Notices that fail to include the required statutory elements may experience delays.
          </p>
        </Card>

        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
            Counter-notifications & repeat infringers
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            If you believe your project was mistakenly delisted or misidentified, you may submit a
            counter-notification containing the statutory elements defined in 17 U.S.C. § 512(g)(3).
            Upon receipt of a valid counter-notification, we will forward it to the complaining party.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            In accordance with the DMCA, {SITE_NAME} maintains a policy of terminating user accounts
            and blocking URLs associated with repeat copyright infringers.
          </p>
        </div>
      </section>
    </StaticPageLayout>
  );
}
