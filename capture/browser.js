const { chromium } = require('playwright');
const config = require('./config');

async function createBrowser() {
  const browser = await chromium.launch({
    channel: config.browser.channel,
    headless: config.browser.headless
  });

  return browser;
}

module.exports = {
  createBrowser
};