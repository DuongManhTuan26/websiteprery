# HANDOFF — Website/App Rebuild Engine

Tài liệu bàn giao tự chứa (self-contained). Đọc file này là đủ để tiếp quản dự án ngay lập tức, không cần ngữ cảnh hội thoại nào khác.

Snapshot tại: 2026-08-02, 15:58 +07.

---

## 1. TRẠNG THÁI HIỆN TẠI

- Repo dùng git thật (branch làm việc `claude/preny-website-recreation-2vz5cz`).
- Không có test suite tự động. Xác minh = chạy pipeline + đọc `qa/output/report.json`.
- `generator/` giờ có 2 đường: **faithful clone** (`generator/faithfulClone.js`, đường chính — clone HTML/class/text thật, không còn khung trang tổng hợp cố định) và builder tổng hợp cũ (fallback khi thiếu dữ liệu). Chi tiết ở Stage 9 bên dưới và CLAUDE.md.
- **KHÔNG còn hotlink.** Toàn bộ CSS/font/image/icon/favicon thật được trích xuất từ `capture/raw/har/preny.har` (đã capture sẵn với `mode:'full'` — chứa full response body, chỉ là trước đây không ai đọc tới) qua `generator/harAssets.js`, lưu cục bộ vào `rebuild/output/public/assets/`, và toàn bộ HTML/CSS được rewrite để trỏ nội bộ (`/assets/<hash>.<ext>`). Asset nào KHÔNG có trong HAR (do chưa từng được browser request lúc capture — chủ yếu ảnh `loading="lazy"` dưới màn hình đầu tiên) bị hạ xuống đường dẫn same-origin-relative (sẽ 404 cục bộ, KHÔNG BAO GIỜ trỏ về preny.ai) — không fabricate placeholder thay thế. `qa/index.js` giờ có gate cứng `validateNoOriginDependency()` fail QA nếu còn bất kỳ request runtime nào trỏ về origin đã capture.
- **Hành vi phía client**: đã thêm 1 file JS thuần nhỏ, tự viết tay, không dependency (`generator/runtimeInteractions.js` → `public/assets/interactions.js`) khôi phục toggle cho các widget disclosure thật đã capture (accordion FAQ, tabs ngành) dựa trên `aria-expanded`/`aria-controls`/`data-state` thật — verify target tồn tại thật trong DOM đã capture. KHÔNG chạy lại bundle Next.js/React thật (lý do: cần RSC payload + API `app.preny.ai` không thể phục vụ offline mà không hotlink hoặc crash hydration).
- **`capture/scroll.js`** (mới): cuộn hết trang trước khi chụp, để ảnh lazy-load dưới màn hình đầu kích hoạt request thật vào HAR — chỉ có tác dụng cho lần capture MỚI (không thể hồi tố dữ liệu HAR đã có sẵn trong repo, vì sandbox hiện tại chặn egress tới preny.ai — đã verify bằng `curl`/proxy status).
- Lần chạy QA gần nhất (sau khi thêm asset localization + no-origin-dependency gate, verify lại từ trạng thái sạch hoàn toàn): `passed: true`, `13/13` output check, `0` analysis issue, `0` origin-dependency issue, `rebuildBuild.passed: true`. Coverage asset thật: `68/221` referenced localized từ HAR hiện có (153 còn thiếu vì chưa từng được request lúc capture — xem `capture/scroll.js` ở trên). Verify thêm bằng Playwright thật chạy `vite preview`: title/nav/hero/accordion đúng thật, accordion trigger toggle `aria-expanded` đúng khi click, 0/36 network request trỏ `preny.ai`, 0 console/page error.
- Dữ liệu capture chuẩn hiện có trong repo: `https://preny.ai`, capture lúc `2026-08-01T09:34:19Z`, tuổi dữ liệu tại thời điểm snapshot: 23h (`stale: false`, ngưỡng stale là 24h).
- Số liệu thật từ lần chạy chuẩn: `dom.nodes = 1566`, `components.totalComponents = 342`, `layoutModel = flexbox-dominant`, `interaction.totalInteractive = 90`, `design.primaryFont = "ui-sans-serif"`, `design.palette = 15 màu`, `ai-analysis.pageType = "saas-ai-landing"`, `ai-analysis.contentSections = 9` (8 section thân trang + 1 section rỗng bị loại ở tầng generator), `language = "vi"`.
- `rebuild/output/` chứa project Vite tĩnh đã sinh từ dữ liệu preny.ai ở trên; đã build thử thành công ra `dist/`.
- Đã verify tính tổng quát (không hardcode 1 site) bằng capture live thật vào `https://playwright.dev` (site cấu trúc hoàn toàn khác — Docusaurus) và chạy full pipeline thành công trên dữ liệu đó, sau đó khôi phục lại dữ liệu `preny.ai` làm trạng thái chính.
- Blocker đang tồn tại (ngoài phạm vi sửa được từ repo): capture live vào target mặc định `https://preny.ai` hiện fail vì chứng chỉ TLS của site đó đã hết hạn (`notAfter=Aug 1 2026`, xác nhận bằng `openssl s_client`). `npm run pipeline:skip-capture` không bị ảnh hưởng.

---

## 2. KIẾN TRÚC TỔNG THỂ

Pipeline dạng file-based, 10 stage, mỗi stage là 1 thư mục độc lập với `index.js` riêng. Các stage KHÔNG gọi hàm lẫn nhau trực tiếp — mỗi stage đọc JSON/HTML do stage trước ghi ra đĩa, ghi output của chính nó ra đĩa. `pipeline/index.js` là nơi DUY NHẤT điều phối tuần tự, bằng cách `require()` module của từng stage và gọi đúng tên hàm export.

```
Capture → Normalize → Analyze (Model) → Style Extraction → Collector
  → Semantic Analysis (ai-analysis) → Functional Spec → Technical Spec → Code Generator → QA (build + validate)
```

`capture` là ngoại lệ duy nhất: là IIFE script không export hàm, `pipeline/index.js` gọi bằng `execSync('node capture/index.js')` thay vì `require()`.

Ý tưởng lõi làm cho "hiểu cấu trúc rồi mới sinh code" hoạt động thật: mọi node DOM đã parse mang một `index` theo thứ tự tài liệu (document order). `analyzer/layout.js` tính thêm `endIndex` cho mỗi section ngữ nghĩa thật (`<header>/<nav>/<main>/<section>/<footer>/<aside>`) — là index của node tiếp theo có `depth` bằng hoặc nông hơn, tức điểm kết thúc thật của subtree DOM của section đó (tính theo `depth`, không phải tuyến tính, nên xử lý đúng cả trường hợp lồng nhau, ví dụ NAV lồng trong HEADER). `ai-analysis/index.js` dùng khoảng `[index, endIndex)` này để đối chiếu component/text nào thuộc section thật nào, nên các section trong site sinh ra phản ánh đúng cấu trúc site gốc thay vì 1 template cố định.

---

## 3. TOÀN BỘ PIPELINE — DANH SÁCH STAGE, MODULE, TRÁCH NHIỆM, INPUT/OUTPUT

### Stage 1 — `capture/`
Vai trò: thu thập dữ liệu thô từ 1 URL sống bằng Playwright/Chrome.

| File | Trách nhiệm |
|---|---|
| `config.js` | Config trung tâm duy nhất của stage. `target = process.env.CAPTURE_TARGET \|\| 'https://preny.ai'`. `browser.headless = process.env.CAPTURE_HEADLESS === 'true'` (mặc định `false` — cửa sổ hiển thị). `browser.channel = 'chrome'`. `viewport = {width:1440,height:900}`. Có `output.*` map toàn bộ đường dẫn artifact tương đối dưới `capture/raw/`. |
| `browser.js` | `createBrowser()` — `chromium.launch({channel, headless})`. |
| `har.js` | `getHarOptions()` — `{recordHar:{path, mode:'full'}}`. |
| `viewport.js` | `getViewport(name)` — preset desktop/tablet/mobile, mặc định desktop. |
| `html.js` | `saveHtml(page)` — `page.content()` → `capture/raw/html/index.html`. |
| `dom.js` | `saveDom(page)` — `document.documentElement.outerHTML` → `capture/raw/dom/dom.html`. |
| `style.js` | `saveStyles(page)` — `getComputedStyle()` mọi element → `capture/raw/style/styles.json` (array `{tag,id,class,style:{fontFamily,fontSize,fontWeight,lineHeight,color,background,width,height,margin,padding,border,borderRadius,display,position,flex,grid,opacity,zIndex,boxShadow,transform}}`). |
| `cookies.js` | `saveCookies(context)` → `capture/raw/cookies/cookies.json`. |
| `storage.js` | `saveStorage(page)` — localStorage/sessionStorage/indexedDB → 3 file JSON. |
| `screenshot.js` | `saveScreenshot(page)` — full-page PNG → `capture/raw/screenshots/home.png`. |
| `websocket.js` | `attachWebSocketLogger(page)` gắn listener; `flushWebSocketFrames(page)` ghi `page._wsFrames` → `capture/raw/websocket/frames.json`. |
| `report.js` | `generateReport(startTime,endTime)` → `capture/report.json = {target, startedAt, finishedAt, durationMs, files:{har,html,dom,screenshot,cookies,localStorage,sessionStorage,indexedDB,websocket,styles}}`. `target` đọc từ `config.target`. |
| `index.js` | IIFE orchestrator, KHÔNG export hàm. Thứ tự: createBrowser → newContext(harOptions+viewport) → newPage → attachWebSocketLogger → `page.goto(config.target,{waitUntil:'networkidle'})` → saveScreenshot → saveHtml → saveDom → saveStyles → saveCookies → saveStorage → flushWebSocketFrames → waitForTimeout(5000) → context.close() → browser.close() → generateReport. |

Input: URL đích (qua env `CAPTURE_TARGET` hoặc default). Output: `capture/raw/**`, `capture/report.json`.

Không tồn tại: `capture/auth.js`, `capture/video.js` (đã xoá — dead code, không được import ở đâu).

### Stage 2 — `normalize/`
Vai trò: chuẩn hoá dữ liệu thô thành JSON có cấu trúc.

| File | Trách nhiệm |
|---|---|
| `dom.js` | `normalizeDom()` đọc `capture/raw/dom/dom.html`, parse qua `shared/dom-parser.js`, ghi `normalize/output/dom.json = {length, html, nodes[], statistics:{totalNodes,tags}}`. |
| `css.js` | `normalizeCss()` đọc `capture/raw/style/styles.json`, tính `displayCounts`/`positionCounts`, ghi `normalize/output/css.json = {totalElements, styles[], statistics:{display,position}}`. |
| `text.js` | `normalizeText()` đọc `capture/raw/dom/dom.html`, strip script/style/tag bằng regex, ghi `normalize/output/text.json = {length, text}`. |
| `assets.js` | `normalizeAssets()` kiểm tra tồn tại+size mọi file `capture/raw/*`, ghi `normalize/output/assets.json = {screenshot,har,cookies,localStorage,sessionStorage,indexedDB,styles,websocket} mỗi cái {exists,path,size}`. |
| `index.js` | `runNormalize()` — thứ tự: DOM → CSS → TEXT → ASSETS. |

Input: `capture/raw/**`. Output: `normalize/output/{dom,css,text,assets}.json`.

Không tồn tại: `normalize/html.js` (đã xoá — output là tập con hoàn toàn trùng lặp field `html` đã có sẵn trong `dom.json`, không ai dùng độc lập).

### Stage 3 — `analyzer/` (Model layer)
Vai trò: "Hiểu cấu trúc website" — 5 model song song + 1 bước gộp.

| File | Trách nhiệm |
|---|---|
| `layout.js` | `analyzeLayout()` đọc `dom.json`+`css.json`. Tính `displayCounts`, `flexContainers[]`(cap 50)+count, `gridContainers[]`(cap 50)+count, `semanticSections[]` (node có tag HEADER/MAIN/FOOTER/NAV/SECTION/ASIDE, mỗi phần tử `{index, endIndex, tag, id, class, depth}`), `maxDepth`, `layoutModel` (flexbox-dominant/grid-dominant/block-dominant). `endIndex` tính bằng `findSectionEnd(nodes, startIndex, depth)`: quét tới node tiếp theo có `depth <= depth` hiện tại — ranh giới subtree DOM thật, xử lý đúng lồng nhau. Ghi `analyzer/output/layout.json`. |
| `component.js` | `analyzeComponents()` đọc `dom.json`. `detectComponentType(node)`: kiểm tra class-name TRƯỚC (header/navbar→header, footer→footer, hero/banner→hero, card→card, modal/dialog→modal, sidebar/aside→sidebar, pricing→pricing, testimonial→testimonial, cta→cta), rồi mới fallback `SEMANTIC_TAGS` (HEADER→header,NAV→navigation,MAIN→main,FOOTER→footer,SECTION→section,ASIDE→sidebar,FORM→form,BUTTON→button,A→link,INPUT→input,IMG→image), cuối cùng `'element'`. Đẩy component nếu `type!=='element'` HOẶC tag ∈ {HEADER,FOOTER,NAV,MAIN,FORM}. Mỗi component: `{index,type,tag,id,class,depth,text}`. `components[]` cap 200, `totalComponents` là số thật không cap. Ghi `analyzer/output/components.json`. |
| `design.js` | `analyzeDesign()` đọc `css.json`. Trích `colors` (color+background, loại transparent/rgba(0,0,0,0)), `fonts` (font đầu tiên trước dấu phẩy, LOẠI tên synthetic khớp `/^__/` qua `isSyntheticFontName()` — tên nội bộ do Next.js `next/font` sinh ra), `fontSizes`, `borderRadii` (loại 0px), `shadows` (loại none). Ghi `analyzer/output/design.json = {generatedAt,totalElements,palette(top15),typography:{fonts(top5),fontSizes(top10)},borderRadii(top5),shadows(top5),primaryFont,dominantColors(top5)}`. `primaryFont` có thể `null` nếu toàn bộ font đều synthetic. |
| `interaction.js` | `analyzeInteractions()` đọc `dom.json`. Đếm clickable(A+BUTTON), forms(FORM), inputs(INPUT+TEXTAREA+SELECT). `elements[]` (cap 100) cho tag ∈ INTERACTIVE_TAGS={A,BUTTON,INPUT,TEXTAREA,SELECT,FORM,DETAILS,SUMMARY}: `{index,tag,id,class,type,name,href,ariaLabel,text}`. Ghi `analyzer/output/interaction.json`. |
| `vision.js` | `analyzeVision()` đọc `assets.json`+screenshot thật. Nếu có: `sharp().metadata()` lấy width/height/format, `extractDominantColors()` (resize 100x100, bucket theo làm tròn kênh màu về bội số 16, `bucketChannel()` **clamp về tối đa 255**). Ghi `analyzer/output/vision.json = {generatedAt,screenshotAvailable,screenshot:{...},dominantColors[],pageHeight,isFullPage}`. |
| `merge.js` | `mergeResults()` đọc 5 file output riêng lẻ theo tên cứng, ghi `analyzer/output/analysis.json = {generatedAt,version,layout,components,design,interaction,vision}`. **QUAN TRỌNG VỀ VẬN HÀNH: phải chạy lại (hoặc chạy `analyzer/index.js`) sau khi sửa BẤT KỲ file analyzer/*.js riêng lẻ nào — `collector/` chỉ đọc `analysis.json` đã gộp, không đọc từng file riêng, nên gộp cũ sẽ âm thầm phục vụ dữ liệu cũ cho toàn bộ downstream.** |
| `index.js` | `runAnalyze()` — thứ tự: Layout→Components→Design→Interactions→Vision→Merge. |

Input: `normalize/output/*.json`. Output: `analyzer/output/{layout,components,design,interaction,vision,analysis}.json`.

### Stage 4 — `style-extraction/`
`index.js`: `extractStyles()` đọc `css.json`+`design.json`. `buildTokens()`: colors (từ design.palette, đặt tên primary/secondary/color-N), fonts (từ design.typography.fonts, primary/font-N), fontSizes (size-N), spacing (từ css.statistics.display top5). Ghi `style-extraction/output/tokens.json = {generatedAt,colors[],typography:{fonts[],fontSizes[],primaryFont},borderRadii,shadows,layout:{displayDistribution,positionDistribution},spacing[]}`.

Input: `normalize/output/css.json`, `analyzer/output/design.json`. Output: `style-extraction/output/tokens.json`.

### Stage 5 — `collector/`
`index.js`: `collect()` đọc `capture/report.json`, `normalize/output/{dom,css,text,assets}.json` (KHÔNG có html.json), `analyzer/output/analysis.json`, `style-extraction/output/tokens.json` (mỗi cái qua `loadOptional`, trả `null` nếu thiếu). Ghi `collector/output/dataset.json = {schemaVersion,generatedAt,source:{captureReport,target},normalize:{dom,css,text,assets},analysis,tokens,summary:{totalNodes,totalStyles,layoutModel,componentCount,interactiveCount,primaryFont,dominantColors}}`.

Input: mọi output trước đó. Output: `collector/output/dataset.json` — nguồn dữ liệu hợp nhất duy nhất cho các stage sau.

### Stage 6 — `ai-analysis/` (Semantic layer)
`index.js`: `analyzeSemantic()` đọc `dataset.json`.

- `detectPageType(text,components)`: chatbot/ai trong text→saas-ai-landing; components.componentTypes.pricing→saas-pricing; mặc định marketing-landing.
- `detectFeatures(components,interactions,text)`: khớp từ khoá FEATURE_KEYWORDS={navigation,hero,pricing,testimonial,cta,chat,form,footer} trên text và class/type component; cộng thêm feature 'interactive-elements' nếu totalInteractive>0.
- `mapUserFlows(features,interactions)`: sinh flow browse/conversion/form-submission tuỳ feature phát hiện.
- `extractContentSections(layout, components, allNodes)` — TÁI CẤU TRÚC section thật (không quét phẳng theo type nữa):
  - `findTopLevelBodySections(semanticSections)`: lọc tag SECTION/ASIDE, loại bỏ section bị lồng trong section khác (dùng khoảng `index`/`endIndex`), sắp theo index.
  - `classifySection(containedComponents)`: bầu chọn đa số trong SPECIFIC_COMPONENT_TYPES=['hero','pricing','cta','testimonial','card','modal'] của component nằm trong khoảng index của section; fallback `'section'`.
  - `sectionText(allNodes, section)`: text dài nhất trong TOÀN BỘ node (không chỉ components — vì components.json không có tag text thuần như H1/P) nằm trong `[section.index, section.endIndex)`.
  - Trả về tối đa 12 section, mỗi cái `{type, tag, text}`, đúng 1-1 với 1 section DOM thật, đúng thứ tự tài liệu.
- `detectLanguage(text)`: regex `VIETNAMESE_CHARS` (ký tự có dấu tiếng Việt) — `language: detectLanguage(text)`.
- `recommendations.framework`: cố định `'static-html'`.
- Ghi `ai-analysis/output/semantic.json = {generatedAt,pageType,language,features[],userFlows[],contentSections[],recommendations:{framework,styling,componentStrategy}}`.

Input: `collector/output/dataset.json`. Output: `ai-analysis/output/semantic.json`.

### Stage 7 — `spec/functional/`
`index.js`: `generateFunctionalSpec()` đọc `dataset.json`+`semantic.json`. Dựng `requirements[]` từ `semantic.features`. Ghi `spec/functional/output/spec.json`(+`.md`) `= {generatedAt,version,projectName(=dataset.source.target),pageType,overview,userFlows,requirements[],contentSections}`.

Input: `dataset.json`, `semantic.json`. Output: `spec/functional/output/{spec.json,spec.md}`.

### Stage 8 — `spec/technical/`
`index.js`: `generateTechnicalSpec()` đọc `dataset.json`+`semantic.json`+`functionalSpec.json`+`tokens.json`. `stack.framework = semantic.recommendations.framework` (='static-html'). `dependencies:{runtime:[], dev:['vite']}` — khớp CHÍNH XÁC với `package.json` mà generator thật sự sinh ra. Ghi `spec/technical/output/spec.json`(+`.md`).

**Ghi chú kiến trúc quan trọng: `generator/index.js` KHÔNG đọc output của stage này. Hai stage độc lập hoàn toàn — nếu sửa 1 bên phải tự tay đồng bộ bên kia.**

Input: `dataset.json`, `semantic.json`, `spec/functional/output/spec.json`, `tokens.json`. Output: `spec/technical/output/{spec.json,spec.md}`.

### Stage 9 — `generator/` (Code Generator)
`index.js`: `generateCode()` đọc `dataset.json`, `semantic.json`, `tokens.json`.

**Đường chính (faithful clone) — `generator/faithfulClone.js`.** `buildFaithfulClone(dataset)` dùng `dataset.normalize.dom.html` (HTML thật đầy đủ, không cắt — đã có sẵn trong `dataset.json` qua `collector`, không cần stage/path mới) + `dataset.source.target` (origin đã capture) để dựng ra 1 bản clone THẬT theo nghĩa đen: `<head>` thật (title/meta/OG/twitter/canonical/favicon/`<link rel=stylesheet>` thật/`<style>` inline thật) + `<body>` thật (đúng cấu trúc DOM thật, đúng class thật, đúng text thật, đúng thứ tự tài liệu) — mọi URL root-relative (`src`, `href`, `action`, `srcset`, `style="...url(...)"`) được viết lại thành URL tuyệt đối trỏ về origin đã capture. `<script>`, `<noscript>`, `<link rel=preload as=script>` bị loại (không có JS runtime — khớp quyết định kiến trúc `'static-html'` đã chốt ở `spec/technical`). `styles/tokens.css`+`styles/main.css` vẫn được sinh và nạp TRƯỚC các stylesheet thật trong `<head>` — chỉ đóng vai trò fallback font/màu cơ bản nếu stylesheet thật không tải được; stylesheet thật thắng cascade nhờ thứ tự nạp sau (cùng độ đặc hiệu).

**Vì sao hotlink thay vì tải file thật về:** pipeline hiện không có bước tải asset nhị phân từ target sống (và trong môi trường sandbox hiện tại, truy cập mạng ra ngoài tới các domain tuỳ ý — kể cả chính target đã capture — bị egress proxy chặn, đã xác minh bằng thực nghiệm). Viết lại URL root-relative thành `<origin đã capture>/...` là lựa chọn KHÔNG fabricate: file thật, đường dẫn thật, y hệt như trong markup thật — chỉ cần origin còn truy cập được lúc deploy/xem. Đây là đánh đổi có chủ đích, đã ghi chép rõ, không phải bug — không "sửa" bằng cách tạo asset giả cục bộ.

`buildFaithfulClone()` trả `{ ok:false, reason }` (không bao giờ throw) khi thiếu `dataset.normalize.dom.html` hoặc `dataset.source.target` — lúc đó `generator/index.js` rơi về builder tổng hợp cũ (`buildHeaderSection`/`buildHeroSection`/`buildBodySections`/`buildFormSection`/`buildFooterSection`, giữ nguyên không đổi) làm fallback phòng vệ cho dữ liệu capture thiếu/hỏng, không nên xảy ra với dữ liệu capture thật hợp lệ.

Đã verify: thứ tự duyệt `cheerio('*')` trên `capture/raw/dom/dom.html` khớp 1-1 theo index với thứ tự trong `capture/raw/style/styles.json` (cả 2 đều là document-order/preorder — `document.querySelectorAll('*')` trong `capture/style.js` so với `cheerio $('*')` — kiểm tra thực nghiệm trên 1960 phần tử capture thật, 0 sai lệch). Alignment này CHƯA được `faithfulClone.js` dùng tới (clone hiện dựa vào class+CSS thật hotlink cho hình thức, không inline computed-style từng phần tử — vì làm vậy sẽ thắng độ đặc hiệu so với class thật, phá hỏng hover/responsive) — ghi lại ở đây vì đã verify sẵn, có thể dùng làm fallback computed-style-per-element nếu sau này có site không hotlink được stylesheet thật.

Nhánh tổng hợp cũ (dùng khi faithful clone không khả dụng), đọc `.normalize.text.text` và `.analysis.interaction`:

- `escapeHtml(text)`.
- `buildTokensCss(tokens)`: `:root{--colorname:value;...;--font-primary...(chỉ khi primaryFont có giá trị thật);--font-size-N...}`.
- `buildMainCss()`: CSS tĩnh cố định (header/nav/hero/btn/section/grid/card/contact-form/form-field/footer).
- `buildHeaderSection(semantic, interaction)`: nav `<ul>` thật dựng từ `interaction.elements` lọc tag=A, có href, có text (≤40 ký tự), khử trùng theo text, cap 6. KHÔNG có fallback cứng nào — nếu không tìm được link thật, khối `<nav>` bị bỏ hoàn toàn.
- `buildHeroSection(text)`: title = 30 từ đầu của `text`, cắt 80 ký tự kèm "...". Nếu không có text thật → trả `''` (bỏ cả section, không fabricate).
- `SECTION_HEADINGS = {navigation:'Navigation',pricing:'Pricing',cta:'Get Started',testimonial:'Testimonials'}`.
- `buildBodySections(semantic)`: render ĐÚNG 1 `<section>` cho MỖI entry trong `contentSections` (loại type header/footer/hero, loại entry không có text), heading lấy từ SECTION_HEADINGS hoặc `"Section N"` (đánh số cho type generic 'section') hoặc tên type viết hoa chữ đầu. Không còn gộp nhiều section thành 1 lưới thẻ chung.
- `buildFormSection(interaction)`: render `<form class="contact-form">` với input/textarea thật (loại type hidden/submit/button) từ `interaction.elements`, chỉ khi `interaction.forms > 0` và có field. Không thì trả `''`.
- `buildFooterSection()`: tĩnh (`<p>Generated by capture-rebuild pipeline</p>` — ghi chú công cụ, không phải nội dung site giả).
- `buildIndexHtml(sections)`: bọc mảng section (đã `.filter(Boolean)`) vào HTML doc đầy đủ.
- `buildPackageJson()`: `{name:'rebuilt-site',version,private:true,type:'module',scripts:{dev,build,preview},devDependencies:{vite:'^5.4.0'}}` — không có runtime dependency.
- `buildViteConfig()`: config Vite tối giản, `outDir:'dist'`.
- `generateCode()`: `sections = [buildHeaderSection, buildHeroSection, ...buildBodySections, buildFormSection, buildFooterSection].filter(Boolean)`. Ghi `index.html`, `styles/tokens.css`, `styles/main.css`, `package.json`, `vite.config.js` vào `rebuild/output/`.

**Nguyên tắc bắt buộc xuyên suốt module này: không bao giờ fabricate — mọi hàm build trả `''` khi không có dữ liệu thật, bị lọc trước khi ghép HTML.**

Input: `dataset.json`, `semantic.json`, `tokens.json`. Output: `rebuild/output/` (project Vite tĩnh runnable).

### Stage 10 — `qa/`
`index.js`: `runQA()`.

- `REQUIRED_OUTPUTS[]`: `paths.capture.report` + `normalize.{dom,css,text,assets}` (không có `.html`) + `analyzer.analysis` + `styleExtraction.tokens` + `collector.dataset` + `aiAnalysis.semantic` + `functionalSpec.spec` + `technicalSpec.spec` + generator's `index.html`+`package.json`. Hiện tại 13 check.
- `checkPlaceholders(obj)`: quét đệ quy `status:'placeholder'`.
- `validateOutputs()`: existsSync mỗi entry REQUIRED_OUTPUTS.
- `validateAnalysis()`: kiểm `analysis.json` có `.components`, `layout.totalNodes !== 0`, cộng checkPlaceholders.
- `getCaptureStatus()`: đọc `capture/report.json`, tính `ageHours` từ `finishedAt` tới hiện tại, `stale: ageHours===null || ageHours>24`, `missingFiles` (từ report.files có giá trị false), `warning` nếu stale. Trả `{available:false,...}` nếu report.json không tồn tại.
- `validateRebuildBuild()`: `npm install && npm run build` bên trong `rebuild/output/`, kiểm `dist/index.html` tồn tại.
- `runQA()`: `passed = allOutputsExist && noPlaceholders && rebuildBuild.passed` (captureStatus.stale KHÔNG ảnh hưởng passed — chỉ mang tính cảnh báo, vì `--skip-capture` là chế độ hợp lệ có chủ đích). Ghi `qa/output/report.json`+`.md`. Console warn nếu stale. `process.exitCode=1` nếu không passed.

Input: mọi output của 9 stage trước + build thử `rebuild/output`. Output: `qa/output/{report.json,report.md}`.

### `pipeline/index.js` — orchestrator
`STAGES[]`: mảng `{name, script, fn hoặc skipEnv}`. `parseArgs()`: `--from`, `--only`, `--skip-capture`. `runStage()`: capture qua `execSync`, các stage khác qua `require()` + gọi đúng tên hàm export. `runPipeline()`: chạy tuần tự, log timing.

### `shared/` — hạ tầng dùng chung
- `dom-parser.js`: `parseHtmlToNodes(html)` — dùng cheerio, duyệt DOM pre-order, bỏ qua SCRIPT/STYLE/NOSCRIPT/SVG/PATH, trả `{nodes[], statistics:{totalNodes,tags}}`. Mỗi node: `{index, tag, id, class, depth, text(chỉ text con trực tiếp, cắt 200 ký tự), role, href, type, name, ariaLabel}`. `index` là vị trí 0-based theo thứ tự tài liệu — `nodes[k].index === k` luôn đúng.
- `load.js`: `readJson(path)`, `writeJson(path,data)`, `ensureDir(path)`, `loadDomNodes(domData)` (xử lý cả 2 dạng Array hoặc `{nodes:[]}`), `loadCssStyles(cssData)` (xử lý cả 2 dạng Array hoặc `{styles:[]}`).
- `paths.js`: nguồn sự thật duy nhất cho MỌI đường dẫn file, theo namespace từng stage: `paths.capture.*`, `paths.normalize.*` (không còn `.html`), `paths.analyzer.*`, `paths.styleExtraction.*`, `paths.collector.*`, `paths.aiAnalysis.*`, `paths.functionalSpec.*`, `paths.technicalSpec.*`, `paths.generator.output`, `paths.qa.*`.

---

## 4. CẤU TRÚC THƯ MỤC ĐẦY ĐỦ

```
capture-rebuild-pipeline/
├── .gitignore
├── README.md
├── CLAUDE.md
├── HANDOFF.md                          ← file này
├── package.json
├── package-lock.json
├── capture/
│   ├── browser.js
│   ├── config.js
│   ├── cookies.js
│   ├── dom.js
│   ├── har.js
│   ├── html.js
│   ├── index.js
│   ├── report.js
│   ├── screenshot.js
│   ├── storage.js
│   ├── style.js
│   ├── viewport.js
│   ├── websocket.js
│   ├── report.json                     (output — báo cáo lần capture gần nhất)
│   └── raw/
│       ├── cookies/cookies.json
│       ├── dom/dom.html
│       ├── har/preny.har               (36MB — dữ liệu HAR gốc, không phải cache)
│       ├── html/index.html
│       ├── screenshots/home.png
│       ├── storage/{localStorage,sessionStorage,indexedDB}.json
│       ├── style/styles.json
│       └── websocket/frames.json
├── normalize/
│   ├── assets.js, css.js, dom.js, index.js, text.js
│   └── output/{assets,css,dom,text}.json
├── analyzer/
│   ├── component.js, design.js, index.js, interaction.js, layout.js, merge.js, vision.js
│   └── output/{analysis,components,design,interaction,layout,vision}.json
├── style-extraction/
│   ├── index.js
│   └── output/tokens.json
├── collector/
│   ├── index.js
│   └── output/dataset.json
├── ai-analysis/
│   ├── index.js
│   └── output/semantic.json
├── spec/
│   ├── functional/
│   │   ├── index.js
│   │   └── output/{spec.json,spec.md}
│   └── technical/
│       ├── index.js
│       └── output/{spec.json,spec.md}
├── generator/
│   └── index.js
├── rebuild/output/                     (output do generator sinh — KHÔNG sửa tay)
│   ├── index.html, package.json, vite.config.js
│   ├── public/                         (rỗng, scaffold Vite chuẩn)
│   ├── styles/{main.css,tokens.css}
│   └── node_modules/, dist/, package-lock.json  (regenerate qua npm install/build, .gitignore loại trừ)
├── qa/
│   ├── index.js
│   └── output/{report.json,report.md}
├── pipeline/
│   └── index.js
├── shared/
│   ├── dom-parser.js, load.js, paths.js
└── docs/archive/                       (tài liệu audit cũ, đã lỗi thời, giữ để tham khảo lịch sử)
    ├── CURRENT_ARCHITECTURE.md
    ├── DEPENDENCY_GRAPH.md
    ├── IMPLEMENTATION_PLAN.md
    └── PROJECT_STATUS.md
```

---

## 5. LUỒNG DỮ LIỆU GIỮA CÁC STAGE (đầy đủ, dạng graph)

```
[URL đích] --Playwright--> capture/raw/** + capture/report.json
       │
       ├─ capture/raw/dom/dom.html ──────────┐
       ├─ capture/raw/style/styles.json ─────┼──┐
       ├─ capture/raw/dom/dom.html (lại) ────┼──┼──┐  (text.js đọc lại dom.html)
       ├─ capture/raw/* (existence check) ───┼──┼──┼──┐
       │                                      ▼  ▼  ▼  ▼
       │                             normalize/{dom,css,text,assets}.js
       │                                      │  │  │  │
       │                                      ▼  ▼  ▼  ▼
       │                     normalize/output/{dom,css,text,assets}.json
       │                                      │
       │           ┌──────────────┬───────────┼───────────┬──────────────┐
       │           ▼              ▼           ▼           ▼              │
       │      layout.js      component.js  design.js  interaction.js  vision.js
       │      (dom+css)        (dom)         (css)        (dom)      (assets+screenshot)
       │           │              │           │           │              │
       │           └──────────────┴─────┬─────┴───────────┴──────────────┘
       │                                 ▼
       │                          analyzer/merge.js
       │                                 ▼
       │                     analyzer/output/analysis.json
       │                                 │
       │              ┌──────────────────┼──────────────────┐
       │              ▼                  │                  │
       │      style-extraction/       (giữ nguyên)           │
       │      (css.json+design.json)                         │
       │              ▼                  │                  │
       │      style-extraction/output/tokens.json             │
       │              │                  │                  │
       └──────────────┼──────────────────┼──────────────────┘
    capture/report.json                  │
                       ▼                  ▼
                    collector/index.js (đọc: report.json + normalize/{dom,css,text,assets} + analysis.json + tokens.json)
                       ▼
              collector/output/dataset.json
                       │
                       ▼
              ai-analysis/index.js (đọc dataset.json — dùng dataset.analysis.layout, dataset.analysis.components,
                                     dataset.normalize.dom.nodes, dataset.normalize.text)
                       ▼
              ai-analysis/output/semantic.json
                       │
          ┌────────────┼────────────────────┬──────────────────┐
          ▼            │                    ▼                  │
   spec/functional/    │            spec/technical/             │
   (dataset+semantic)  │      (dataset+semantic+funcSpec+tokens) │
          ▼            │                    ▼                  │
   spec/functional/     │        spec/technical/output/          │
   output/spec.json     │        spec.json (KHÔNG ai đọc lại)    │
          │             │                                       │
          └─────────────┼───────────────────────────────────────┘
                         ▼
                  generator/index.js (đọc: dataset.json + semantic.json + tokens.json
                                       — KHÔNG đọc spec/technical)
                         ▼
                  rebuild/output/ (project Vite tĩnh)
                         │
                         ▼
                  qa/index.js (đọc TẤT CẢ output ở trên + npm install && npm run build
                                trong rebuild/output/)
                         ▼
                  qa/output/{report.json,report.md}
```

---

## 6. INPUT/OUTPUT CHI TIẾT TỪNG STAGE (bảng tổng hợp)

| Stage | Input (đọc) | Output (ghi) |
|---|---|---|
| capture | URL đích (env `CAPTURE_TARGET` hoặc default) | `capture/raw/**`, `capture/report.json` |
| normalize | `capture/raw/{dom,style}/*`, existence check `capture/raw/*` | `normalize/output/{dom,css,text,assets}.json` |
| analyzer.layout | `normalize/output/{dom,css}.json` | `analyzer/output/layout.json` |
| analyzer.component | `normalize/output/dom.json` | `analyzer/output/components.json` |
| analyzer.design | `normalize/output/css.json` | `analyzer/output/design.json` |
| analyzer.interaction | `normalize/output/dom.json` | `analyzer/output/interaction.json` |
| analyzer.vision | `normalize/output/assets.json`, `capture/raw/screenshots/home.png` | `analyzer/output/vision.json` |
| analyzer.merge | 5 file `analyzer/output/*.json` ở trên | `analyzer/output/analysis.json` |
| style-extraction | `normalize/output/css.json`, `analyzer/output/design.json` | `style-extraction/output/tokens.json` |
| collector | `capture/report.json`, `normalize/output/{dom,css,text,assets}.json`, `analyzer/output/analysis.json`, `style-extraction/output/tokens.json` | `collector/output/dataset.json` |
| ai-analysis | `collector/output/dataset.json` | `ai-analysis/output/semantic.json` |
| spec/functional | `collector/output/dataset.json`, `ai-analysis/output/semantic.json` | `spec/functional/output/{spec.json,spec.md}` |
| spec/technical | `collector/output/dataset.json`, `ai-analysis/output/semantic.json`, `spec/functional/output/spec.json`, `style-extraction/output/tokens.json` | `spec/technical/output/{spec.json,spec.md}` |
| generator | `collector/output/dataset.json`, `ai-analysis/output/semantic.json`, `style-extraction/output/tokens.json` | `rebuild/output/*` |
| qa | mọi output ở trên + build thử `rebuild/output` | `qa/output/{report.json,report.md}` |

---

## 7. TÀI LIỆU VÀ VAI TRÒ TỪNG FILE

| File | Vai trò | Đối tượng đọc |
|---|---|---|
| `README.md` | Hướng dẫn con người: cài đặt, chạy, kiến trúc tóm tắt, output chuẩn, hướng dẫn phát triển tiếp | Người mới tiếp cận dự án |
| `CLAUDE.md` | Tài liệu kỹ thuật sâu, chi tiết từng data contract, known rough edges, blocker đã biết — nguồn sự thật kỹ thuật chính | AI agent / dev sửa code |
| `HANDOFF.md` (file này) | Gói bàn giao đầy đủ, tự chứa, không cần ngữ cảnh hội thoại — bao phủ TOÀN BỘ thông tin dự án tại 1 thời điểm | Agent/người tiếp quản mới hoàn toàn |
| `docs/archive/CURRENT_ARCHITECTURE.md` | Audit kiến trúc từ giai đoạn đầu dự án — ĐÃ LỖI THỜI, giữ lịch sử | Tham khảo lịch sử, không dùng để ra quyết định |
| `docs/archive/DEPENDENCY_GRAPH.md` | Sơ đồ dependency từ giai đoạn đầu — ĐÃ LỖI THỜI | Tham khảo lịch sử |
| `docs/archive/IMPLEMENTATION_PLAN.md` | Kế hoạch triển khai gốc — ĐÃ LỖI THỜI | Tham khảo lịch sử |
| `docs/archive/PROJECT_STATUS.md` | Báo cáo trạng thái gốc — ĐÃ LỖI THỜI | Tham khảo lịch sử |
| `.gitignore` | Loại trừ `node_modules/`, `rebuild/output/{node_modules,dist,package-lock.json}` khỏi version control tương lai | git (chưa init) |

---

## 8. QUYẾT ĐỊNH KIẾN TRÚC ĐÃ CHỐT

1. Pipeline file-based, không gọi hàm xuyên stage — chỉ `pipeline/index.js` điều phối qua named export.
2. `shared/paths.js` là registry đường dẫn duy nhất.
3. Model layer (layout/component/interaction) liên kết qua field `index`/`endIndex` (vị trí tài liệu), KHÔNG tạo module correlation riêng.
4. Generator không bao giờ fabricate — bỏ qua nội dung thiếu thay vì điền placeholder.
5. `spec/technical` và `generator` cố ý tách rời — technical spec được viết để khớp với output THẬT của generator (static-html/vite), thay vì bắt generator đọc theo spec.
6. KHÔNG có Plugin Architecture/Caching/Logging framework/Feedback Loop — từ chối có chủ đích vì chưa có bằng chứng cần thiết.
7. Chỉ capture 1 trang/1 target mỗi lần — không crawl đa trang, từ chối có chủ đích vì chưa có bằng chứng nhu cầu.
8. Root `config.js` đã xoá, `capture/config.js` là nguồn config duy nhất, đọc `CAPTURE_TARGET`/`CAPTURE_HEADLESS` từ env.
9. `normalize/html.js` đã xoá — trùng lặp hoàn toàn với field `html` trong `dom.json`.
10. `capture/report.js` đọc target từ `config.target` (không hardcode) — đã verify sống bằng capture thật vào `playwright.dev`.

---

## 9. QUY ƯỚC / NGUYÊN TẮC PHÁT TRIỂN BẮT BUỘC

- Trước khi sửa bất kỳ module nào, phải trả lời được: module đang làm gì, thuộc subsystem nào, input là gì, output là gì, output đó ai dùng, sửa thì ảnh hưởng downstream nào, xoá thì mất gì.
- Ưu tiên tuyệt đối: hiểu → tận dụng → refactor → mở rộng → chỉ tạo mới khi thật sự cần. Không rewrite toàn bộ.
- KHÔNG BAO GIỜ fabricate/placeholder/hardcode/demo data — mọi hàm sinh nội dung phải bỏ qua khi không có dữ liệu thật, không được điền giá trị giả để "trông đầy đủ".
- Sau mỗi thay đổi phải verify lại từ trạng thái sạch: xoá `*/output` liên quan, chạy lại `npm run pipeline:skip-capture`, kiểm `qa/output/report.json.passed`.
- Sau khi sửa BẤT KỲ file `analyzer/*.js` riêng lẻ nào, PHẢI chạy lại `analyzer/merge.js` (hoặc `analyzer/index.js`) trước khi chạy `collector/` — nếu không, `analysis.json` sẽ phục vụ dữ liệu cũ một cách im lặng cho mọi stage sau.
- Mọi thay đổi ảnh hưởng cấu trúc phải test trên ít nhất 2 site khác nhau về cấu trúc (dự án này dùng `preny.ai` + `playwright.dev` làm 2 site đối chứng) để tránh hardcode ẩn theo 1 site cụ thể.
- Không có test suite tự động — xác minh bằng cách chạy stage/pipeline thật rồi đọc JSON output + `qa/output/report.json`.

---

## 10. DEPENDENCY GIỮA CÁC MODULE (bảng ma trận)

| Module tiêu thụ | Phụ thuộc vào |
|---|---|
| `capture/index.js` | `browser.js, har.js, html.js, dom.js, cookies.js, storage.js, screenshot.js, style.js, websocket.js, report.js, viewport.js, config.js` |
| tất cả `capture/*.js` (trừ index.js) | `capture/config.js` |
| `normalize/index.js` | `dom.js, css.js, text.js, assets.js` |
| `normalize/dom.js` | `shared/dom-parser.js`, `shared/paths.js`, `shared/load.js`, `capture/raw/dom/dom.html` |
| `normalize/css.js` | `shared/paths.js`, `shared/load.js`, `capture/raw/style/styles.json` |
| `normalize/text.js` | `capture/raw/dom/dom.html` (đọc trực tiếp bằng `fs`, không qua `shared/paths.js`) |
| `normalize/assets.js` | `shared/paths.js`, `shared/load.js`, mọi `capture/raw/*` |
| `analyzer/index.js` | `layout.js, component.js, design.js, interaction.js, vision.js, merge.js` |
| `analyzer/layout.js` | `shared/paths.js`, `shared/load.js`, `normalize/output/{dom,css}.json` |
| `analyzer/component.js` | `shared/paths.js`, `shared/load.js`, `normalize/output/dom.json` |
| `analyzer/design.js` | `shared/paths.js`, `shared/load.js`, `normalize/output/css.json` |
| `analyzer/interaction.js` | `shared/paths.js`, `shared/load.js`, `normalize/output/dom.json` |
| `analyzer/vision.js` | `shared/paths.js`, `shared/load.js`, `sharp`, `normalize/output/assets.json`, `capture/raw/screenshots/home.png` |
| `analyzer/merge.js` | `shared/paths.js`, `shared/load.js`, 5 file `analyzer/output/*.json` |
| `style-extraction/index.js` | `shared/paths.js`, `shared/load.js`, `normalize/output/css.json`, `analyzer/output/design.json` |
| `collector/index.js` | `shared/paths.js`, `shared/load.js`, `capture/report.json`, `normalize/output/*`, `analyzer/output/analysis.json`, `style-extraction/output/tokens.json` |
| `ai-analysis/index.js` | `shared/paths.js`, `shared/load.js`, `collector/output/dataset.json` |
| `spec/functional/index.js` | `shared/paths.js`(`../../shared/paths`), `shared/load.js`, `collector/output/dataset.json`, `ai-analysis/output/semantic.json` |
| `spec/technical/index.js` | như trên + `spec/functional/output/spec.json`, `style-extraction/output/tokens.json` |
| `generator/index.js` | `shared/paths.js`, `shared/load.js`, `collector/output/dataset.json`, `ai-analysis/output/semantic.json`, `style-extraction/output/tokens.json`, `generator/faithfulClone.js`, `generator/harAssets.js`, `generator/runtimeInteractions.js` |
| `generator/faithfulClone.js` | `cheerio`; đọc `dataset.normalize.dom.html` + `dataset.source.target` (đã có sẵn trong `dataset.json`, không cần path mới); nhận `localizer` (từ `harAssets.js`) làm tham số |
| `generator/harAssets.js` | `shared/paths.js` (`paths.capture.har`), Node `crypto`/`fs`; đọc `capture/raw/har/preny.har` trực tiếp (đăng ký sẵn trong `paths.js`, không phải path mới) |
| `generator/runtimeInteractions.js` | không phụ thuộc gì — JS thuần viết tay, trả về string |
| `capture/scroll.js` | Playwright `page` object, gọi từ `capture/index.js` |
| `qa/index.js` (bổ sung) | `cheerio` (để parse `rebuild/output/index.html` trong `validateNoOriginDependency()`) |
| `qa/index.js` | `shared/paths.js`, `shared/load.js`, mọi output 9 stage trước, `child_process.execSync` (npm install/build trong rebuild/output) |
| `pipeline/index.js` | `child_process.execSync` (cho capture), `require()` từng stage's `index.js` |

Dependency ngoài (`package.json`): `playwright` (capture), `cheerio` (shared/dom-parser.js), `sharp` (analyzer/vision.js). `rebuild/output/package.json` có dependency riêng: `vite` (devDependency duy nhất).

---

## 11. ĐÃ HOÀN THÀNH (toàn bộ, theo thứ tự thời gian)

1. Audit toàn bộ 32 file `.js` gốc, đọc trực tiếp không suy đoán.
2. Sửa `capture/websocket.js` thiếu `require('path')` → `ReferenceError` khi flush WS frames.
3. Xoá `capture/auth.js`, `capture/video.js` (dead code, không ai require).
4. Xoá root `config.js`, hợp nhất logic env-var (`CAPTURE_TARGET`/`CAPTURE_HEADLESS`) vào `capture/config.js`.
5. Sửa `spec/technical/index.js` để khớp thực tế `generator` (framework='static-html', dependencies={runtime:[],dev:['vite']}).
6. Sửa `analyzer/vision.js` bug rgb vượt 255 (`bucketChannel()` clamp).
7. Sửa `ai-analysis/index.js` heuristic ngôn ngữ (`VIETNAMESE_CHARS` regex thay `includes('chatbot')`).
8. Thêm khử trùng lặp content-section theo type (sau đó được thay bằng cấu trúc thật ở mục 19).
9. Chuyển 4 tài liệu audit gốc vào `docs/archive/`, đánh dấu lỗi thời.
10. Xoá file mồ côi root `capture-report.json`.
11. Thêm `qa/index.js.getCaptureStatus()` — cảnh báo capture stale/thất bại, thêm `paths.capture.report` vào REQUIRED_OUTPUTS.
12. Xoá `normalize/html.js` (trùng lặp `dom.json.html`) + 5 điểm tham chiếu liên quan (`shared/paths.js`, `qa/index.js`, `collector/index.js`, `normalize/index.js`).
13. Nối `generator/index.js` với `interaction.json` thật — nav link thật, contact form thật, bỏ hardcode fake nav/features.
14. Gộp section generator theo type thật (bước trung gian, sau bị thay bằng mục 19).
15. Phát hiện + sửa `capture/report.js` hardcode `target='https://preny.ai'` (tìm ra khi capture live vào `playwright.dev`).
16. Verify sống capture vào site thứ 2 (`playwright.dev`) — chứng minh không hardcode.
17. Sửa bug độ ưu tiên `analyzer/component.js.detectComponentType()` (class-check phải trước tag-fallback).
18. Thêm field `index` (`shared/dom-parser.js`) + `endIndex` theo `depth` (`analyzer/layout.js`) — hợp đồng liên kết giữa 3 Model.
19. Viết lại `ai-analysis/index.js.extractContentSections()` — tái cấu trúc section thật bằng correlation `index`/`endIndex`, lấy text từ toàn bộ node list.
20. Viết lại `generator/index.js.buildBodySections()` — 1 section HTML thật ứng đúng 1 section DOM thật, bỏ cơ chế gộp lưới thẻ.
21. Sửa `buildHeroSection` fake fallback `'Welcome'`.
22. Verify lặp lại nhiều lần: pipeline+QA+build từ trạng thái sạch hoàn toàn, trên cả 2 site.
23. Tạo `README.md` (mới), cập nhật `CLAUDE.md` liên tục theo từng thay đổi, thêm `.gitignore`.
24. Dọn `rebuild/output/{node_modules,dist,package-lock.json}` (build-artifact tái tạo được), chạy lại QA lần cuối để report khớp đĩa thật.
25. Đóng gói 2 lần (`.zip`) — bản gần nhất kèm `README.md`+`CLAUDE.md` cập nhật.
26b. **(Phiên trước) Thêm `generator/faithfulClone.js` — clone HTML thật thay cho khung trang tổng hợp cố định (giải quyết Backlog #1 cũ).** Xác nhận `dataset.normalize.dom.html` (đầy đủ, không cắt) và `dataset.source.target` đã sẵn có trong `dataset.json` qua `collector` — không cần stage/path mới, không phá kiến trúc hiện có. Verify thực nghiệm: `cheerio('*')` khớp 1-1 theo index với `styles.json` (1960 phần tử, 0 sai lệch) — ghi lại làm building block. Đường chính lúc đó: real `<head>` + real `<body>` + rewrite URL root-relative thành **absolute về origin đã capture (hotlink)** — cách này bị thay thế ở mục 27 bên dưới do yêu cầu siết chặt hơn ở phiên sau. Fallback về builder tổng hợp cũ khi thiếu dữ liệu (không throw). Test bằng fixture tổng hợp khác cấu trúc (site giả kiểu docs, origin khác) để xác nhận không hardcode theo preny.ai.
27. **(Phiên này) Xoá hotlink — thêm `generator/harAssets.js` (localize asset thật từ HAR), `capture/scroll.js` (cuộn trang trước khi chụp để lazy-image vào HAR), `generator/runtimeInteractions.js` (JS thuần khôi phục toggle accordion/tabs thật), `qa/index.js.validateNoOriginDependency()` (gate cứng: fail QA nếu còn request runtime trỏ origin đã capture).** Bối cảnh: yêu cầu mới siết chặt — cấm hotlink hoàn toàn, bắt buộc độc lập khỏi website gốc lúc build/runtime, tiếp tục tái tạo hành vi client. Phát hiện quan trọng: `capture/har.js` đã capture HAR với `mode:'full'` từ trước (chứa full response body thật của CSS/font/image/icon) nhưng chưa ai đọc — dùng lại dữ liệu đã có, không cần capture mới, không cần mạng. `generator/harAssets.js.createAssetLocalizer()` build `Map<url,{buffer,mimeType}>` từ HAR, ghi asset thật ra `public/assets/<sha1>.<ext>` (đè hash để tránh trùng tên/ký tự lạ), rewrite mọi `src/href/action/srcset/style-url()` + đệ quy rewrite `url()` bên trong CSS thật (font/ảnh tham chiếu từ stylesheet). Asset không có trong HAR (do chưa từng được browser request — đa số ảnh `loading="lazy"` dưới màn hình đầu) bị hạ về same-origin-relative (404 cục bộ, không hotlink, không fabricate placeholder) — coverage ghi vào `public/assets/manifest.json`. Verify bằng grep: 0 tham chiếu `preny.ai` còn lại trong `index.html`/`dist/index.html`/mọi `public/assets/*.css` ngoài metadata (canonical/og/twitter) + `mailto:` (không phải request runtime). `capture/scroll.js.scrollFullPage()` thêm vào `capture/index.js` sau `page.goto`, trước khi lưu bất kỳ artifact nào — chỉ có tác dụng cho lần capture MỚI, không hồi tố được dữ liệu HAR đã có (đã verify egress tới preny.ai bị chặn trong sandbox này qua `curl` + `http://127.0.0.1:39827/__agentproxy/status`). `generator/runtimeInteractions.js` viết tay 1 file JS thuần nhỏ (không dependency, không React/hydration) khôi phục toggle `aria-expanded`/`data-state` cho accordion FAQ + tabs ngành thật — đã verify target ID tồn tại thật trong `dom.html` trước khi implement (2 widget khác — combobox ngôn ngữ, dialog mobile — không có target trong DOM đã capture vì Radix chỉ mount portal khi tương tác lần đầu, ghi nhận là giới hạn đã biết ở Backlog #10, không cố fabricate). Verify runtime thật: `npm run generate` → `vite preview` → Playwright Chromium thật load trang → title/nav/hero/accordion đúng dữ liệu thật → click accordion trigger → `aria-expanded` đổi `false→true` → 0/36 network request trỏ `preny.ai` → 0 console/page error. Verify lại toàn bộ theo mục 19: `qa/output/report.json.passed:true`, `13/13`, `0` analysis issue, `0` origin-dependency issue, build Vite pass.

---

## 12. CHƯA HOÀN THÀNH / BACKLOG CÒN LẠI

| # | Mô tả | Mức độ | Lý do chưa làm |
|---|---|---|---|
| 1 | ~~`generator/index.js` vẫn dùng khung trang cố định~~ — **ĐÃ GIẢI QUYẾT**: thêm `generator/faithfulClone.js`, đường chính giờ clone HTML thật (đúng cấu trúc/class/text thật, không còn khung tổng hợp cố định) + `generator/harAssets.js` localize toàn bộ asset thật từ HAR về `public/assets/` (không hotlink). Builder tổng hợp cũ vẫn giữ nguyên làm fallback khi thiếu dữ liệu. Xem CLAUDE.md mục "Generated output" + HANDOFF.md Stage 9. | — | Đã làm qua 2 phiên |
| 2 | `analyzer/component.js`: class chứa cả `cta` và `banner` (vd `"cta-banner"`) bị nhận `hero` (do check `banner` trước `cta` trong thứ tự heuristic) | Nhỏ | Ảnh hưởng thấp, chưa có bằng chứng gây sai lệch thật trên 2 site test; không ảnh hưởng đường faithful-clone mới (đường đó không dùng `component.js` để dựng HTML) |
| 3 | `buildHeaderSection` (nhánh tổng hợp cũ, fallback) đôi khi bắt cả link tiện ích accessibility làm mục nav | Nhỏ, thẩm mỹ | Chỉ ảnh hưởng nhánh fallback, không ảnh hưởng đường faithful-clone chính |
| 4 | Capture đa trang/đa route | Chưa triển khai | Chưa đủ bằng chứng nhu cầu, từ chối có chủ đích |
| 5 | `ignoreHTTPSErrors` cho capture (để vượt qua site có cert lỗi/hết hạn) | Chưa triển khai | Chỉ đạo rõ ràng: không thêm trừ khi đã có sẵn — hiện chưa có |
| 6 | Test suite tự động | Chưa có | Chưa được yêu cầu; xác minh hiện tại dựa vào chạy pipeline+QA thật |
| 7 | `git init` | Đã có (repo git thật, branch `claude/preny-website-recreation-2vz5cz`) | — |
| 8 | ~~Faithful clone hotlink CSS/asset về origin gốc~~ — **ĐÃ GIẢI QUYẾT**: `generator/harAssets.js` trích asset thật từ `capture/raw/har/preny.har` (đã capture với `mode:'full'`, chỉ chưa ai dùng tới), lưu cục bộ `public/assets/`, rewrite toàn bộ HTML+CSS trỏ nội bộ. `qa/index.js.validateNoOriginDependency()` fail cứng nếu còn tham chiếu runtime tới origin. | — | Đã làm trong phiên này |
| 9 | Coverage asset thật hiện tại chỉ `68/221` (153 asset chưa từng được browser request lúc capture — chủ yếu ảnh `loading="lazy"` dưới màn hình đầu, vì lần capture đã lưu trong repo KHÔNG cuộn trang) | Đã biết, có bằng chứng (`public/assets/manifest.json`, `qa/output/report.json.assetManifest`) | Đã thêm `capture/scroll.js` để lần capture MỚI khắc phục tận gốc; không thể hồi tố dữ liệu HAR đã có sẵn vì sandbox chặn egress tới preny.ai (verify bằng `curl` + proxy status endpoint) — cần chạy `npm run capture` thật ở môi trường có mạng để đóng hoàn toàn khoảng trống này |
| 10 | 2 widget Radix (combobox chọn ngôn ngữ, dialog menu mobile) không khôi phục được nội dung popup — trigger có `aria-expanded`/`aria-controls` thật nhưng target ID không tồn tại trong DOM đã capture | Đã biết, có bằng chứng (đã verify bằng script kiểm tra `aria-controls` id tồn tại trong `dom.html`) | Radix chỉ mount nội dung portal khi lần đầu tương tác — do capture chưa từng mở 2 widget này nên nội dung thật chưa bao giờ được ghi lại, không thể tái tạo mà không fabricate |

---

## 13. KNOWN ISSUES

### Đã sửa trong repo hiện tại (liệt kê để biết lịch sử, KHÔNG còn là vấn đề)
- `capture/websocket.js` thiếu `require('path')` → ReferenceError.
- `capture/report.js` hardcode target sai bất kể site nào được capture.
- `analyzer/component.js` bug độ ưu tiên phân loại (SECTION luôn về type 'section', không bao giờ ra pricing/cta/testimonial).
- `analyzer/vision.js` rgb vượt 255 (không hợp lệ theo CSS spec).
- `analyzer/design.js` rò rỉ tên font nội bộ Next.js (`__Inter_bfdb96`) vào CSS sinh ra.
- `ai-analysis/index.js` heuristic ngôn ngữ vô nghĩa (`includes('chatbot')`).
- `generator/index.js` hardcode nav/features/hero fake khi thiếu dữ liệu thật.
- `normalize/html.js` trùng lặp hoàn toàn `dom.json.html`.
- root `config.js` dead code, gây "bẫy" env-var không có tác dụng.
- `capture/auth.js`, `capture/video.js` dead code.
- `qa/index.js` không kiểm tra gì về stage `capture` (điểm mù QA).
- `analyzer/merge.js` không tự chạy lại khi sửa module con — gây stale data 1 lần trong quá trình phát triển (đã tự phát hiện và sửa ngay trong phiên làm việc gây ra nó).

### Còn tồn tại (xem mục 12 — Backlog)
- Class heuristic `banner`/`cta` chồng lấn.
- Nav bắt nhầm skip-link.
- Khung trang cố định (chưa dùng `layout.json` để quyết định toàn bộ hình dạng trang).

---

## 14. GIẢ ĐỊNH CÒN TỒN TẠI (chưa được verify tuyệt đối, đang được chấp nhận)

- Site đích luôn là single-page (chỉ trang chủ) — không giả định crawl nhiều trang.
- `capture/config.js` dùng `channel:'chrome'` — giả định máy chạy có Google Chrome cài sẵn (đã xác nhận đúng trong môi trường hiện tại, KHÔNG đảm bảo đúng ở môi trường khác).
- Chứng chỉ TLS của target phải hợp lệ — không có cơ chế bỏ qua, chấp nhận đây là yêu cầu cứng theo chỉ đạo người dùng.
- Danh sách `SPECIFIC_COMPONENT_TYPES` (hero/pricing/cta/testimonial/card/modal) trong `ai-analysis` được giả định là đủ đại diện; site dùng ngữ nghĩa hoàn toàn khác sẽ rơi về nhãn generic "Section N" — chấp nhận là trung thực-nhưng-chung-chung, không coi là lỗi.
- Ngưỡng "stale" 24h trong `qa/getCaptureStatus()` là lựa chọn tuỳ ý có ghi chép, không suy ra từ yêu cầu cụ thể nào.

---

## 15. TIÊU CHUẨN NGHIỆM THU

| Tiêu chuẩn | Trạng thái |
|---|---|
| Pipeline chạy end-to-end (`npm run pipeline` hoặc `:skip-capture`) | ĐẠT (đường skip-capture; đường live-capture bị block bởi cert bên ngoài, đã verify hoạt động với target khác) |
| 0 `status:'placeholder'` trong mọi output | ĐẠT, verify lặp lại nhiều lần |
| 0 module mồ côi (mọi `.js` được require bởi module khác) | ĐẠT, verify bằng grep |
| 0 output mồ côi ở luồng lõi | ĐẠT cho `interaction.json`/`layout.json` (nay có consumer thật); `capture/raw/har/preny.har` KHÔNG còn mồ côi — `generator/harAssets.js` đọc trực tiếp để localize asset thật (xem Backlog #8) |
| Không hardcode/fake/demo content trong generator | ĐẠT, verify bằng test dữ liệu rỗng (hero/nav/features/form đều bỏ qua đúng khi thiếu dữ liệu thật) |
| QA pass (`qa/output/report.json.passed === true`) | ĐẠT tại thời điểm snapshot |
| `rebuild/output` build được (`npm run build` qua Vite) | ĐẠT, verify nhiều lần kể cả từ trạng thái sạch hoàn toàn |
| Tài liệu khớp mã nguồn | ĐẠT — `README.md`+`CLAUDE.md` cập nhật tới thời điểm snapshot |
| Tổng quát, không hardcode 1 site | ĐẠT — verify bằng capture+pipeline live trên site thứ 2 cấu trúc khác hẳn |

---

## 16. CÁCH CHẠY

```bash
npm install

# Pipeline đầy đủ, capture live
CAPTURE_TARGET=https://example.com npm run pipeline
# CAPTURE_TARGET mặc định https://preny.ai nếu bỏ qua
# CAPTURE_HEADLESS=true để chạy browser ẩn (mặc định hiển thị cửa sổ)

# Pipeline đầy đủ, dùng lại dữ liệu capture có sẵn trong repo (không cần mạng)
npm run pipeline:skip-capture

# Chạy từng stage riêng lẻ
npm run capture
npm run normalize
npm run analyze
npm run style-extraction
npm run collector
npm run ai-analysis
npm run functional-spec
npm run technical-spec
npm run generate
npm run qa

# pipeline/index.js hỗ trợ thêm
node pipeline/index.js --from <stage>
node pipeline/index.js --only <stage>
```

---

## 17. CÁCH BUILD

```bash
cd rebuild/output
npm install
npm run build     # → dist/
npm run dev       # dev server
npm run preview   # xem thử bản build
```

`npm run qa` (ở root) đã tự động làm `npm install && npm run build` bên trong `rebuild/output/` như 1 phần của validate — QA pass tức là build pass.

---

## 18. CÁCH TEST

Không có test suite tự động (unit test/integration test framework) trong dự án này — đây là quyết định hiện trạng, không phải thiếu sót chưa làm.

Cách "test" thực tế của dự án:
1. Chạy stage/pipeline thật.
2. Đọc trực tiếp JSON output bằng `node -e "console.log(require('./<stage>/output/<file>.json'))"`.
3. Chạy `npm run qa` — đây là cơ chế kiểm định gần nhất với "test suite" mà dự án có.
4. Với thay đổi ảnh hưởng cấu trúc: chạy lại trên ít nhất 2 site khác nhau (`CAPTURE_TARGET=<url thứ 2>`), so sánh kết quả để đảm bảo không hardcode.

---

## 19. CÁCH VERIFY

```bash
# Xoá toàn bộ output trung gian để đảm bảo không dùng dữ liệu cache/cũ
rm -rf normalize/output analyzer/output style-extraction/output collector/output \
       ai-analysis/output spec/functional/output spec/technical/output \
       rebuild/output/{node_modules,dist,package-lock.json} qa/output

npm run pipeline:skip-capture

node -e "
const r = require('./qa/output/report.json');
console.log('passed:', r.passed);
console.log('checks:', r.summary.passedChecks + '/' + r.summary.totalChecks);
console.log('analysisIssues:', r.analysisIssues.length);
console.log('buildPassed:', r.rebuildBuild.passed, '| distExists:', r.rebuildBuild.distExists);
"

# Kiểm tra không còn placeholder ở bất kỳ đâu
grep -rc '"status"[[:space:]]*:[[:space:]]*"placeholder"' \
  normalize/output/*.json analyzer/output/*.json style-extraction/output/*.json \
  collector/output/*.json ai-analysis/output/*.json spec/*/output/*.json 2>/dev/null | grep -v ":0$"
# Không có dòng nào in ra = sạch
```

Kỳ vọng: `passed: true`, `checks: 13/13`, `analysisIssues: 0`, `buildPassed: true`, `distExists: true`, không có dòng placeholder nào.

---

## 20. NHỮNG ĐIỂM TUYỆT ĐỐI KHÔNG ĐƯỢC THAY ĐỔI (trừ khi có chỉ đạo mới rõ ràng)

- KHÔNG thêm `ignoreHTTPSErrors: true` hay bất kỳ cơ chế bỏ qua SSL nào vào `capture/browser.js`/`capture/index.js` — repo hiện chưa có, chỉ đạo rõ ràng là không tự thêm.
- KHÔNG thêm Plugin Architecture, Caching layer, Logging framework, Feedback Loop, Error Recovery framework — đã bị từ chối có chủ đích vì chưa có bằng chứng cần thiết.
- KHÔNG triển khai capture đa trang/đa route — chưa đủ bằng chứng nhu cầu.
- KHÔNG rewrite toàn bộ / không phá kiến trúc hiện có khi chưa có bằng chứng bắt buộc.
- KHÔNG được để bất kỳ hàm sinh nội dung nào (trong `generator/`) fabricate dữ liệu giả — luôn bỏ qua khi thiếu dữ liệu thật, không điền placeholder.
- KHÔNG được bỏ qua bước chạy lại `analyzer/merge.js` sau khi sửa module con trong `analyzer/`.
- KHÔNG xoá `capture/raw/har/preny.har` hay coi nó là cache cần dọn — là dữ liệu capture gốc hợp lệ.
- KHÔNG dựa vào mô tả "root config.js" trong bất kỳ tài liệu cũ nào (`docs/archive/`) — file đó đã bị xoá, không còn tồn tại.
- KHÔNG coi `docs/archive/*.md` là nguồn sự thật hiện tại — chúng đã lỗi thời, chỉ `README.md`/`CLAUDE.md`/`HANDOFF.md` (file này) mới phản ánh đúng trạng thái hiện tại.

---

## 21. THÔNG TIN BỔ SUNG CHO AGENT MỚI TIẾP QUẢN

- Không có ngữ cảnh hội thoại nào cần thiết ngoài file này + `README.md` + `CLAUDE.md`.
- Thứ tự đọc khuyến nghị khi mới tiếp quản: file này (toàn cảnh) → `CLAUDE.md` (chi tiết kỹ thuật khi cần sửa code cụ thể) → `README.md` (khi cần hướng dẫn nhanh cho người dùng cuối).
- Khi cần tiếp tục phát triển: bắt đầu từ mục 12 (Backlog) của file này, áp dụng đúng quy trình 7 câu hỏi ở mục 9 trước khi sửa bất kỳ module nào, và luôn verify lại theo mục 19 sau mỗi thay đổi.
