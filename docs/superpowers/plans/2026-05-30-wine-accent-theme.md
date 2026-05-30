# Wine Accent Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the indigo/purple accent color with a wine-red palette across both light and dark themes.

**Architecture:** Two files change — `globals.css` (CSS custom properties) and `brand-avatar.tsx` (hardcoded gradient string). All other components consume `--primary` via `var()` or Tailwind utility classes and require no changes.

**Tech Stack:** CSS custom properties, Tailwind CSS (via `@theme inline`), Next.js, next-themes

---

### Task 1: Update CSS custom properties in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update light theme (`:root`) primary tokens**

In `src/app/globals.css`, find the `:root` block and change these three lines:

```css
/* before */
--primary: #6366f1;
--ring: #6366f1;
--sidebar-primary: #6366f1;

/* after */
--primary: #be123c;
--ring: #be123c;
--sidebar-primary: #be123c;
```

- [ ] **Step 2: Update dark theme (`.dark`) primary tokens**

In `src/app/globals.css`, find the `.dark` block and change these three lines:

```css
/* before */
--primary: #6366f1;
--ring: #6366f1;
--sidebar-primary: #6366f1;

/* after */
--primary: #e11d48;
--ring: #e11d48;
--sidebar-primary: #e11d48;
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: swap accent from indigo to wine red in light + dark theme"
```

---

### Task 2: Update brand avatar gradient

**Files:**
- Modify: `src/components/ui/brand-avatar.tsx`

- [ ] **Step 1: Replace the hardcoded gradient constant**

In `src/components/ui/brand-avatar.tsx`, find `BRAND_GRADIENT` and change:

```ts
// before
const BRAND_GRADIENT = "linear-gradient(135deg,#6366f1,#a855f7)"

// after
const BRAND_GRADIENT = "linear-gradient(135deg,#7f1d1d,#f43f5e)"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/brand-avatar.tsx
git commit -m "feat: wine gradient on brand avatar (burgundy → cherry)"
```

---

### Task 3: Visual verification

- [ ] **Step 1: Start dev server (if not already running)**

```bash
npm run dev
```

- [ ] **Step 2: Check dark theme**

Open `http://localhost:3000`. Verify:
- Sidebar "New post" button is wine-red with a reddish glow
- Active nav item shows wine-red highlight/underline
- Brand avatar (fcisco95) shows Burgundy → cherry gradient
- No purple remains anywhere

- [ ] **Step 3: Toggle to light theme**

Click the theme toggle in the top-right corner. Verify:
- Buttons are deep wine-red (`#be123c`)
- Active states use wine-red
- Brand avatar gradient unchanged (same gradient, theme-invariant)
- Text on wine-red buttons is white and legible

- [ ] **Step 4: Confirm build passes**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with no errors.
