# Icons (owner: Flash)

Pixel icons as React components or SVG files: category icons (`cat-<slug>`), badge icons (`badge-<key>`), UI glyphs.

- 16×16 or 32×32 grid, `shape-rendering="crispEdges"`, colors only from the `pixel-*` tokens or `currentColor`.
- Export each icon from `index.ts` in this folder; the `iconKey` fields in `packages/shared` refer to these names.
- Every icon needs an accessible name where it carries meaning (`aria-label`) or `aria-hidden` where it's decorative.
