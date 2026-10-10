/**
 * Site-wide constants. The site name lives here and nowhere else.
 */
export const SITE_NAME = "ForkvLift";
export const SITE_SLUG = "forkvlift";
export const SITE_TAGLINE = "Fork it, don't rebuild it.";

/** Exact disclaimer text for unlicensed projects (product plan, "Trust, safety, licensing"). */
export const NO_LICENSE_DISCLAIMER = {
  title: "No license: all rights reserved.",
  body:
    "This project's code is public, but its author hasn't given permission to reuse it. " +
    "GitHub's terms let you view and fork it on GitHub, but you may not copy, modify or " +
    "redistribute it elsewhere — including building your own version from it — without the " +
    "author's permission. Ask the author to add a license before building on it. " +
    "This is general information, not legal advice.",
} as const;

export const LIMITS = {
  taglineMax: 80,
  descriptionMax: 300,
  maxTags: 5,
  showcaseMax: 6,
  pageSizeDefault: 24,
  pageSizeMax: 60,
  usernameMin: 2,
  usernameMax: 39,
} as const;

/** Cookie names shared by the worker and (for dev tooling) the clients. */
export const COOKIES = {
  session: "fv_session",
  oauthState: "fv_oauth_state",
  devUser: "fv_dev_user",
} as const;
