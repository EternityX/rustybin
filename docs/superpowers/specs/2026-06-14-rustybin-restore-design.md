# Rustybin Restore — Design Spec

**Date:** 2026-06-14
**Branch:** `004-rustybin-restore` (off `003-foxybin-redesign`)
**Target:** merge into local `master` (no-ff)

## Goal

Land the full `003-foxybin-redesign` work onto `master`, but with the **rustybin**
brand, the **old rustybin color values**, and the **old rustybin syntax-highlighting
theme** restored. Keep all of the redesign's layout, structure, and features; revert
only branding, color *values*, and the editor theme.

## Scope decisions (locked)

| Decision | Choice |
| --- | --- |
| What lands on master | **Everything**: all committed branch work (foxybin redesign, Foxyz syntax theme, Docker deploy, always-on line numbers) **plus** the current uncommitted working-tree polish (Workspace rewrite, `--radius: 2rem`, logomark favicon, scrollbar styling). |
| Rebrand depth | **Full** — visible text, internal identifiers, asset filenames. Visible brand text renders as **"Rustybin"**. |
| Custom Foxyz syntax theme | **Removed** — restore stock default `prism-tomorrow` + storage key `rustybin-prism-theme`. |
| Wordmark | **"Rustybin"** (capital R), **no gradient** — solid single-color text. |
| Color revert | **Full literal revert** — old `#2D2D2D`/near-black surfaces, rose accent (`HSL 348 26% 60%`), old multicolor `.text-rainbow` gradient, and revert font **Rubik → Inter**. Keep redesign's structural plumbing. |
| Integration | New branch `004-rustybin-restore` → merge into local `master`; user pushes. |
| Markdown docs | **Out of scope** — leave every `*.md` untouched (standing user preference), even where it still says foxybin. |

## Approach

**Redesign-first, then restore.** Take the redesign as the base and layer the
rustybin restoration on top as focused, reviewable commits. This preserves real
history, keeps each revert isolated, and makes the before/after comparison fall out
as the restoration diff.

Rejected alternatives:
- *Cherry-pick layout onto master* — the redesign rewrote `PasteTextArea` (±495),
  `Index` (±437), and `Workspace` wholesale; separating "layout" from "color/branding"
  by hand across those is high-risk.
- *One giant restoration commit* — bundles branding + color + theme reverts into one
  unreviewable blob.

## Git flow

1. `004-rustybin-restore` branched off `003-foxybin-redesign` (done).
2. Commit the current uncommitted working-tree polish **as-is** first (one commit), so
   "everything incl. uncommitted" is captured before any rename touches it.
3. Apply restoration as four focused commits (workstreams A–D below).
4. Verify (build + lint + tests + comparison report).
5. Merge `004` into local `master` (`--no-ff`). User pushes when satisfied.

## Workstream A — Branding sweep (code/assets/config only)

Rename `foxy` / `foxybin` / `foxyz` / `Foxyz` → `rusty` / `rustybin` / `Rustybin`
across `.tsx`, `.ts`, `.css`, `.html`, `.yml` and asset filenames. **Skip all `*.md`.**

- **Wordmark** → solid **"Rustybin"**, no gradient. `Layout.tsx` and `Workspace.tsx`
  currently use `<span className="brand-gradient">foxy</span>` (+ `bin`). Replace with a
  single "Rustybin" span in a solid color — `text-foreground` (resolves to the restored
  rose after Workstream B); drop the `.brand-gradient` class.
- `site/index.html` `<title>` → `Rustybin`.
- Legal/marketing copy: `Privacy.tsx`, `Terms.tsx`, `SecurityInfo.tsx` → rustybin.
- `WorkspaceSidebar.tsx` `<span className="text-primary">foxy</span>` → rustybin mark.
- Rename `foxyz`-named CSS utilities/comments (`.btn-shine`, `.icon-tile`) to neutral
  names; update references.
- Storage key already handled in Workstream C (reverts to `rustybin-prism-theme`).
- **Assets:** restore `site/public/favicon.svg` (currently deleted in working tree),
  repoint `index.html` icon to it, remove/replace untracked `site/public/logomark.png`.
- CI: `.github/workflows/docker-ci.yml` foxy reference → rustybin.

**Completeness gate:** `grep -ri foxy site/src site/index.html .github` → **0** hits.

## Workstream B — Full literal color revert (keep structure)

Port master's effective `.dark` palette into the redesign's unified `:root, .dark`
block in `site/src/index.css`. Values:

| Token | Redesign (foxyz) | Restore to (old rustybin) |
| --- | --- | --- |
| `--background` | `231 15% 9%` | `0 0% 18%` (#2D2D2D) |
| `--foreground` | `220 13% 91%` | `348 26% 60%` |
| `--card` / `--popover` | `228 14% 7%` | `240 10% 3.9%` |
| `--card-foreground` / `--popover-foreground` | `220 13% 91%` | `0 0% 98%` |
| `--primary` | `24 100% 50%` | `348 26% 60%` |
| `--primary-foreground` | `0 0% 100%` | `210 40% 98%` |
| `--secondary` | `230 10% 11%` | `348 26% 60%` |
| `--secondary-foreground` | `220 13% 91%` | `0 0% 98%` |
| `--muted` / `--accent` | `230 10% 11%` | `240 3.7% 15.9%` |
| `--muted-foreground` | `229 7% 56%` | `240 5% 64.9%` |
| `--accent-foreground` | `220 13% 91%` | `0 0% 98%` |
| `--destructive` | `354 68% 51%` | `0 84% 60%` |
| `--destructive-foreground` | `0 0% 100%` | `210 40% 98%` |
| `--border` / `--input` | `228 14% 15%` | `240 3.7% 15.9%` |
| `--ring` | `24 100% 50%` | `348 26% 60%` |
| `--sidebar-background` | `225 13% 6%` | `0 0% 6%` |
| `--sidebar-foreground` | `220 13% 91%` | `240 4.8% 95.9%` |
| `--sidebar-primary` / `--sidebar-ring` | `24 100% 50%` | `348 26% 60%` |
| `--sidebar-accent` | `230 10% 11%` | `0 0% 12%` |
| `--sidebar-accent-foreground` | `220 13% 91%` | `240 4.8% 95.9%` |
| `--sidebar-border` | `228 14% 15%` | `0 0% 13%` |

- `.text-rainbow` → `linear-gradient(90deg, #6ec2f7, #a982ed, #e68dc1, #f2a472)`.
- `.icon-rainbow` → `#a982ed`.
- Replace hardcoded foxyz/orange hexes in components with old rustybin values or
  semantic tokens (`bg-card`, `bg-background`, `border-border`): hunt
  `#ff6600`, `#ff8c33`, `#ffb37a`, `#dc3e00`, `#0F1014`, `#15161b`, `#20222a`.
- **Font:** revert Rubik → Inter in `index.css` `@import` and `tailwind.config.ts`
  `fontFamily.sans` (`['Inter', 'SF Pro Display', 'system-ui', 'sans-serif']`).

**Kept (structure, not reverted):** `<alpha-value>` plumbing in `tailwind.config.ts`,
`--radius` (redesign's `2rem`), `--success` (`156 78% 34%`) / `--warning`
(`45 93% 47%`) functional tokens, the grain/dot background overlay, scrollbar styling,
and all app-shell / layout CSS.

**Completeness gate:** orange/foxyz hex hunt over `site/src` → **0** hits;
`--primary` / `--ring` / `--foreground` in `index.css` match the table above.

## Workstream C — Syntax-theme revert

In `site/src/utils/prism-theme-utils.ts`:
- Delete the `prism-foxyz` theme entry and the `FOXYZ_THEME_CSS` block + its injection.
- Restore: default theme `prism-tomorrow`, storage key `rustybin-prism-theme`,
  `getThemeBackground` fallback `#2d2d2d`, and remove the "ignore legacy key" logic that
  forced Foxyz.
- Editor background: restore `#2d2d2d`-family. Replace any redesign hardcoded
  `#0F1014` / `#15161b` editor backgrounds in `PasteTextArea.tsx` / `Workspace.tsx`
  with the theme background / semantic tokens.

Tests (`site/src/utils/__tests__/prism-theme-utils.test.ts`): drop the
Foxyz-registration and default-Foxyz assertions; assert `prism-tomorrow` default and
`rustybin-prism-theme` key. Update any `PasteTextArea` / editor-bg test assertions that
read the Foxyz background.

## Workstream D — Verify & compare ("before/after")

Automated gates (all must pass):
- `grep -ri foxy site/src site/index.html .github` → **0**.
- Orange/foxyz hex hunt over `site/src` → **0**.
- `index.css` theme tokens + `prism-theme-utils.ts` default/storage-key **match `master`**
  for every reverted value.
- `npm run build` (in `site/`) succeeds.
- Lint passes.
- `npm test` (vitest) green — including the updated theme tests.

Before/after report (new file, not a markdown rebrand) covering:
1. **Rebrand/revert completeness** — zero foxy/orange residue; token + theme parity with
   old master.
2. **What the redesign adds to master** — redesign layout/UX, single-container Docker
   deploy, always-on editor line numbers — with branding, colors, and editor theme
   identical to old rustybin.

## Out of scope

- All `*.md` files (README, DOCKER.md, DEPLOYMENT.md, and historical
  `docs/superpowers/{specs,plans}/2026-06-12-*` design/plan docs) — left untouched per
  standing preference; they keep their foxybin references as a historical record.
- No functional/behavioral changes to the redesign, Docker setup, or line-numbers
  feature beyond the color/branding/theme reverts above.

## Risks & mitigations

- **Components reference semantic tokens** (`bg-background`, `bg-card`, `bg-primary/10`)
  — reverting token *values* cascades cleanly, so the full literal revert is safe without
  touching component markup, except for the explicitly-hunted hardcoded hexes.
- **Test drift** — the theme tests assert Foxyz; they are updated in Workstream C, not
  deleted wholesale, so coverage of the theme loader stays intact.
- **Uncommitted polish vs rename order** — commit the polish *before* the rename sweep so
  the sweep is a clean, isolated diff.
