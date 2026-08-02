# Website/App Rebuild Engine

**Baseline snapshot — 2026-08-02.** This is the stable origin point for further development: a 10-stage Node.js pipeline that captures a live website, understands its structure, and regenerates it as a runnable, buildable static project.

```
Capture → Normalize → Analyze (Model) → Style Extraction → Collector
  → Semantic Analysis → Functional Spec → Technical Spec → Code Generator → Build → QA
```

Verified end-to-end against two structurally unrelated live sites (a Tailwind-based SaaS landing page and a Docusaurus documentation site) — the pipeline is data-driven, not hardcoded to one target.

For the detailed, evidence-level architecture reference (module-by-module contracts, known rough edges, operational gotchas), see [`CLAUDE.md`](./CLAUDE.md). This README is the human-facing getting-started + handoff document.

---

## 1. Install

```bash
npm install
```

Requires Node.js (tested on v22) and, for live capture, a local Google Chrome install (`capture/config.js` launches via Playwright's `channel: 'chrome'`).

---

## 2. Run

### Full pipeline, capturing a live site

```bash
CAPTURE_TARGET=https://example.com npm run pipeline
```

`CAPTURE_TARGET` defaults to `https://preny.ai` if omitted. `CAPTURE_HEADLESS=true` runs the browser headless (default is a visible window).

### Full pipeline, reusing the last capture (no network needed)

```bash
npm run pipeline:skip-capture
```

This baseline ships with a real, already-captured dataset for `https://preny.ai` under `capture/raw/` — running this command works immediately after `npm install`, with no network access required.

### Individual stages

Each stage reads the previous stage's output from disk and can be re-run independently:

```bash
npm run capture           # live Playwright capture
npm run normalize         # raw capture → structured JSON
npm run analyze           # layout / component / design / interaction / vision models
npm run style-extraction  # design tokens (colors, typography, spacing)
npm run collector         # unify everything into one dataset
npm run ai-analysis       # semantic analysis (page type, features, real section reconstruction)
npm run functional-spec   # human-readable functional spec (.json + .md)
npm run technical-spec    # human-readable technical spec (.json + .md)
npm run generate          # generate the rebuilt static project into rebuild/output/
npm run qa                # validate every stage's output + build rebuild/output/
```

`pipeline/index.js` also accepts `--from <stage>` (resume from a stage) and `--only <stage>` (run a single stage).

### Run the generated site

```bash
cd rebuild/output
npm install
npm run dev      # dev server
npm run build    # production build → dist/
```

(`npm run qa` already does `npm install && npm run build` inside `rebuild/output/` as part of validation — a passing QA report is proof the generated project builds.)

---

## 3. Architecture

| Stage | Directory | Input | Output |
|---|---|---|---|
| Capture | `capture/` | Live target URL (Playwright) | `capture/raw/**`, `capture/report.json` |
| Normalize | `normalize/` | `capture/raw/**` | `normalize/output/*.json` (parsed DOM node tree, CSS, text, asset manifest) |
| Analyze (Model) | `analyzer/` | `normalize/output/*.json` | `analyzer/output/*.json` — Layout Model, Component Model, Design Model, Interaction Model, Vision Model, merged into `analysis.json` |
| Style Extraction | `style-extraction/` | `css.json`, `design.json` | `style-extraction/output/tokens.json` |
| Collector | `collector/` | every prior output | `collector/output/dataset.json` — one unified, provenance-tagged dataset |
| Semantic Analysis | `ai-analysis/` | `dataset.json` | `ai-analysis/output/semantic.json` — page type, features, real reconstructed content sections |
| Functional Spec | `spec/functional/` | `dataset.json`, `semantic.json` | `spec/functional/output/{spec.json,spec.md}` |
| Technical Spec | `spec/technical/` | all prior outputs | `spec/technical/output/{spec.json,spec.md}` |
| Code Generator | `generator/` | `dataset.json`, `semantic.json`, `tokens.json` | `rebuild/output/` — a runnable static Vite project |
| QA | `qa/` | every stage's output + builds `rebuild/output/` | `qa/output/{report.json,report.md}` |

`shared/` holds the cross-cutting infrastructure every stage depends on: `paths.js` (single source of truth for every file path), `load.js` (JSON I/O + shape-normalizing helpers), `dom-parser.js` (HTML → flat, document-ordered node list, the root of the whole Model layer).

**The core idea that makes "understand structure, then generate" actually work:** every parsed DOM node carries a document-order `index`. `analyzer/layout.js` additionally computes `endIndex` for each real semantic section (`<header>`/`<nav>`/`<main>`/`<section>`/`<footer>`/`<aside>`) — the index of the next node at an equal-or-shallower depth, i.e. the true end of that section's DOM subtree. `ai-analysis/index.js` uses this `[index, endIndex)` range to correlate which real components and real text fall inside which real section, so the generated site's sections mirror the source site's actual structure instead of a fixed template. See `CLAUDE.md` for the full mechanics and the operational gotcha around re-running `analyzer/merge.js` after touching any individual `analyzer/*.js` module.

---

## 4. Standard (reference) output

This baseline ships with a complete, real, verified run already committed to the working tree — not synthetic fixtures:

- `capture/raw/**` + `capture/report.json` — a real capture of `https://preny.ai` (2026-08-01).
- `normalize/output/*.json`, `analyzer/output/*.json`, `style-extraction/output/tokens.json`, `collector/output/dataset.json`, `ai-analysis/output/semantic.json`, `spec/*/output/*` — the full Model + Spec chain computed from that capture.
- `rebuild/output/{index.html,styles/,package.json,vite.config.js}` — the generated static project source (regenerate with `npm run generate`), plus a freshly rebuilt `node_modules/`/`dist/` as live proof it actually builds. `.gitignore` excludes both from any future version control — they're regenerated on demand (`npm run qa`, or manually: `cd rebuild/output && npm install && npm run build`), not hand-maintained.
- `qa/output/{report.json,report.md}` — the QA run this baseline was verified against: **PASSED**, 13/13 output checks, 0 placeholders, build succeeded (`distExists: true`).

Regenerate all of the above deterministically at any time with:

```bash
npm run pipeline:skip-capture
```

---

## 5. Developing further

Start with [`CLAUDE.md`](./CLAUDE.md) — it has the module-by-module data contracts, the "Known rough edges" section (things that are real but low-priority), and the one documented external blocker (the default target's TLS certificate). Read it before changing any `analyzer/*` or `generator/*` module; the Model layer's `index`/`endIndex` correlation and the merge-then-collect ordering are easy to break silently.

Working principles established over this project's development (keep following them):

- **Understand before changing.** For any module: what does it read, what does it write, what reads its output, what breaks downstream if you change it. `shared/paths.js` and `docs/archive/DEPENDENCY_GRAPH.md` (historical, not authoritative) show prior data-flow mapping.
- **Prefer extending existing modules over adding new ones.** Every module currently in the tree earned its place through this discipline — nothing was added speculatively.
- **Never fabricate data.** Every generator function either renders real extracted content or omits the section entirely (`.filter(Boolean)` on the section list in `generator/index.js`). If you add a new content type, keep this contract: no placeholder text, no hardcoded fallback content standing in for missing real data.
- **Re-verify after every change**, from a clean state: `rm -rf */output rebuild/output/{node_modules,dist}` (or the relevant subset) then `npm run pipeline:skip-capture` and check `qa/output/report.json.passed`. Stale intermediate output has caused real bugs during development (see `CLAUDE.md`'s note on `analyzer/merge.js`).
- **Test structural changes against more than one site.** A fix that only works on `preny.ai`'s specific markup may be accidentally hardcoded; this project uses `CAPTURE_TARGET=<url> npm run capture` against a second, structurally different site as its main generality check.

### Known open items (not blockers, intentionally deferred — see `CLAUDE.md` for full detail)

- `generator/index.js` still renders a fixed overall page shape (header → hero → real body sections → contact form → footer); it does not yet decide *which* structural elements (nav vs. aside vs. multiple `<main>` regions) get dedicated treatment beyond header/footer/section/aside.
- Minor heuristic overlap in `analyzer/component.js`'s class-name matching (e.g. a class containing both `cta` and `banner` resolves to `hero`) — real but low-impact, not fixed because it would add complexity without evidenced need.
- Live capture of the default target (`https://preny.ai`) is blocked by that site's own expired TLS certificate — external, not a repo defect. `npm run pipeline:skip-capture` is unaffected.

### Known external blocker

See `CLAUDE.md`'s "Known external blocker" section — `https://preny.ai`'s TLS certificate is currently expired, so live capture against the default target fails with `net::ERR_CERT_DATE_INVALID`. This does not affect `npm run pipeline:skip-capture`, which this baseline is fully self-contained for.
