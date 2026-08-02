const fs = require('fs');
const path = require('path');
const config = require('./config');

async function saveScreenshot(page) {
  fs.mkdirSync(path.dirname(config.output.screenshot), { recursive: true });

  await page.screenshot({
    path: config.output.screenshot,
    fullPage: true
  });
}

module.exports = {
  saveScreenshot
};