const fs = require('fs');
const config = require('./config');

async function saveDom(page) {
  const dom = await page.evaluate(() => {
    return document.documentElement.outerHTML;
  });

  fs.writeFileSync(
    config.output.dom,
    dom
  );
}

module.exports = {
  saveDom
};