# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 10-stage Node.js pipeline that captures a live website with Playwright, analyzes its DOM/CSS/screenshot, derives functional and technical specs, and generates a runnable rebuild (a static Vite project) — then QA-validates the whole chain. There is no test suite; correctness is verified by running stages and inspecting their JSON outputs.

## Commands

```bash
npm install

npm run pipeline                # full pipeline, including live Playwright capture
npm run pipeline:skip-capture   # reuse existing capture/raw/* instead of re-capturing

# Individual stages (each reads the previous stage's output from disk)
npm run capture           # node capture/index.js — Playwright capture (not part of pipeline's fn-call chain, invoked via execSync)
npm run normalize
npm run analyze
npm run style-extraction
npm run collector
npm run ai-analysis
npm run functional-spec
npm run technical-spec
npm run generate
npm run qa
```

`pipeline/index.js` also supports flags: `node pipeline/index.js --from <stage>` (run from a stage onward), `--only <stage>` (run a single stage), `--skip-capture`.

There is no lint or test command configured in `package.json`. To sanity-check a change, run the affected stage(s) directly (e.g. `npm run analyze`) and inspect the JSON written to that stage's `output/` directory, or run `npm run qa` to validate the full output set.

`docs/archive/` holds older architecture/status audit docs that are no longer maintained and may not match the current code — this file (`CLAUDE.md`) is the current source of truth.

## Architecture

### Pipeline flow

```
capture → normalize → analyzer → style-extraction → collector
  → ai-analysis → functional-spec → technical-spec → generator → qa
```

Every stage is a standalone directory with its own `index.js`. Stages do **not** call each other in-process — each one reads JSON/HTML files written by the previous stage from a fixed path on disk, and writes its own output files. `pipeline/index.js` is the only place that sequences them, by `require()`-ing each stage's `index.js` and calling a specific named export (see `STAGES` array in `pipeline/index.js` — e.g. `normalize/index.js` must export `runNormalize`, `analyzer/index.js` must export `runAnalyze`, etc.). If you add a stage or rename its entry function, update the `STAGES` array too.

The `capture` stage is the exception: it's a standalone IIFE script (no exported function) and the pipeline shells out to it with `execSync('node capture/index.js')` rather than requiring it.

### Shared infrastructure (`shared/`)

- `shared/paths.js` — the single source of truth for every input/output file path in the pipeline, namespaced by stage (`paths.normalize.dom`, `paths.analyzer.components`, etc.). When adding a new output file, add it here rather than hardcoding a path in the stage module.
- `shared/load.js` — `readJson`/`writeJson`/`ensureDir` helpers, plus `loadDomNodes()` and `loadCssStyles()` which normalize away the "is this an array or an object with a nested array" ambiguity in `dom.json`/`css.json` (both shapes have existed historically — always read through these helpers rather than accessing `.nodes`/`.styles` directly).
- `shared/dom-parser.js` — `parseHtmlToNodes()`, the cheerio-based HTML → flat node-list parser used by `normalize/dom.js`. Skips `SCRIPT`/`STYLE`/`NOSCRIPT`/`SVG`/`PATH` tags and captures tag, id, class, depth, direct text (truncated to 200 chars), role, href, type, name, aria-label per node.

### Configuration

`capture/config.js` is the single config file (there used to be a duplicate, disconnected root `config.js` — it was removed; see `docs/archive/`). It reads `CAPTURE_TARGET` (default `https://preny.ai`) and `CAPTURE_HEADLESS` (`'true'`/unset — default `false`, i.e. visible browser) from env, plus per-artifact output paths (relative, resolved from cwd), `browser.channel: 'chrome'`, and `viewport` (1440×900).

All downstream stages (`normalize` onward) resolve paths via `shared/paths.js`, independent of `capture/config.js`.

### Data contracts between stages

- `normalize/output/dom.json` and `analyzer` modules expect `{ nodes: [...], statistics: {...} }` (produced by `shared/dom-parser.js`). Always go through `loadDomNodes()` from `shared/load.js` when consuming it.
- `normalize/output/css.json` is `{ totalElements, styles: [...] }`. Always go through `loadCssStyles()` when consuming it.
- `analyzer/output/analysis.json` (from `analyzer/merge.js`) aggregates layout, components, design, interaction, and vision analysis into one document — this is the primary input for `style-extraction`, `collector`, and `ai-analysis`.
- `collector/output/dataset.json` aggregates every upstream artifact (capture report, normalize, analyzer, style-extraction) into one unified, provenance-tagged document — this is what `ai-analysis`, `spec/functional`, and `spec/technical` build on.
- `qa/index.js` treats `status: 'placeholder'` anywhere in an output JSON tree as a failure (`checkPlaceholders()`), and also runs `npm install && npm run build` inside the generated `rebuild/output/` project to confirm the generated Vite site actually builds. It also requires `capture/report.json` to exist (fails on a fresh checkout that never ran capture) and surfaces a `captureStatus` block (age of the capture data, a `stale: true` flag + warning once it's older than 24h, and any `files.*: false` entries from the capture report) — this is informational only and does **not** fail the run by itself, since running the rest of the pipeline against older capture data via `--skip-capture` is a legitimate, intentional mode.
- `spec/technical/output/spec.json` (`stack`, `dependencies`) is derived from `ai-analysis`'s `recommendations.framework` (hardcoded `'static-html'`) and is written to match what `generator/` actually produces (static HTML/CSS + Vite, no runtime framework). `generator/index.js` does **not** read `spec/technical/output/spec.json` at all — the two are independent and must be kept manually consistent if either changes; don't add framework-specific recommendations here unless `generator/` is also changed to act on them.

### Generated output

`generator/index.js` emits a runnable static Vite project into `rebuild/output/` (`index.html`, CSS built from design tokens, `package.json` with `vite` as the only dependency, `vite.config.js`). This directory is a build artifact, not hand-maintained source — regenerate it via `npm run generate` rather than editing it directly.

### Module directory reference

| Stage | Reads from | Writes to |
|---|---|---|
| `capture/` | live target URL (Playwright) | `capture/raw/**`, `capture/report.json` |
| `normalize/` | `capture/raw/**` | `normalize/output/*.json` |
| `analyzer/` | `normalize/output/*.json` | `analyzer/output/*.json` |
| `style-extraction/` | `normalize/output/css.json`, `analyzer/output/design.json` | `style-extraction/output/tokens.json` |
| `collector/` | all prior outputs + `capture/report.json` | `collector/output/dataset.json` |
| `ai-analysis/` | `collector/output/dataset.json`, `normalize/output/text.json` | `ai-analysis/output/semantic.json` |
| `spec/functional/` | `ai-analysis/output/semantic.json`, `analyzer/output/analysis.json` | `spec/functional/output/{spec.json,spec.md}` |
| `spec/technical/` | all prior outputs | `spec/technical/output/{spec.json,spec.md}` |
| `generator/` | technical spec, tokens, analysis | `rebuild/output/` |
| `qa/` | every stage's output + builds `rebuild/output/` | `qa/output/{report.json,report.md}` |

### Known rough edges (worth checking before assuming behavior)

- `normalize/output/text.json` is written but not consumed by `analyzer/` (picked up downstream by `ai-analysis/` and `generator/` for the hero title text). `normalize/html.js` was removed — its output was a strict subset of `normalize/output/dom.json`'s own `html` field (same raw HTML string), so it was pure duplication with no independent consumer.
- `ai-analysis/index.js`'s `extractContentSections(layout, components, allNodes)` reconstructs the page's real body structure instead of flat-scanning component types: `findTopLevelBodySections()` picks the outermost real `<section>`/`<aside>` elements from `analysis.layout.semanticSections` (using each section's `index`/`endIndex` — see below — to exclude sections nested inside another section), then for each one gathers the real components and raw DOM text falling inside its `[index, endIndex)` range to derive a `type` (majority vote among specific component types: hero/pricing/cta/testimonial/card/modal, falling back to `'section'`) and representative `text` (the longest real text found in that subtree, searched over the **full** `dataset.normalize.dom.nodes` list — not `components.json`, which only carries a filtered subset of tags and would otherwise miss real H1/H2/P text). One `contentSections` entry now corresponds to one real DOM section, in true document order.
- `generator/index.js`'s `buildBodySections()` renders one HTML `<section>` per `contentSections` entry (heading from `SECTION_HEADINGS[type]`, or `"Section N"` for the generic fallback type, or the capitalized type name otherwise) — no longer groups multiple real sections into one shared "Features" grid. A section with no extracted text is dropped entirely rather than rendered empty. Verified against two structurally unrelated live captures (`preny.ai`: 8 real sections incl. 3 `card`-classified; `playwright.dev`: 6 real sections) — output is driven entirely by `layout.json`/`components.json`/`dom.json`, not hardcoded per-site.
- Every node from `shared/dom-parser.js` carries a document-order `index`; `analyzer/layout.js`'s `semanticSections[]` additionally carries `endIndex` (`findSectionEnd()`: the index of the next node whose `depth` is `<=` the section's own depth — i.e. the real end of that section's DOM subtree, not just "the next section in the flat list"). `endIndex` is what makes cross-referencing "which components/text live inside which real section" correct even when sections nest (e.g. `NAV` correctly bounded inside `HEADER`). **Whenever `analyzer/layout.js` (or any single analyzer sub-module) is edited directly, `analyzer/merge.js` (or `node analyzer/index.js`) must be re-run before `collector/`** — `collector/index.js` reads the already-merged `analyzer/output/analysis.json`, not the individual `layout.json`/`components.json`/etc. files, so a stale merge silently serves old data to every downstream stage (this bit us once while building this feature: fixed `layout.js` but forgot to re-merge, and `ai-analysis` kept reading `endIndex: undefined` from the stale `analysis.json`).
- `analyzer/component.js`'s `detectComponentType()` checks class-name heuristics (`hero`/`pricing`/`cta`/`testimonial`/etc.) **before** falling back to the generic `SEMANTIC_TAGS` tag map. This order matters: `SECTION` is in `SEMANTIC_TAGS` (→ `'section'`), and HTML5 `<section>` is the generic wrapper tag most real sites use for pricing/cta/testimonial blocks — checking tag-based mapping first would silently classify every one of them as `'section'` and the class-based checks would never run. Keep the class checks first if extending this function.
- `analyzer/design.js` drops font-family values matching `/^__/` (`isSyntheticFontName`) before computing `primaryFont`/`typography.fonts` — build tools like Next.js's `next/font` report an internal, non-portable identifier (e.g. `__Inter_bfdb96`) as the computed `font-family`, which only resolves via an `@font-face` rule private to the source site. Copying it verbatim into `rebuild/output/styles/tokens.css` produced a `--font-primary` declaration that could never match any real font. If every observed font-family on a page is synthetic, `primaryFont` is `null` — `generator/buildTokensCss()` already guards on this (`if (tokens.typography.primaryFont)`) and omits the CSS variable entirely rather than emitting a broken value.
- `capture/report.js` reads `target` from `capture/config.js` (via `require('./config')`) rather than a hardcoded string — verified live against a second, different target (`https://playwright.dev`, via `CAPTURE_TARGET`) to confirm the whole pipeline is not implicitly hardcoded to `preny.ai`; `capture/report.json.target`, `collector/output/dataset.json.source.target`, and `spec/functional/output/spec.json.projectName` all correctly reflected the alternate target end-to-end.
- `ai-analysis/index.js`'s `language` field is detected via a Vietnamese-diacritics regex (`VIETNAMESE_CHARS`) and is currently not consumed by any downstream stage — it's informational only.

### Known external blocker — live capture against the default target

As of this writing, `npm run capture` (and `npm run pipeline` without `--skip-capture`) **fails** against the default target `https://preny.ai`:

```
page.goto: net::ERR_CERT_DATE_INVALID at https://preny.ai/
```

This is **not a bug in this repo** — verified with `openssl s_client -connect preny.ai:443`: the site's TLS certificate has `notAfter=Aug 1 2026`, i.e. it has expired. `capture/index.js`'s `browser.newContext({...})` does not pass `ignoreHTTPSErrors: true`, so Playwright correctly refuses to load the page. Options if this needs to be unblocked: (a) wait for the target to renew its certificate, (b) point `CAPTURE_TARGET` at a different site with a valid cert (confirmed working: `CAPTURE_TARGET=https://playwright.dev CAPTURE_HEADLESS=true npm run capture` completed a real live capture and ran cleanly through the full pipeline), or (c) deliberately add `ignoreHTTPSErrors: true` to the context in `capture/browser.js`/`capture/index.js` — a real security trade-off (silently accepts invalid certs), not something to add casually. `--skip-capture` (reusing the existing `capture/raw/*` artifacts from a prior successful run) remains fully supported and is what `qa/index.js`'s `captureStatus` is designed to make visible rather than silent.
