const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir, loadDomNodes, loadCssStyles } = require('../shared/load');

function findSectionEnd(nodes, startIndex, depth) {
  for (let i = startIndex + 1; i < nodes.length; i++) {
    if (nodes[i].depth <= depth) {
      return nodes[i].index;
    }
  }

  return nodes.length;
}

async function analyzeLayout() {
  ensureDir(paths.analyzer.output);

  const domData = readJson(paths.normalize.dom);
  const cssData = readJson(paths.normalize.css);
  const nodes = loadDomNodes(domData);
  const styles = loadCssStyles(cssData);

  const displayCounts = {};
  const flexContainers = [];
  const gridContainers = [];
  const sections = [];

  for (const style of styles) {
    const display = style.style?.display || 'unknown';
    displayCounts[display] = (displayCounts[display] || 0) + 1;

    if (display === 'flex' || display === 'inline-flex') {
      flexContainers.push({
        tag: style.tag,
        id: style.id,
        class: style.class,
        flex: style.style?.flex
      });
    }

    if (display === 'grid' || display === 'inline-grid') {
      gridContainers.push({
        tag: style.tag,
        id: style.id,
        class: style.class
      });
    }
  }

  for (const node of nodes) {
    const tag = node.tag;

    if (
      tag === 'HEADER' ||
      tag === 'MAIN' ||
      tag === 'FOOTER' ||
      tag === 'NAV' ||
      tag === 'SECTION' ||
      tag === 'ASIDE'
    ) {
      sections.push({
        index: node.index,
        endIndex: findSectionEnd(nodes, node.index, node.depth),
        tag,
        id: node.id,
        class: node.class,
        depth: node.depth
      });
    }
  }

  const maxDepth = nodes.reduce(
    (max, node) => Math.max(max, node.depth || 0),
    0
  );

  const result = {
    generatedAt: new Date().toISOString(),
    totalNodes: nodes.length,
    maxDepth,
    displayCounts,
    flexContainers: flexContainers.slice(0, 50),
    flexContainerCount: flexContainers.length,
    gridContainers: gridContainers.slice(0, 50),
    gridContainerCount: gridContainers.length,
    semanticSections: sections,
    layoutModel: flexContainers.length > gridContainers.length
      ? 'flexbox-dominant'
      : gridContainers.length > 0
        ? 'grid-dominant'
        : 'block-dominant'
  };

  writeJson(paths.analyzer.layout, result);

  console.log('Layout analysis OK —', nodes.length, 'nodes, model:', result.layoutModel);
}

module.exports = {
  analyzeLayout
};
