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