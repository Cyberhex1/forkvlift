# Sprites (owner: Flash)

16-bit avatar layers and Plaza art.

- The avatar is drawn by `PixelAvatar.tsx` as layered 16×16 SVG rects (outfit → skin → face → hair → accessory), so colors come from tokens and it stays crisp at any size. Add a new option by adding its rects to the matching table there.
- Layers: `hair` (`<style>-<tone>`), `outfit`, `color`, `accessory`, `skin` — the keys used by `AvatarConfig` in `packages/shared`.
- Palette: the `pixel-0` … `pixel-15`, `skin-1` … `skin-5` and `hair-*` tokens in `../tokens.css`.
- Bitmap art (Plaza props, backgrounds) can still ship as PNG with a JSON frame map next to each sheet (`<name>.png` + `<name>.json`).
