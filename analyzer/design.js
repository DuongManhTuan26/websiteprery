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

function isNeutral(value) {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);

  if (!match) {
    return false;
  }

  const [r, g, b] = [match[1], match[2], match[3]].map(Number);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  const lowSaturation = (max - min) < 40;
  const tooDarkOrLight = avg < 40 || avg > 235;

  return lowSaturation || tooDarkOrLight;
}

async function analyzeDesign() {
  ensureDir(paths.analyzer.output);

  const cssData = readJson(paths.normalize.css);
  const styles = loadCssStyles(cssData);

  const textColors = {};
  const backgroundColors = {};
  const fonts = {};
  const fontSizes = {};
  const borderRadii = {};
  const shadows = {};

  for (const entry of styles) {
    const style = entry.style || {};

    const color = normalizeColor(style.color);
    const background = normalizeColor(style.background);

    // Kept separate on purpose: text color (near-black on almost every
    // element) always dominates by raw frequency and would otherwise crowd
    // out the site's actual brand/background colors if merged into one
    // bucket — "primary"/"secondary" tokens should come from backgrounds.
    if (color) textColors[color] = (textColors[color] || 0) + 1;
    if (background) backgroundColors[background] = (backgroundColors[background] || 0) + 1;

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

  // "Accent" = the most-used non-neutral color across text and background
  // together — a proxy for the site's actual brand color (buttons, links,
  // highlights), which pure frequency ranking of either bucket alone misses
  // (backgrounds are dominated by white/near-white, text by black/near-black).
  const combinedColors = {};

  for (const [value, count] of Object.entries(textColors)) {
    combinedColors[value] = (combinedColors[value] || 0) + count;
  }

  for (const [value, count] of Object.entries(backgroundColors)) {
    combinedColors[value] = (combinedColors[value] || 0) + count;
  }

  const accentColor = Object.entries(combinedColors)
    .filter(([value]) => !isNeutral(value))
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const result = {
    generatedAt: new Date().toISOString(),
    totalElements: styles.length,
    palette: topEntries(backgroundColors, 15),
    textColors: topEntries(textColors, 5),
    accentColor,
    typography: {
      fonts: topEntries(fonts, 5),
      fontSizes: topEntries(fontSizes, 10)
    },
    borderRadii: topEntries(borderRadii, 5),
    shadows: topEntries(shadows, 5),
    primaryFont: topEntries(fonts, 1)[0]?.value || null,
    dominantColors: topEntries(backgroundColors, 5).map(entry => entry.value)
  };

  writeJson(paths.analyzer.design, result);

  console.log('Design analysis OK —', result.palette.length, 'colors, font:', result.primaryFont);
}

module.exports = {
  analyzeDesign
};
