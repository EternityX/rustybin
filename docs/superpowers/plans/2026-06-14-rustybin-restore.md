# Rustybin Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the full `003-foxybin-redesign` work onto `master` with the rustybin brand, old rustybin color values, and old `prism-tomorrow` editor theme restored — keeping all redesign layout/structure and features.

**Architecture:** Work on branch `004-rustybin-restore` (already created off `003-foxybin-redesign`). First commit the uncommitted working-tree polish as-is, then apply four restoration workstreams (branding, color revert, syntax-theme revert, verify), then merge into local `master` with `--no-ff`. Reverts restore *values* on the redesign's new token structure — components keep their semantic-token markup, so changing token values cascades.

**Tech Stack:** TypeScript, React 18.3.1, Vite 5.4.1, Tailwind CSS, Prism.js, Vitest. All `npm` commands run inside `site/`.

**Standing constraint:** Do **not** touch any `*.md` file (README, DOCKER.md, DEPLOYMENT.md, historical specs/plans). Branding sweep is code/assets/config only.

---

## Reference: old rustybin target values (from `master`)

Editor theme (in `site/src/utils/prism-theme-utils.ts`):
- `STORAGE_KEY = "rustybin-prism-theme"`
- `getStoredPrismTheme` SSR + fallback default: `"prism-tomorrow"`
- `getThemeBackground` fallback: `"#2d2d2d"`
- No `prism-foxyz` entry, no `FOXYZ_THEME_CSS`.

Font: `Inter` (not Rubik).

`index.css` `.text-rainbow`: `linear-gradient(90deg, #6ec2f7, #a982ed, #e68dc1, #f2a472)`; `.icon-rainbow`: `#a982ed`.

`<title>`: `Rustybin`. Favicon: `/favicon.svg` (rose `#AA8289` mark, present in `master`).

---

## Task 0: Commit the uncommitted working-tree polish as-is

Captures "everything incl. uncommitted" before any rename, so the sweep is a clean isolated diff.

**Files:** all 12 current working-tree changes (Workspace rewrite, `--radius: 2rem`, scrollbar, `brand-dots`, deleted `favicon.svg`, new `logomark.png`, etc.) — committed verbatim, foxybin branding intact.

- [ ] **Step 1: Confirm you are on the restore branch**

Run: `git branch --show-current`
Expected: `004-rustybin-restore`

- [ ] **Step 2: Stage everything including the untracked logomark and the favicon deletion**

```bash
git add -A site/
```

- [ ] **Step 3: Verify the staged set matches the expected 12 paths**

Run: `git diff --cached --name-status`
Expected: modifications to `site/index.html`, `site/src/components/layout/Layout.tsx`, `site/src/components/paste/Changelog.tsx`, `site/src/components/paste/MarkdownToolbar.tsx`, `site/src/components/paste/Terms.tsx`, `site/src/components/paste/markdown-styles.css`, `site/src/components/ui/select.tsx`, `site/src/index.css`, `site/src/pages/Index.tsx`, `site/src/pages/Workspace.tsx`; deletion of `site/public/favicon.svg`; addition of `site/public/logomark.png`.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(redesign): capture uncommitted foxybin redesign polish as-is"
```

- [ ] **Step 5: Confirm clean tree**

Run: `git status --short`
Expected: no output (clean).

---

## Task 1: Workstream A — Branding sweep (code/assets/config only)

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/components/layout/Layout.tsx:149-155` (wordmark)
- Modify: `site/src/pages/Workspace.tsx:515-521` (wordmark)
- Modify: `site/src/components/workspace/WorkspaceSidebar.tsx:103-106` (sidebar mark)
- Modify: `site/src/components/paste/Privacy.tsx:33`
- Modify: `site/src/components/paste/Terms.tsx:29`
- Modify: `site/src/components/paste/SecurityInfo.tsx:27`
- Modify: `site/src/index.css` (foxyz comments)
- Modify: `.github/workflows/docker-ci.yml:10`
- Restore: `site/public/favicon.svg`; Delete: `site/public/logomark.png`

- [ ] **Step 1: index.html — title and favicon**

In `site/index.html`, replace:
```html
    <title>FOXYBIN</title>
```
with:
```html
    <title>Rustybin</title>
```
and replace:
```html
    <link rel="icon" type="image/svg+xml" href="/logomark.png" />
```
with:
```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 2: Header wordmark in Layout.tsx**

In `site/src/components/layout/Layout.tsx`, replace:
```tsx
              <span className="group text-[12px] uppercase tracking-wider font-bold transition-colors">
                <span className="brand-gradient">foxy</span>
                <span className="text-[12px] uppercase tracking-wider font-bold text-white group-hover:text-white/50 transition-colors">
                  bin
                </span>
              </span>
```
with:
```tsx
              <span className="text-[12px] uppercase tracking-wider font-bold text-foreground transition-colors">
                Rustybin
              </span>
```

- [ ] **Step 3: Header wordmark in Workspace.tsx**

In `site/src/pages/Workspace.tsx`, replace the identical block:
```tsx
              <span className="group text-[12px] uppercase tracking-wider font-bold transition-colors">
                <span className="brand-gradient">foxy</span>
                <span className="text-[12px] uppercase tracking-wider font-bold text-white group-hover:text-white/50 transition-colors">
                  bin
                </span>
              </span>
```
with:
```tsx
              <span className="text-[12px] uppercase tracking-wider font-bold text-foreground transition-colors">
                Rustybin
              </span>
```

- [ ] **Step 4: Sidebar mark in WorkspaceSidebar.tsx**

In `site/src/components/workspace/WorkspaceSidebar.tsx`, replace:
```tsx
            <span className="text-primary">foxy</span>
            <span className="text-white hover:text-white/50 transition-colors">
              bin
            </span>
```
with:
```tsx
            <span className="text-foreground">Rustybin</span>
```

- [ ] **Step 5: Legal/marketing copy**

In `site/src/components/paste/Privacy.tsx`, replace `foxybin does not require` line's two `foxybin` with `rustybin`:
```tsx
            rustybin does not require personally identifiable information to use our service. To avoid providing rustybin personal information, use Tor or a VPN, and follow basic OPSEC guidelines.
```
In `site/src/components/paste/Terms.tsx`, replace:
```tsx
          By using rustybin (the "Service"), you agree to the following terms:
```
In `site/src/components/paste/SecurityInfo.tsx`, replace:
```tsx
          How rustybin ensures your data remains private and unreadable by anyone but you or anyone you share the link with.
```

- [ ] **Step 6: Rename foxyz comments in index.css**

In `site/src/index.css`, replace `/* foxyz button shine sweep */` → `/* button shine sweep */` and `/* foxyz orange icon tile */` → `/* icon tile */`. (The `/* foxyz brand wordmark gradient */` block is deleted in Task 2, Step 4 — leave it for now.)

- [ ] **Step 7: CI workflow branch trigger**

In `.github/workflows/docker-ci.yml`, replace the branch line:
```yaml
      - 003-foxybin-redesign
```
with:
```yaml
      - 004-rustybin-restore
```

- [ ] **Step 8: Restore favicon, remove logomark**

```bash
git checkout master -- site/public/favicon.svg
git rm site/public/logomark.png
```

- [ ] **Step 9: Verify zero foxy residue in code/assets/config (excluding the prism theme files handled in Task 6)**

Run: `grep -ril foxy site/src site/index.html .github | grep -v '\.md$' | grep -v prism-theme`
Expected: no output. (Only `site/src/utils/prism-theme-utils.ts` and its test may still contain `foxy` — those are reverted in Task 6.)

- [ ] **Step 10: Commit**

```bash
git add -A site/ .github/
git commit -m "refactor(brand): rename foxybin/foxyz to rustybin across code, assets, config"
```

---

## Task 2: Workstream B-1 — index.css token block, gradients, font

**Files:** Modify `site/src/index.css`

- [ ] **Step 1: Revert font import to Inter**

Replace line 1:
```css
@import url("https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap");
```
with:
```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap");
```

- [ ] **Step 2: Replace the `:root, .dark` token block with old rustybin values**

Replace the entire block (lines 8–51, `:root,` … closing `}`) with:
```css
  :root,
  .dark {
    --radius: 2rem;

    --background: 0 0% 18%;
    --foreground: 348 26% 60%;

    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;

    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;

    --primary: 348 26% 60%;
    --primary-foreground: 210 40% 98%;

    --secondary: 348 26% 60%;
    --secondary-foreground: 0 0% 98%;

    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;

    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 210 40% 98%;

    --success: 156 78% 34%;
    --warning: 45 93% 47%;

    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 348 26% 60%;

    --sidebar-background: 0 0% 6%;
    --sidebar-foreground: 240 4.8% 95.9%;
    --sidebar-primary: 348 26% 60%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 0 0% 12%;
    --sidebar-accent-foreground: 240 4.8% 95.9%;
    --sidebar-border: 0 0% 13%;
    --sidebar-ring: 348 26% 60%;
  }
```
(Note: `--radius: 2rem`, `--success`, `--warning`, `--background` var, and the combined `:root, .dark` selector are redesign structure — kept. Only color *values* change.)

- [ ] **Step 3: Revert the two rainbow gradients**

Replace:
```css
.text-rainbow {
  background: linear-gradient(90deg, #ff6600, #ff8c33, #ffb37a);
```
with:
```css
.text-rainbow {
  background: linear-gradient(90deg, #6ec2f7, #a982ed, #e68dc1, #f2a472);
```
and replace:
```css
.icon-rainbow {
  color: #ff8c33;
}
```
with:
```css
.icon-rainbow {
  color: #a982ed;
}
```

- [ ] **Step 4: Delete the now-unused `.brand-gradient` block**

Remove these lines entirely:
```css
/* foxyz brand wordmark gradient */
.brand-gradient {
  background: linear-gradient(180deg, #ff6600, #dc3e00);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

```

- [ ] **Step 5: Verify no orange/foxy hex remains in index.css**

Run: `grep -nE "#ff6600|#ff8c33|#ffb37a|#dc3e00|brand-gradient" site/src/index.css`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add site/src/index.css
git commit -m "style(theme): restore old rustybin color tokens, gradients, and Inter font"
```

---

## Task 3: Workstream B-2 — tailwind.config.ts font

**Files:** Modify `site/tailwind.config.ts`

- [ ] **Step 1: Revert the sans font family to Inter**

In `site/tailwind.config.ts`, replace:
```ts
    			sans: [
    				'Rubik',
    				'system-ui',
    				'sans-serif'
    			],
```
with:
```ts
    			sans: [
    				'Inter',
    				'SF Pro Display',
    				'system-ui',
    				'sans-serif'
    			],
```
(Keep all `<alpha-value>` color definitions and the `success`/`warning` colors — they are redesign structure.)

- [ ] **Step 2: Verify**

Run: `grep -n "Rubik" site/tailwind.config.ts`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add site/tailwind.config.ts
git commit -m "style(theme): revert sans font family to Inter in tailwind config"
```

---

## Task 4: Workstream B-3 — component hardcoded foxyz-hex sweep

Maps the foxyz dark-navy arbitrary Tailwind classes to old rustybin semantic tokens (which now resolve to the near-black/rose values from Task 2): `bg-[#0F1014]` → `bg-popover`, `border-[#20222a]` → `border-border`. These appear across `Layout.tsx`, `Index.tsx`, `Workspace.tsx`, `select.tsx`, `sonner.tsx`, `switch.tsx`, `FileTreeItem.tsx`, `ApiEncryption.tsx`, `Changelog.tsx`, `Privacy.tsx`, `SecurityInfo.tsx`, `Terms.tsx`. (Admin chart files are handled in Task 5 — skip them here.)

**Files:** all `*.tsx` under `site/src` except `site/src/components/admin/*`.

- [ ] **Step 1: Replace the two arbitrary classes across components**

Run (Git Bash):
```bash
grep -rl --include='*.tsx' 'bg-\[#0F1014\]' site/src | grep -v '/admin/' | while read f; do sed -i 's/bg-\[#0F1014\]/bg-popover/g' "$f"; done
grep -rl --include='*.tsx' 'border-\[#20222a\]' site/src | grep -v '/admin/' | while read f; do sed -i 's/border-\[#20222a\]/border-border/g' "$f"; done
```
This turns `bg-[#0F1014]/0` into `bg-popover/0`, `hover:bg-[#0F1014]` into `hover:bg-popover`, and `border-[1px] border-[#20222a]` into `border-[1px] border-border` — all valid.

- [ ] **Step 2: Verify no foxyz arbitrary hexes remain outside admin**

Run: `grep -rnE "#0F1014|#20222a" site/src --include='*.tsx' | grep -v '/admin/'`
Expected: no output.

- [ ] **Step 3: Sanity-check the diff touches only class strings**

Run: `git diff --stat`
Expected: only `.tsx` component files changed, no logic lines.

- [ ] **Step 4: Commit**

```bash
git add -A site/src
git commit -m "style(components): map foxyz surface/border hexes to rustybin semantic tokens"
```

---

## Task 5: Workstream B-4 — restore admin chart colors

Both admin chart files differ from `master` only in color values, so restore them wholesale.

**Files:** Restore `site/src/components/admin/TimeSeriesChart.tsx`, `site/src/components/admin/LanguageBreakdown.tsx` from `master`.

- [ ] **Step 1: Confirm the master↔branch diff is color-only (no logic)**

Run: `git diff master -- site/src/components/admin/TimeSeriesChart.tsx site/src/components/admin/LanguageBreakdown.tsx`
Expected: only `MAUVE`/`MAUVE_FILL`/`COLORS` array values and `Tooltip` `contentStyle` colors differ.

- [ ] **Step 2: Restore both from master**

```bash
git checkout master -- site/src/components/admin/TimeSeriesChart.tsx site/src/components/admin/LanguageBreakdown.tsx
```

- [ ] **Step 3: Verify old rose chart colors present, orange gone**

Run: `grep -nE "hsl\(348, 26%, 60%\)|#ff6600|#0F1014" site/src/components/admin/TimeSeriesChart.tsx site/src/components/admin/LanguageBreakdown.tsx`
Expected: matches for `hsl(348, 26%, 60%)` only; no `#ff6600` / `#0F1014`.

- [ ] **Step 4: Commit**

```bash
git add site/src/components/admin
git commit -m "style(admin): restore old rustybin chart palette (rose) and tooltip styling"
```

---

## Task 6: Workstream C — remove custom Foxyz Prism theme, restore prism-tomorrow

This file has tests — update tests first (red), then implement (green).

**Files:**
- Modify: `site/src/utils/prism-theme-utils.ts`
- Test: `site/src/utils/__tests__/prism-theme-utils.test.ts`

- [ ] **Step 1: Rewrite the test file to assert old rustybin theme behavior**

Replace the entire contents of `site/src/utils/__tests__/prism-theme-utils.test.ts` with:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismThemes, getStoredPrismTheme, getThemeBackground } from "../prism-theme-utils";

describe("Prism theme defaults", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not register a custom Foxyz theme", () => {
    expect(prismThemes.find((t) => t.value === "prism-foxyz")).toBeUndefined();
  });

  it("includes the stock Tomorrow Night theme", () => {
    const tomorrow = prismThemes.find((t) => t.value === "prism-tomorrow");
    expect(tomorrow).toBeDefined();
    expect(tomorrow?.background).toBe("#2d2d2d");
  });

  it("defaults to prism-tomorrow when nothing is stored", () => {
    expect(getStoredPrismTheme()).toBe("prism-tomorrow");
  });

  it("reads a stored theme from the rustybin storage key", () => {
    localStorage.setItem("rustybin-prism-theme", "prism-okaidia");
    expect(getStoredPrismTheme()).toBe("prism-okaidia");
  });

  it("getThemeBackground returns the Tomorrow Night background", () => {
    expect(getThemeBackground("prism-tomorrow")).toBe("#2d2d2d");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (code still ships Foxyz)**

Run: `cd site && npx vitest run src/utils/__tests__/prism-theme-utils.test.ts`
Expected: FAIL — `prism-foxyz` still registered and default is `prism-foxyz`.

- [ ] **Step 3: Restore the theme util wholesale from master**

The entire `master`↔branch diff of this file is Foxyz-only (verified), so a wholesale restore is the safe, exact way to remove the custom theme entry, `FOXYZ_THEME_CSS`, its injection branch, and revert `STORAGE_KEY`/defaults/fallbacks in one move:
```bash
git checkout master -- site/src/utils/prism-theme-utils.ts
```

- [ ] **Step 4: Confirm the file now equals master exactly**

Run: `git diff master -- site/src/utils/prism-theme-utils.ts`
Expected: no output (identical to master).

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd site && npx vitest run src/utils/__tests__/prism-theme-utils.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Verify zero foxy residue anywhere in code now**

Run: `grep -rinE "foxy" site/src site/index.html .github | grep -v '\.md$'`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add site/src/utils/prism-theme-utils.ts site/src/utils/__tests__/prism-theme-utils.test.ts
git commit -m "feat(theme): remove custom Foxyz prism theme, restore prism-tomorrow default"
```

---

## Task 7: Workstream D — verify and write before/after report

**Files:** Create `docs/superpowers/rustybin-restore-comparison.md` (new file — not a rebrand of existing docs).

- [ ] **Step 1: Gate — zero foxy residue (code/assets/config)**

Run: `grep -rinE "foxy" site/src site/index.html site/tailwind.config.ts .github | grep -v '\.md$'`
Expected: no output.

- [ ] **Step 2: Gate — zero foxyz/orange hex residue**

Run: `grep -rnE "#(ff6600|ff8c33|ffb37a|dc3e00|0F1014|20222a|15161b|ffc06a)" site/src`
Expected: no output.

- [ ] **Step 3: Gate — token + theme parity with master**

Run:
```bash
grep -nE "\-\-primary:|\-\-ring:|\-\-foreground:" site/src/index.css
grep -nE "STORAGE_KEY|prism-tomorrow" site/src/utils/prism-theme-utils.ts
```
Expected: `--primary: 348 26% 60%`, `--ring: 348 26% 60%`, `--foreground: 348 26% 60%`; `STORAGE_KEY = "rustybin-prism-theme"`; default `prism-tomorrow`.

- [ ] **Step 4: Gate — build succeeds**

Run: `cd site && npm ci && npm run build`
Expected: build completes with no errors.

- [ ] **Step 5: Gate — lint passes**

Run: `cd site && npm run lint`
Expected: exits 0 (no new errors introduced by this work; pre-existing warnings unchanged).

- [ ] **Step 6: Gate — full test suite green**

Run: `cd site && npm test`
Expected: all vitest suites pass, including `prism-theme-utils.test.ts` and `PasteTextArea.test.tsx`.

- [ ] **Step 7: Write the before/after comparison report**

Create `docs/superpowers/rustybin-restore-comparison.md` with two sections:
1. **Rebrand/revert completeness** — paste the (empty) outputs of Steps 1–3 as evidence; note `--primary`, storage key, and default theme now equal old master.
2. **What the redesign adds to master** — summarize `git diff master..004-rustybin-restore --stat` highlights: redesign layout/UX (Layout/Index/Workspace/PasteTextArea), single-container Docker deploy, always-on editor line numbers, GitHub link — with branding, colors, and editor theme identical to old rustybin. Include the `git diff --stat master..004-rustybin-restore` output.

- [ ] **Step 8: Commit the report**

```bash
git add docs/superpowers/rustybin-restore-comparison.md
git commit -m "docs(restore): before/after comparison report for rustybin restore"
```

---

## Task 8: Merge into local master (no-ff)

- [ ] **Step 1: Final clean-tree check**

Run: `git status --short`
Expected: no output.

- [ ] **Step 2: Switch to master and merge**

```bash
git switch master
git merge --no-ff 004-rustybin-restore -m "merge: rustybin restore (foxybin redesign with rustybin brand + old palette/theme)"
```
Expected: merge commit created, no conflicts (004 descends from 003, master is an ancestor).

- [ ] **Step 3: Post-merge sanity on master**

Run: `cd site && npm run build && npm test`
Expected: build + tests green on master.

- [ ] **Step 4: Confirm branding/theme on master**

Run: `grep -rinE "foxy" site/src site/index.html | grep -v '\.md$'`
Expected: no output.

- [ ] **Step 5: Report** — do not push. Tell the user master is updated locally and ready to push when they choose.

---

## Self-review notes

- **Spec coverage:** Task 0 = uncommitted polish; Task 1 = Workstream A (branding, incl. wordmark→solid "Rustybin", assets); Tasks 2–5 = Workstream B (index.css tokens/gradients/font, tailwind font, component hex sweep, admin charts); Task 6 = Workstream C (Foxyz removal + tests); Task 7 = Workstream D (gates + report); Task 8 = `--no-ff` merge to master. All spec sections mapped.
- **Markdown untouched:** every grep gate excludes `*.md`; no task edits an existing `.md`. The new comparison report and this plan are new files, allowed.
- **Kept structure (not reverted):** `<alpha-value>`, `--radius: 2rem`, `--success`/`--warning`, `--background` var, grain overlay, `.btn-shine`/`.icon-tile`, scrollbar, layout — confirmed only color *values* and branding change.
- **Type/name consistency:** `STORAGE_KEY`, `getStoredPrismTheme`, `getThemeBackground`, `loadPrismTheme`, `prism-tomorrow`, `rustybin-prism-theme`, `bg-popover`, `border-border`, `text-foreground` used consistently across tasks.
