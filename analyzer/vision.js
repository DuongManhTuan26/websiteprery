const fs = require('fs');
const sharp = require('sharp');
const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir } = require('../shared/load');

function bucketChannel(value) {
  return Math.min(255, Math.round(value / 16) * 16);
}

async function extractDominantColors(imagePath, count = 5) {
  const { data, info } = await sharp(imagePath)
    .resize(100, 100, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bucket = {};

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (info.channels === 4 && data[i + 3] < 128) continue;

    const key = `${bucketChannel(r)},${bucketChannel(g)},${bucketChannel(b)}`;
    bucket[key] = (bucket[key] || 0) + 1;
  }

  return Object.entries(bucket)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([rgb, pixelCount]) => {
      const [r, g, b] = rgb.split(',').map(Number);
      return {
        rgb: `rgb(${r}, ${g}, ${b})`,
        pixelCount
      };
    });
}

async function analyzeVision() {
  ensureDir(paths.analyzer.output);

  const assets = readJson(paths.normalize.assets);
  const screenshotPath = paths.capture.screenshot;
  const screenshotAvailable = assets.screenshot?.exists && fs.existsSync(screenshotPath);

  const result = {
    generatedAt: new Date().toISOString(),
    screenshotAvailable,
    screenshot: null,
    dominantColors: []
  };

  if (screenshotAvailable) {
    const metadata = await sharp(screenshotPath).metadata();
    const stats = fs.statSync(screenshotPath);
    const dominantColors = await extractDominantColors(screenshotPath);

    result.screenshot = {
      path: screenshotPath,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      sizeBytes: stats.size,
      aspectRatio: metadata.width && metadata.height
        ? Number((metadata.width / metadata.height).toFixed(2))
        : null
    };

    result.dominantColors = dominantColors;
    result.pageHeight = metadata.height;
    result.isFullPage = metadata.height > 900;
  }

  writeJson(paths.analyzer.vision, result);

  console.log('Vision analysis OK — screenshot:', screenshotAvailable);
}

module.exports = {
  analyzeVision
};
