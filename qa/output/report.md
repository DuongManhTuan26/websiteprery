# QA Report

**Generated:** 2026-08-02T11:39:21.642Z
**Overall:** PASSED

## Output Validation

- [x] capture: /home/user/websiteprery/capture/report.json
- [x] normalize: /home/user/websiteprery/normalize/output/dom.json
- [x] normalize: /home/user/websiteprery/normalize/output/css.json
- [x] normalize: /home/user/websiteprery/normalize/output/text.json
- [x] normalize: /home/user/websiteprery/normalize/output/assets.json
- [x] analyzer: /home/user/websiteprery/analyzer/output/analysis.json
- [x] style-extraction: /home/user/websiteprery/style-extraction/output/tokens.json
- [x] collector: /home/user/websiteprery/collector/output/dataset.json
- [x] ai-analysis: /home/user/websiteprery/ai-analysis/output/semantic.json
- [x] functional-spec: /home/user/websiteprery/spec/functional/output/spec.json
- [x] technical-spec: /home/user/websiteprery/spec/technical/output/spec.json
- [x] generator: /home/user/websiteprery/rebuild/output/index.html
- [x] generator: /home/user/websiteprery/rebuild/output/package.json

## Analysis Validation

No issues found.

## Rebuild Build

Build: PASSED

## Origin Independence

No references to the original host (preny.ai) found outside metadata.

Localized assets: 64/221 referenced (157 not present in the capture HAR — see manifest.json).

## Capture Status

Target: https://preny.ai
Finished at: 2026-08-01T09:34:19.047Z
Age: 26.1 hours
⚠️ Dữ liệu capture đã 26.1 giờ — vượt ngưỡng 24h. Các stage sau có thể đang chạy trên dữ liệu capture cũ (vd. dùng --skip-capture) chứ không phải một lần capture mới thành công.
⚠️ Missing capture artifacts: websocket