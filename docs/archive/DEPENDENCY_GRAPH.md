> **[ARCHIVED — 2026-08-02]** Tài liệu này đã lỗi thời và không còn được cập nhật. Nguồn sự thật hiện tại là `CLAUDE.md` ở root repo, được kiểm chứng trực tiếp bằng mã nguồn. File này được giữ lại chỉ để tham khảo lịch sử audit.

# Dependency Graph

## Inter-Module Data Flow

```
capture/config.js
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                      CAPTURE                              │
│  browser ──► page ──► [html, dom, style, cookies,       │
│                        storage, screenshot, har, ws]      │
└──────────────────────────┬───────────────────────────────┘
                           │
          capture/raw/html/index.html ──────────────┐
          capture/raw/dom/dom.html ────────┬────────┤
          capture/raw/style/styles.json ───┼────────┤
          capture/raw/screenshots/home.png ┼────────┤
          capture/raw/har/preny.har ───────┼────────┤
          capture/raw/cookies/cookies.json ┼────────┤
          capture/raw/storage/*.json ──────┼────────┤
          capture/raw/websocket/frames.json        │
                           │                         │
                           ▼                         │
┌──────────────────────────────────────────────────────────┐
│                     NORMALIZE                             │
│  html.js ──► html.json                                   │
│  dom.js  ──► dom.json                                    │
│  css.js  ──► css.json                                    │
│  text.js ──► text.json                                   │
│  assets.js ──► assets.json                               │
└──────────────────────────┬───────────────────────────────┘
                           │
          normalize/output/dom.json ────────┬──────────────┐
          normalize/output/css.json ────────┼──────┐       │
          normalize/output/assets.json ─────┼──────┼───┐   │
          normalize/output/html.json ───────┼──────┼───┼───┤ (unused by analyzer)
          normalize/output/text.json ───────┼──────┼───┼───┤ (unused by analyzer)
                           │                │      │   │   │
                           ▼                ▼      ▼   ▼   ▼
┌──────────────────────────────────────────────────────────┐
│                     ANALYZER                              │
│  layout.js       ──► layout.json       (dom.json)       │
│  component.js    ──► components.json   (dom.json)       │
│  design.js       ──► design.json       (css.json)       │
│  interaction.js  ──► interaction.json  (dom.json)       │
│  vision.js       ──► vision.json       (assets.json)    │
│  merge.js        ──► analysis.json     (all above)      │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
                    [PLANNED STAGES]
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
 style-extraction      collector            ai-analysis
 (css.json)         (all outputs)      (analysis.json)
     │                     │                     │
     └──────────┬──────────┴──────────┬──────────┘
                ▼                     ▼
         spec/functional        spec/technical
                │                     │
                └──────────┬──────────┘
                           ▼
                      generator
                           │
                           ▼
                          qa
                           │
                           ▼
                    rebuild/output/
```

## Module Dependency Matrix

| Consumer | Depends On |
|----------|-----------|
| capture/index.js | config, browser, har, html, dom, cookies, storage, screenshot, style, websocket, report, viewport |
| normalize/index.js | html, dom, css, text, assets |
| normalize/html.js | capture/raw/html/index.html |
| normalize/dom.js | capture/raw/dom/dom.html |
| normalize/css.js | capture/raw/style/styles.json |
| normalize/text.js | capture/raw/dom/dom.html |
| normalize/assets.js | capture/raw/* (existence checks) |
| analyzer/index.js | layout, component, design, interaction, vision, merge |
| analyzer/layout.js | normalize/output/dom.json |
| analyzer/component.js | normalize/output/dom.json |
| analyzer/design.js | normalize/output/css.json |
| analyzer/interaction.js | normalize/output/dom.json |
| analyzer/vision.js | normalize/output/assets.json, capture/raw/screenshots/home.png |
| analyzer/merge.js | analyzer/output/*.json |

## External Dependencies

| Package | Used By | Declared |
|---------|---------|----------|
| playwright | capture/browser.js | ❌ No |
| cheerio | planned — dom parsing | ❌ No |
| sharp | planned — vision analysis | ❌ No |

## Orphan / Unused Artifacts

| Item | Issue |
|------|-------|
| capture/video.js | Not imported by capture/index.js |
| capture/auth.js | Empty file, unused |
| normalize/output/html.json | Not consumed by Analyzer |
| normalize/output/text.json | Not consumed by Analyzer |
| capture/raw/har/preny.har | Not consumed by any module |
| capture/raw/cookies/* | Not consumed beyond assets flag |
| capture/raw/storage/* | Not consumed beyond assets flag |

## Broken Links (Current)

```
normalize/dom.json { dom: "<html>..." }
        ╳  (expected nodes[])
analyzer/layout.js
analyzer/component.js
analyzer/interaction.js

analyzer/merge.js ──► component.json
        ╳  (actual file: components.json)
analyzer/output/components.json
```
