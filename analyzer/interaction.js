const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir, loadDomNodes } = require('../shared/load');

const INTERACTIVE_TAGS = new Set([
  'A',
  'BUTTON',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'FORM',
  'DETAILS',
  'SUMMARY'
]);

async function analyzeInteractions() {
  ensureDir(paths.analyzer.output);

  const domData = readJson(paths.normalize.dom);
  const nodes = loadDomNodes(domData);

  let clickable = 0;
  let forms = 0;
  let inputs = 0;
  const elements = [];

  for (const node of nodes) {
    const tag = (node.tag || '').toUpperCase();

    if (tag === 'A' || tag === 'BUTTON') {
      clickable++;
    }

    if (tag === 'FORM') {
      forms++;
    }

    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      inputs++;
    }

    if (INTERACTIVE_TAGS.has(tag)) {
      elements.push({
        index: node.index,
        tag,
        id: node.id,
        class: node.class,
        type: node.type,
        name: node.name,
        href: node.href,
        ariaLabel: node.ariaLabel,
        text: node.text
      });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    clickable,
    forms,
    inputs,
    totalInteractive: elements.length,
    elements: elements.slice(0, 100)
  };

  writeJson(paths.analyzer.interaction, result);

  console.log('Interaction analysis OK —', elements.length, 'interactive elements');
}

module.exports = {
  analyzeInteractions
};
