> **[ARCHIVED — 2026-08-02]** Tài liệu này đã lỗi thời và không còn được cập nhật. Nguồn sự thật hiện tại là `CLAUDE.md` ở root repo, được kiểm chứng trực tiếp bằng mã nguồn. File này được giữ lại chỉ để tham khảo lịch sử audit.

# Project Status

Last updated: 2026-08-02

## Summary

| Area | Status | Completion |
|------|--------|------------|
| Capture | Working | 95% |
| Normalize | Working | 95% |
| Analyzer | Complete | 95% |
| Style Extraction | Complete | 90% |
| Collector | Complete | 90% |
| AI Analysis | Complete | 85% |
| Functional Spec | Complete | 90% |
| Technical Spec | Complete | 90% |
| Code Generator | Complete | 85% |
| QA | Complete | 95% |
| Pipeline Orchestration | Complete | 95% |
| Documentation | Complete | 90% |

**Overall pipeline completion: ~92%**

**QA Status: PASSED** (2026-08-02)

---

## Pipeline Execution

Run the full pipeline:

```bash
npm install
npm run pipeline:skip-capture   # uses existing capture data
npm run pipeline                # includes live capture via Playwright
```

Individual stages:

```bash
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

---

## Module Status

### Capture ✅

All core capture modules operational. `auth.js` supports optional cookie/header injection. WebSocket frames flushed at capture end.

Unused: `video.js` (recording options defined, not wired to index).

### Normalize ✅

- `dom.js` parses HTML into 1566-node tree via cheerio
- `css.js` includes display/position statistics
- `assets.js` includes file paths and sizes

### Analyzer ✅

All modules produce real analysis (no placeholders):

| Output | Key Metrics (preny.ai) |
|--------|------------------------|
| layout.json | 1566 nodes, flexbox-dominant, max depth 23 |
| components.json | 342 components detected |
| design.json | 15 colors, Inter font family |
| interaction.json | 90 interactive elements |
| vision.json | Screenshot 1440×8406, dominant colors extracted |
| analysis.json | Merged analysis with all 5 sections |

### Style Extraction ✅

Outputs `style-extraction/output/tokens.json` with color, typography, and layout tokens.

### Collector ✅

Outputs unified `collector/output/dataset.json` aggregating all upstream artifacts.

### AI Analysis ✅

Rule-based semantic analysis: page type, features, user flows, content sections.

### Functional Spec ✅

Outputs `spec/functional/output/spec.json` and `spec.md`.

### Technical Spec ✅

Outputs `spec/technical/output/spec.json` and `spec.md`.

### Code Generator ✅

Outputs runnable Vite static site at `rebuild/output/`. Build verified by QA.

### QA ✅

Validates all pipeline outputs, checks for placeholders, runs rebuild build.

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Pipeline runs end-to-end | ✅ |
| No placeholders | ✅ |
| No orphan modules | ⚠️ video.js unused |
| Clear I/O per module | ✅ |
| Output → Input chaining | ✅ |
| No duplicate functionality | ✅ |
| Build succeeds | ✅ (rebuild/output) |
| Run succeeds | ✅ |
| Rebuild from capture | ✅ |
| Documentation matches code | ✅ |

---

## Output Locations

| Stage | Output |
|-------|--------|
| Capture | `capture/raw/*`, `capture/report.json` |
| Normalize | `normalize/output/*.json` |
| Analyzer | `analyzer/output/*.json` |
| Style Extraction | `style-extraction/output/tokens.json` |
| Collector | `collector/output/dataset.json` |
| AI Analysis | `ai-analysis/output/semantic.json` |
| Functional Spec | `spec/functional/output/spec.json`, `spec.md` |
| Technical Spec | `spec/technical/output/spec.json`, `spec.md` |
| Generator | `rebuild/output/` |
| QA | `qa/output/report.json`, `report.md` |
