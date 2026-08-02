const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir, loadCssStyles } = require('../shared/load');

async function normalizeCss() {
  ensureDir(paths.normalize.output);

  const raw = readJson(paths.capture.styles);
  const styles = Array.isArray(raw) ? raw : raw.styles || [];

  const displayCounts = {};
  const positionCounts = {};

  for (const entry of styles) {
    const display = entry.style?.display || 'unknown';
    const position = entry.style?.position || 'unknown';

    displayCounts[display] = (displayCounts[display] || 0) + 1;
    positionCounts[position] = (positionCounts[position] || 0) + 1;
  }

  const result = {
    totalElements: styles.length,
    styles,
    statistics: {
      display: displayCounts,
      position: positionCounts
    }
  };

  writeJson(paths.normalize.css, result);

  console.log('CSS normalize OK —', styles.length, 'elements');
}

module.exports = {
  normalizeCss
};
