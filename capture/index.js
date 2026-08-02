const { createBrowser } = require('./browser');
const { getHarOptions } = require('./har');
const { saveHtml } = require('./html');
const { saveDom } = require('./dom');
const { saveCookies } = require('./cookies');
const { saveStorage } = require('./storage');
const { saveScreenshot } = require('./screenshot');
const { saveStyles } = require('./style');
const { attachWebSocketLogger, flushWebSocketFrames } = require('./websocket');
const { generateReport } = require('./report');
const { getViewport } = require('./viewport');
const { scrollFullPage } = require('./scroll');
const { openAllInteractive } = require('./interact');
const config = require('./config');

(async () => {

  const startTime = new Date().toISOString();

  const browser = await createBrowser();

  const context = await browser.newContext({
    ...getHarOptions(),
    viewport: getViewport('desktop')
  });

  const page = await context.newPage();

  attachWebSocketLogger(page);

  await page.goto(config.target, {
    waitUntil: 'networkidle'
  });

  // Trigger below-the-fold lazy-loaded assets before capturing anything,
  // so the HAR/DOM/styles snapshot reflects a fully-loaded page rather
  // than just what was visible in the first viewport.
  await scrollFullPage(page);

  // Open every accordion/tab/dropdown/menu/popup this pipeline can find so
  // their real (currently lazy-mounted or hidden) content and any requests
  // it triggers land in the DOM snapshot and the HAR.
  await openAllInteractive(page);

  // Newly-opened panels can themselves contain below-the-fold lazy images
  // (e.g. a tall accordion panel) — scroll again to trigger those too.
  await scrollFullPage(page);

  await saveScreenshot(page);

  await saveHtml(page);

  await saveDom(page);

  await saveStyles(page);

  await saveCookies(context);

  await saveStorage(page);

  flushWebSocketFrames(page);

  await page.waitForTimeout(5000);

  await context.close();

  await browser.close();

  const endTime = new Date().toISOString();

  generateReport(startTime, endTime);

  console.log('Capture completed.');

})();