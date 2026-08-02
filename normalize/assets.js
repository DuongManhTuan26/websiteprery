const fs = require('fs');
const paths = require('../shared/paths');
const { writeJson, ensureDir } = require('../shared/load');

async function normalizeAssets() {
  ensureDir(paths.normalize.output);

  function assetEntry(filePath) {
    const exists = fs.existsSync(filePath);

    return {
      exists,
      path: filePath,
      size: exists ? fs.statSync(filePath).size : 0
    };
  }

  const assets = {
    screenshot: assetEntry(paths.capture.screenshot),
    har: assetEntry(paths.capture.har),
    cookies: assetEntry(paths.capture.cookies),
    localStorage: assetEntry(paths.capture.localStorage),
    sessionStorage: assetEntry(paths.capture.sessionStorage),
    indexedDB: assetEntry(paths.capture.indexedDB),
    styles: assetEntry(paths.capture.styles),
    websocket: assetEntry(paths.capture.websocket)
  };

  writeJson(paths.normalize.assets, assets);

  console.log('Assets normalize OK');
}

module.exports = {
  normalizeAssets
};
