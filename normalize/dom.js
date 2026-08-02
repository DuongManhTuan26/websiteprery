const fs = require('fs');
const paths = require('../shared/paths');
const { writeJson, ensureDir } = require('../shared/load');
const { parseHtmlToNodes } = require('../shared/dom-parser');

async function normalizeDom() {
  ensureDir(paths.normalize.output);

  const html = fs.readFileSync(paths.capture.dom, 'utf8');
  const { nodes, statistics } = parseHtmlToNodes(html);

  const result = {
    length: html.length,
    html,
    nodes,
    statistics
  };

  writeJson(paths.normalize.dom, result);

  console.log('DOM normalize OK —', statistics.totalNodes, 'nodes');
}

module.exports = {
  normalizeDom
};
