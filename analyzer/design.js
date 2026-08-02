const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir, loadCssStyles } = require('../shared/load');

function normalizeColor(value) {
  if (!value || value === 'rgba(0, 0, 0, 0)' || value === 'transparent') {
    return null;
  }

  return value.replace(/\s+/g, '');
}

function isSyntheticFontName(name) {
  // Build tools like Next.js next/font generate internal font-family
  // identifiers prefixed with "__" (e.g. "__Inter_bfdb96") that only resolve
  // via an @font-face rule private to the source site — not a real,
  // portable font name.
  return /^__/.test(name);
}

async function analyzeDesign() {
  ensureDir(paths.analyzer.output);

  const cssData = readJson(paths.normalize.css);
  const styles = loadCssStyles(cssData);

  const colors = {};
  const fonts = {};
  const fontSizes = {};
  const borderRadii = {};
  const shadows = {};

  for (const entry of styles) {
    const style = entry.style || {};

    const color = normalizeColor(style.color);
    const background = normalizeColor(style.background);

    if (color) colors[color] = (colors[color] || 0) + 1;
    if (background) colors[background] = (colors[background] || 0) + 1;

    if (style.fontFamily) {
      const font = style.fontFamily.split(',')[0].trim().replace(/"/g, '');
      if (!isSyntheticFontName(font)) {
        fonts[font] = (fonts[font] || 0) + 1;
      }
    }

    if (style.fontSize) {
      fontSizes[style.fontSize] = (fontSizes[style.fontSize] || 0) + 1;
    }

    if (style.borderRadius && style.borderRadius !== '0px') {
      borderRadii[style.borderRadius] = (borderRadii[style.borderRadius] || 0) + 1;
    }

    if (style.boxShadow && style.boxShadow !== 'none') {
      shadows[style.boxShadow] = (shadows[style.boxShadow] || 0) + 1;
    }
  }

  function topEntries(map, limit = 10) {
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  }

  const result = {
    generatedAt: new Date().toISOString(),
    totalElements: styles.length,
    palette: topEntries(colors, 15),
    typography: {
      fonts: topEntries(fonts, 5),
      fontSizes: topEntries(fontSizes, 10)
    },
    borderRadii: topEntries(borderRadii, 5),
    shadows: topEntries(shadows, 5),
    primaryFont: topEntries(fonts, 1)[0]?.value || null,
    dominantColors: topEntries(colors, 5).map(entry => entry.value)
  };

  writeJson(paths.analyzer.design, result);

  console.log('Design analysis OK —', result.palette.length, 'colors, font:', result.primaryFont);
}

module.exports = {
  analyzeDesign
};
