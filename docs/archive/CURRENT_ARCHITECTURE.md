> **[ARCHIVED — 2026-08-02]** Tài liệu này đã lỗi thời và không còn được cập nhật. Nguồn sự thật hiện tại là `CLAUDE.md` ở root repo, được kiểm chứng trực tiếp bằng mã nguồn. File này được giữ lại chỉ để tham khảo lịch sử audit.

# Current Architecture

## Overview

The repository implements the first three stages of a website rebuild pipeline: **Capture → Normalize → Analyzer**. Each stage is a standalone Node.js module invoked via its own `index.js` entry point. There is no root orchestrator, `package.json`, or shared configuration layer yet.

Target use case: capture a live website (currently `https://preny.ai`), normalize raw artifacts into structured JSON, and analyze them to produce rebuild-oriented metadata.

## Directory Structure

```
capture/              # Stage 1: Playwright capture
normalize/            # Stage 2: Raw → structured JSON
analyzer/             # Stage 3: Layout, components, design, interactions, vision
style-extraction/     # Stage 4: Design tokens from CSS
collector/            # Stage 5: Unified dataset
ai-analysis/          # Stage 6: Semantic analysis
spec/
  functional/         # Stage 7: Functional specification
  technical/          # Stage 8: Technical specification
generator/            # Stage 9: Source code generation
rebuild/output/       # Generated rebuildable site
qa/                   # Stage 10: Validation
pipeline/             # End-to-end orchestrator
shared/               # Paths, loaders, DOM parser
config.js             # Root configuration
```

## Pipeline Flow

```
Capture → Normalize → Analyzer → Style Extraction → Collector
  → AI Analysis → Functional Spec → Technical Spec → Generator → QA
```

Each stage reads upstream outputs and writes its own outputs. The root orchestrator is `pipeline/index.js`.

Run: `npm run pipeline` or `npm run pipeline:skip-capture`

### Stage 1 — Capture

**Input:** Target URL from `capture/config.js`

**Process:** Playwright opens Chrome, navigates to target, waits for `networkidle`, then sequentially saves:

| Artifact | Path |
|----------|------|
| Screenshot | `capture/raw/screenshots/home.png` |
| HTML | `capture/raw/html/index.html` |
| DOM | `capture/raw/dom/dom.html` |
| Computed styles | `capture/raw/style/styles.json` |
| Cookies | `capture/raw/cookies/cookies.json` |
| Storage | `capture/raw/storage/*.json` |
| HAR | `capture/raw/har/preny.har` |
| WebSocket frames | `capture/raw/websocket/frames.json` (only if WS closes) |

**Output:** Raw files under `capture/raw/` plus `capture/report.json`

**Dependencies:** `playwright` (external, not declared in repo)

### Stage 2 — Normalize

**Input:** Raw capture artifacts

**Process:** Each sub-module reads one raw source and writes one JSON file:

| Module | Input | Output | Format |
|--------|-------|--------|--------|
| html.js | `index.html` | `html.json` | `{ length, html }` |
| dom.js | `dom.html` | `dom.json` | `{ length, dom }` — HTML string only |
| css.js | `styles.json` | `css.json` | `{ totalElements, styles[] }` |
| text.js | `dom.html` | `text.json` | `{ length, text }` |
| assets.js | file existence checks | `assets.json` | boolean flags |

**Output:** Five JSON files in `normalize/output/`

**Known gap:** `dom.json` stores raw HTML string; downstream Analyzer modules expect a parsed node array.

### Stage 3 — Analyzer

**Input:** Normalized JSON from `normalize/output/`

**Process:** Six analysis steps plus merge:

| Module | Primary Input | Output | Status |
|--------|--------------|--------|--------|
| layout.js | dom.json | layout.json | Placeholder |
| component.js | dom.json | components.json | Partial — expects node array |
| design.js | css.json | design.json | Placeholder |
| interaction.js | dom.json | interaction.json | Partial — expects node array |
| vision.js | assets.json | vision.json | Placeholder |
| merge.js | all above | analysis.json | Bug — wrong filename |

**Output:** Six JSON files in `analyzer/output/`

**Known gaps:**
- Data contract mismatch with Normalize output
- `merge.js` references `component.json` instead of `components.json`
- `layout.js`, `design.js`, `vision.js` emit placeholder summaries
- `component.js` and `interaction.js` produce zero counts due to format mismatch

## Missing Stages (Target Architecture)

All target stages are now implemented. See `pipeline/index.js` for the full chain.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Browser automation | Playwright (Chromium/Chrome) |
| Data format | JSON files on disk |
| Package management | npm (package.json) |

## Configuration

All paths are hardcoded relative to repository root. Target URL is hardcoded in `capture/config.js` as `https://preny.ai`. No environment variable or CLI argument support exists.

## Data Contracts (Current vs Expected)

### dom.json — Current
```json
{ "length": 348092, "dom": "<html>...</html>" }
```

### dom.json — Expected by Analyzer
```json
{ "nodes": [{ "tag": "DIV", "id": "...", "class": "..." }] }
```

### css.json — Current (correct)
```json
{ "totalElements": 1960, "styles": [{ "tag": "HTML", "style": { ... } }] }
```

### css.json — Read incorrectly by design.js
`design.js` checks `Array.isArray(css)` on the whole file instead of `css.styles`.
