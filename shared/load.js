const fs = require('fs');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required input: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function loadDomNodes(domData) {
  if (Array.isArray(domData)) {
    return domData;
  }

  if (domData && Array.isArray(domData.nodes)) {
    return domData.nodes;
  }

  return [];
}

function loadCssStyles(cssData) {
  if (Array.isArray(cssData)) {
    return cssData;
  }

  if (cssData && Array.isArray(cssData.styles)) {
    return cssData.styles;
  }

  return [];
}

module.exports = {
  readJson,
  writeJson,
  ensureDir,
  loadDomNodes,
  loadCssStyles
};
