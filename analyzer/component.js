const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir, loadDomNodes } = require('../shared/load');

const SEMANTIC_TAGS = {
  HEADER: 'header',
  NAV: 'navigation',
  MAIN: 'main',
  FOOTER: 'footer',
  SECTION: 'section',
  ASIDE: 'sidebar',
  FORM: 'form',
  BUTTON: 'button',
  A: 'link',
  INPUT: 'input',
  IMG: 'image'
};

function detectComponentType(node) {
  const tag = node.tag;
  const cls = (node.class || '').toLowerCase();

  if (cls.includes('header') || cls.includes('navbar')) return 'header';
  if (cls.includes('footer')) return 'footer';
  if (cls.includes('hero') || cls.includes('banner')) return 'hero';
  if (cls.includes('card')) return 'card';
  if (cls.includes('modal') || cls.includes('dialog')) return 'modal';
  if (cls.includes('sidebar') || cls.includes('aside')) return 'sidebar';
  if (cls.includes('pricing')) return 'pricing';
  if (cls.includes('testimonial')) return 'testimonial';
  if (cls.includes('cta')) return 'cta';

  if (SEMANTIC_TAGS[tag]) {
    return SEMANTIC_TAGS[tag];
  }

  return 'element';
}

async function analyzeComponents() {
  ensureDir(paths.analyzer.output);

  const domData = readJson(paths.normalize.dom);
  const nodes = loadDomNodes(domData);

  const tagStatistics = {};
  const componentTypes = {};
  const components = [];

  for (const node of nodes) {
    const tag = node.tag || 'UNKNOWN';
    tagStatistics[tag] = (tagStatistics[tag] || 0) + 1;

    const type = detectComponentType(node);
    componentTypes[type] = (componentTypes[type] || 0) + 1;

    if (
      type !== 'element' ||
      tag === 'HEADER' ||
      tag === 'FOOTER' ||
      tag === 'NAV' ||
      tag === 'MAIN' ||
      tag === 'FORM'
    ) {
      components.push({
        index: node.index,
        type,
        tag,
        id: node.id,
        class: node.class,
        depth: node.depth,
        text: node.text,
        src: node.src,
        alt: node.alt
      });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    totalNodes: nodes.length,
    totalComponents: components.length,
    tagStatistics,
    componentTypes,
    components: components.slice(0, 200)
  };

  writeJson(paths.analyzer.components, result);

  console.log('Component analysis OK —', components.length, 'components detected');
}

module.exports = {
  analyzeComponents
};
