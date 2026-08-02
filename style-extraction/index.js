const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir } = require('../shared/load');

function buildTokens(cssData, designData) {
  const colors = designData.palette.map((entry, index) => ({
    name: index === 0 ? 'primary' : index === 1 ? 'secondary' : `color-${index + 1}`,
    value: entry.value,
    usage: entry.count
  }));

  const fonts = designData.typography.fonts.map((entry, index) => ({
    name: index === 0 ? 'primary' : `font-${index + 1}`,
    family: entry.value,
    usage: entry.count
  }));

  const fontSizes = designData.typography.fontSizes.map((entry, index) => ({
    name: `size-${index + 1}`,
    value: entry.value,
    usage: entry.count
  }));

  const spacing = Object.entries(cssData.statistics?.display || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([display, count]) => ({ display, count }));

  return {
    generatedAt: new Date().toISOString(),
    colors,
    accentColor: designData.accentColor,
    textColor: designData.textColors?.[0]?.value || null,
    radius: designData.borderRadii?.[0]?.value || null,
    typography: {
      fonts,
      fontSizes,
      primaryFont: designData.primaryFont,
      headingSizes: designData.typography.headingSizes
    },
    borderRadii: designData.borderRadii,
    shadows: designData.shadows,
    layout: {
      displayDistribution: cssData.statistics?.display || {},
      positionDistribution: cssData.statistics?.position || {}
    },
    spacing
  };
}

async function extractStyles() {
  ensureDir(paths.styleExtraction.output);

  const cssData = readJson(paths.normalize.css);
  const designData = readJson(paths.analyzer.design);

  const tokens = buildTokens(cssData, designData);

  writeJson(paths.styleExtraction.tokens, tokens);

  console.log('Style extraction OK —', tokens.colors.length, 'color tokens');
}

module.exports = {
  extractStyles
};

if (require.main === module) {
  extractStyles().catch(console.error);
}
