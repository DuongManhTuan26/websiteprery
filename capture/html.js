const fs = require('fs');
const config = require('./config');

async function saveHtml(page) {
  const html = await page.content();

  fs.writeFileSync(
    config.output.html,
    html
  );
}

module.exports = {
  saveHtml
};