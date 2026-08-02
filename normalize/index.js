const { normalizeDom } = require('./dom');
const { normalizeCss } = require('./css');
const { normalizeText } = require('./text');
const { normalizeAssets } = require('./assets');

async function runNormalize() {
  console.log('1. DOM');
  await normalizeDom();

  console.log('2. CSS');
  await normalizeCss();

  console.log('3. TEXT');
  await normalizeText();

  console.log('4. ASSETS');
  await normalizeAssets();

  console.log('Normalize completed.');
}

module.exports = {
  runNormalize
};

if (require.main === module) {
  runNormalize().catch(console.error);
}
