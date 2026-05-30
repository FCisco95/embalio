# Wine Accent Theme

**Date:** 2026-05-30
**Status:** Approved

## Context

Replace the current indigo/purple accent (`#6366f1`) with a wine-red palette in both light and dark themes. Maintain the same gradient approach used for the brand avatar. No structural changes — this is a pure color token swap.

## Color Tokens

### `--primary` (buttons, active tabs, rings, badges, sidebar highlights)

| Theme | Old | New |
|---|---|---|
| Light (`:root`) | `#6366f1` | `#be123c` |
| Dark (`.dark`) | `#6366f1` | `#e11d48` |

### Brand gradient (`brand-avatar.tsx` → `BRAND_GRADIENT`)

| | Old | New |
|---|---|---|
| Gradient | `linear-gradient(135deg, #6366f1, #a855f7)` | `linear-gradient(135deg, #7f1d1d, #f43f5e)` |

`#7f1d1d` = deep Burgundy/Port (dark anchor)
`#f43f5e` = bright cherry-rose (light end)

### Derived tokens (no changes needed)

These already use `color-mix(in oklch, var(--primary) …)` and will auto-adapt:
- `--brand-text` (light: 82% primary + black; dark: 70% primary + white)
- `--glow` (light: 55% primary; dark: 75% primary)
- Button soft variant (14% primary)
- Badge accent variant (16% primary)
- `--ring` and `--sidebar-primary` both reference the same `--primary` value

## Files to Change

1. **`src/app/globals.css`**
   - `:root` → `--primary: #be123c` + `--ring: #be123c` + `--sidebar-primary: #be123c`
   - `.dark` → `--primary: #e11d48` + `--ring: #e11d48` + `--sidebar-primary: #e11d48`

2. **`src/components/ui/brand-avatar.tsx`**
   - `BRAND_GRADIENT` → `"linear-gradient(135deg, #7f1d1d, #f43f5e)"`

## Verification

- Run `npm run dev`, toggle dark/light mode, check:
  - Buttons are wine-red
  - Active nav item has wine-red underline/highlight
  - Brand avatar shows Burgundy → cherry gradient
  - Glow on sidebar primary button is reddish
  - No purple remains anywhere in the UI
