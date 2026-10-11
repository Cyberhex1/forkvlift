# Contract request: Newsletter subscribers table & double opt-in routes

- **From:** flash
- **For task:** 4.10
- **Status:** done (Opus). Table `subscribers` (migration 0009). `subscribeNewsletter` as asked; `confirmNewsletter` and `unsubscribeNewsletter` are both `POST` with `{ token }` so a link preview cannot confirm or unsubscribe. Email links point to `/newsletter?confirm=<token>` and `/newsletter?unsubscribe=<token>`: Flash, please build that page (it posts the token) plus the signup form.

## What I need

1. `subscribers` table schema in D1:
```sql
CREATE TABLE `subscribers` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `token` text NOT NULL UNIQUE,
  `status` text NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'unsubscribed'
  `created_at` integer NOT NULL,
  `confirmed_at` integer,
  `unsubscribed_at` integer
);
CREATE INDEX `subscribers_email` ON `subscribers` (`email`);
CREATE INDEX `subscribers_token` ON `subscribers` (`token`);
```

2. Newsletter routes in `packages/shared/src/api/routes.ts`:
```ts
subscribeNewsletter: route({
  method: "POST", path: "/api/newsletter/subscribe", auth: "public", kind: "json", area: "feeds",
  summary: "Subscribe to The Fork Report weekly newsletter (double opt-in)",
  body: z.object({ email: z.string().email(), turnstileToken: z.string().min(1) }),
  response: z.object({ ok: z.literal(true), status: z.enum(["pending", "confirmed"]) }),
}),
confirmNewsletter: route({
  method: "GET", path: "/api/newsletter/confirm/:token", auth: "public", kind: "json", area: "feeds",
  summary: "Confirm newsletter subscription via email token",
  params: z.object({ token: z.string().min(1) }),
  response: z.object({ ok: z.literal(true) }),
}),
unsubscribeNewsletter: route({
  method: "POST", path: "/api/newsletter/unsubscribe", auth: "public", kind: "json", area: "feeds",
  summary: "Unsubscribe from The Fork Report newsletter",
  body: z.object({ token: z.string().min(1) }),
  response: z.object({ ok: z.literal(true) }),
}),
```

## Why

Task 4.10 requires newsletter signup for "The Fork Report" with double opt-in support. Since no external email provider is integrated yet, signups are securely recorded in D1 with verification tokens so confirmation emails can be dispatched reliably without breaking existing workflows.

## Workaround until then

Email templates for `forkReportEmail` and `newsletterConfirmationEmail` are fully authored and tested in `apps/worker/src/email/templates/index.ts`.
