# Rustybin Restore — Before/After Comparison

**Date:** 2026-06-14
**Branch:** `004-rustybin-restore` (merged into `master`)
**What this is:** the foxybin redesign landed on `master` with the rustybin brand, the
old rustybin color values, and the old `prism-tomorrow` editor theme restored.

---

## 1. Rebrand / revert completeness

All gates run from repo root against `site/`, `.github/`, excluding `*.md`.

| Gate | Command | Result |
| --- | --- | --- |
| No foxy branding residue | `grep -rin foxy site/src site/index.html .github site/tailwind.config.ts site/public` | **0 hits** |
| No orange brand color (hex) | `grep -rnE "#(ff6600\|ff8c33\|ffb37a\|dc3e00\|0F1014\|20222a\|15161b\|ffc06a)" site/src` | **0 hits** |
| No orange brand color (hsl hue 24) | `grep -rnE "hsl\(\s*24[ ,]" site/src` | **0 hits** |
| Primary token = old rose | `--primary` / `--ring` / `--foreground` in `index.css` | `348 26% 60%` |
| Editor theme key + default | `prism-theme-utils.ts` | `STORAGE_KEY = "rustybin-prism-theme"`, default `prism-tomorrow` |
| Tests | `npm test` (vitest) | **59 passed** (5 files) |
| Build | `npm run build` | **success** (pre-existing >500kB chunk warning only) |
| Lint | `npm run lint` | 3 errors / 8 warnings — **all pre-existing** (`textarea.tsx` empty-interface; `tailwind.config.ts:172` plugin `require()`); none introduced by this work |

### What "old rustybin" means here (restored values)

- **Accent:** rose `--primary: 348 26% 60%` (was orange `24 100% 50%`), `--ring`/`--sidebar-primary` likewise.
- **Surfaces:** `--background: 0 0% 18%` (#2D2D2D), near-black `--card`/`--popover: 240 10% 3.9%`.
- **Wordmark:** solid **"Rustybin"** (`text-foreground`), no gradient (was the orange `.brand-gradient`).
- **Hero gradient:** `.text-rainbow` = `#6ec2f7 → #a982ed → #e68dc1 → #f2a472`; `.icon-rainbow` = `#a982ed`.
- **Font:** Inter / SF Pro Display (was Rubik).
- **Editor:** `prism-tomorrow` (Tomorrow Night, `#2d2d2d`), custom "Foxyz" orange theme removed.
- **Markdown links / admin charts:** rose `hsl(348, …)` (were orange `hsl(24, …)`).
- **Favicon:** restored rose `favicon.svg`; foxy `logomark.png` removed.

### Intentionally kept (semantic, not brand)

- Tailwind `orange-500` / `orange-300` utilities — API-health status dot and the
  "Burns after first read" warning chip. These pre-exist in `master` and are functional
  indicators, not foxyz branding.

### Intentionally kept (redesign structure)

`<alpha-value>` color plumbing, `--radius: 2rem`, `--success` / `--warning` tokens, the
`--background` variable, the grain/dot overlay, `.btn-shine` / `.icon-tile`, scrollbar
styling, and all app-shell / layout CSS.

---

## 2. What the redesign adds to `master`

Relative to the old `master`, this branch brings the full foxybin redesign work — now
rebranded — plus two independent features that rode on the same branch. Branding,
colors, and editor theme are identical to old rustybin.

**Restoration commits (this branch, on top of the redesign):**

```
b89a645 style(markdown): restore old rustybin rose link/accent colors
e4a7caf test(theme): assert no custom-source theme without naming the removed theme
e62b567 feat(theme): remove custom Foxyz prism theme, restore prism-tomorrow default
8f7bf38 style(admin): restore old rustybin chart palette (rose) and tooltip styling
59386a4 style(components): map foxyz surface/border hexes to rustybin semantic tokens
083aefc style(theme): revert sans font family to Inter in tailwind config
b468faa style(theme): restore old rustybin color tokens, gradients, and Inter font
8b7ece4 refactor(brand): rename foxybin/foxyz to rustybin across code, assets, config
2aa860d chore(redesign): capture uncommitted foxybin redesign polish as-is
```

**Net additions vs old master (`git diff --stat master..004-rustybin-restore`):**

- **Redesign layout/UX** — `Layout.tsx`, `Index.tsx`, `Workspace.tsx`,
  `PasteTextArea.tsx` rebuilt; `WorkspaceSidebar`, `MarkdownToolbar`, UI primitives,
  rounded `2rem` corners, grain overlay, status bar.
- **GitHub link** — reusable `GitHubLink` component (nav + footer) with tests.
- **Single-container Docker deploy** — `Dockerfile`, `docker-compose.yml`,
  `.dockerignore`, GHCR + build-validation CI workflows.
- **Always-on editor line numbers** — gutter on home + workspace, with tests.
- **Drag-and-drop file import**, file-drop tests.

~49 files changed. Markdown docs (README, DOCKER.md, DEPLOYMENT.md, and the historical
`docs/superpowers/{specs,plans}/2026-06-12-*` design/plan files) were left untouched and
still reference foxybin as a historical record, per standing preference.
