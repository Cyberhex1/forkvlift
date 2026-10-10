## [task id] Title

**Task:** <!-- e.g. 1.9 Focus panel -->
**Handoff note:** <!-- docs/handoffs/<task-id>-<slug>.md -->

### What changed

### How to test
<!-- pnpm dev, then … ; fixture user: /api/dev/login?as=fx-ada -->

### Checklist
- [ ] Only my folders (OWNERS.json); contract changes went through docs/contract-requests/
- [ ] Types from `@forkvlift/shared`, UI from `@forkvlift/ui` tokens (no hard-coded colors/fonts)
- [ ] Empty, loading, error states; WIP and "No license" variants where they apply
- [ ] Works at 375 px and 1440 px, keyboard + visible focus, reduced motion respected
- [ ] No fake content in anything that ships
