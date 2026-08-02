> **[ARCHIVED — 2026-08-02]** Tài liệu này đã lỗi thời và không còn được cập nhật. Nguồn sự thật hiện tại là `CLAUDE.md` ở root repo, được kiểm chứng trực tiếp bằng mã nguồn. File này được giữ lại chỉ để tham khảo lịch sử audit.

# Implementation Plan

## Goal

Complete an end-to-end pipeline that captures a website, analyzes it, and rebuilds it as new source code with functional/technical specifications and QA validation.

---

## Phase 1 — Audit ✅

Deliverables:
- [x] CURRENT_ARCHITECTURE.md
- [x] PROJECT_STATUS.md
- [x] DEPENDENCY_GRAPH.md
- [x] IMPLEMENTATION_PLAN.md

---

## Phase 2 — Complete Existing Modules

Priority: fix data contracts and remove all placeholders before adding new modules.

### 2.1 Infrastructure

- [ ] Add `package.json` with declared dependencies (playwright, cheerio, sharp)
- [ ] Add `shared/paths.js` — centralized path constants
- [ ] Add `shared/load.js` — helpers to load normalized/analyzed JSON safely

### 2.2 Normalize Fixes

- [ ] **dom.js** — Parse HTML into structured node tree using cheerio
  - Output: `{ length, html, nodes[], statistics{ totalNodes, tags } }`
- [ ] **assets.js** — Include file paths and metadata, not just boolean flags
- [ ] **css.js** — Add summary statistics (display types, color count)

### 2.3 Analyzer Fixes

- [ ] **layout.js** — Analyze flex/grid/block layout from css + dom structure
- [ ] **component.js** — Detect semantic regions (header, nav, main, footer, forms)
- [ ] **design.js** — Extract color palette, typography, spacing from css.styles
- [ ] **interaction.js** — Fix input loading; enumerate interactive elements
- [ ] **vision.js** — Screenshot metadata via sharp (dimensions, format, dominant colors)
- [ ] **merge.js** — Fix `components.json` filename; add metadata wrapper

### 2.4 Capture Cleanup

- [ ] **auth.js** — Implement optional auth hook (cookie injection) or remove
- [ ] Wire **websocket.js** flush on capture end (not only on WS close)
- [ ] Ensure screenshot directory created before write

### 2.5 Phase 2 Acceptance

- [ ] `node normalize/index.js` produces parsed dom nodes
- [ ] `node analyzer/index.js` produces non-placeholder outputs
- [ ] `analysis.json` includes all 5 sub-analyses including components
- [ ] No `status: 'placeholder'` in any output

---

## Phase 3 — Missing Modules

Build in dependency order.

### 3.1 Style Extraction (`style-extraction/`)

**Input:** `normalize/output/css.json`, `analyzer/output/design.json`

**Output:** `style-extraction/output/tokens.json`

Extract:
- Color tokens (primary, secondary, background, text)
- Typography scale (font families, sizes, weights)
- Spacing scale
- Border radius, shadows
- Breakpoints (from media queries if available)

### 3.2 Collector (`collector/`)

**Input:** All normalize + analyzer + style-extraction outputs, capture report

**Output:** `collector/output/dataset.json`

Unified dataset with schema version, provenance, and cross-references.

### 3.3 AI Analysis (`ai-analysis/`)

**Input:** `collector/output/dataset.json`, `normalize/output/text.json`

**Output:** `ai-analysis/output/semantic.json`

Rule-based semantic analysis (no external API required initially):
- Page type detection (landing, SaaS, e-commerce)
- Feature identification (navigation, CTA, pricing, forms, chat)
- User flow mapping
- Content sections

### 3.4 Functional Specification (`spec/functional/`)

**Input:** `ai-analysis/output/semantic.json`, `analyzer/output/analysis.json`

**Output:** `spec/functional/output/spec.json`, `spec.md`

Structured functional requirements document.

### 3.5 Technical Specification (`spec/technical/`)

**Input:** All prior outputs

**Output:** `spec/technical/output/spec.json`, `spec.md`

Stack recommendation, component architecture, data model, API surface.

### 3.6 Code Generator (`generator/`)

**Input:** Technical spec, tokens, analysis

**Output:** `rebuild/output/` — runnable project

Generate:
- Next.js or static HTML/CSS project structure
- Components mapped from analysis
- Theme from design tokens
- Pages from layout/semantic analysis

### 3.7 QA (`qa/`)

**Input:** All pipeline outputs + rebuild output

**Output:** `qa/output/report.json`, `report.md`

Validate:
- All expected files exist
- No placeholders
- Schema compliance
- Rebuild project builds and serves

---

## Phase 4 — Pipeline Integration

### 4.1 Root Orchestrator (`pipeline/index.js`)

```javascript
capture → normalize → analyzer → style-extraction → collector
  → ai-analysis → spec/functional → spec/technical → generator → qa
```

### 4.2 Configuration

- [ ] Root `config.js` with target URL, output dirs
- [ ] CLI args: `--target`, `--skip-capture`, `--stage`

### 4.3 Validation Gates

Each stage validates its inputs before processing. Pipeline aborts with clear error if upstream output missing or invalid.

---

## Phase 5 — QA & Hardening

- [ ] Run full pipeline against preny.ai capture data
- [ ] Fix all failures
- [ ] Verify rebuild output builds (`npm run build`)
- [ ] Verify rebuild serves (`npm run dev`)
- [ ] Update all documentation to match final code
- [ ] Final acceptance checklist pass

---

## Implementation Order (Execution Sequence)

```
Week 1 equivalent (immediate):
  package.json + shared/
  normalize/dom.js fix
  analyzer/* complete
  merge.js fix

Week 2 equivalent:
  style-extraction/
  collector/
  ai-analysis/

Week 3 equivalent:
  spec/functional/
  spec/technical/
  generator/

Week 4 equivalent:
  qa/
  pipeline/index.js
  end-to-end test + docs update
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| DOM too large to parse | Flat node list with depth limit; skip script/style content |
| No AI API | Rule-based semantic analysis first; AI layer optional later |
| Generated code quality | Start with component shell + tokens; iterate on templates |
| Playwright not installed | Declare in package.json; document setup |
| Hardcoded preny.ai | Centralize config; support CLI override |

---

## Success Criteria

All items from project acceptance criteria met:

1. Full pipeline runs end-to-end with single command
2. Zero placeholders in any output
3. Every module has valid Input → Process → Output
4. Rebuild project builds and runs
5. Documentation reflects actual implementation
