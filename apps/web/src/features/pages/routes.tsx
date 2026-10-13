import type { RouteObject } from "react-router";

/** Owner: Flash. Static pages (1.14), 404 (1.17). */
export const pagesRoutes: RouteObject[] = [
  { path: "/about", lazy: async () => ({ Component: (await import("./StaticPages")).AboutPage }) },
  { path: "/licensing", lazy: async () => ({ Component: (await import("./StaticPages")).LicensingPage }) },
  { path: "/rules", lazy: async () => ({ Component: (await import("./StaticPages")).RulesPage }) },
  { path: "/privacy", lazy: async () => ({ Component: (await import("./StaticPages")).PrivacyPage }) },
  { path: "/terms", lazy: async () => ({ Component: (await import("./StaticPages")).TermsPage }) },
  { path: "/dmca", lazy: async () => ({ Component: (await import("./StaticPages")).DmcaPage }) },
  { path: "/help/showcases", lazy: async () => ({ Component: (await import("./ShowcaseHelpPage")).ShowcaseHelpPage }) },
  { path: "/newsletter", lazy: async () => ({ Component: (await import("./NewsletterPage")).NewsletterPage }) },
  { path: "/newsletter/confirm", lazy: async () => ({ Component: (await import("./NewsletterConfirmPage")).NewsletterConfirmPage }) },
  { path: "/newsletter/unsubscribe", lazy: async () => ({ Component: (await import("./NewsletterUnsubscribePage")).NewsletterUnsubscribePage }) },
  ...(import.meta.env.DEV
    ? [{ path: "/showcase-art-preview", lazy: async () => ({ Component: (await import("./ShowcaseArtPreview")).ShowcaseArtPreview }) }]
    : []),
];

export const notFoundRoute: RouteObject = { path: "*", lazy: async () => ({ Component: (await import("./NotFoundPage")).NotFoundPage }) };
