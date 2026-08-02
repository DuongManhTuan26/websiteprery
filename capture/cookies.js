const fs = require('fs');
const config = require('./config');

async function saveCookies(context) {
  const cookies = await context.cookies();

  fs.writeFileSync(
    config.output.cookies,
    JSON.stringify(cookies, null, 2)
  );
}

module.exports = {
  saveCookies
};