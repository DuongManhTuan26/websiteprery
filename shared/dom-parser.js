const cheerio = require('cheerio');

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'SVG',
  'PATH'
]);

function parseHtmlToNodes(html) {
  const $ = cheerio.load(html, { xmlMode: false });
  const nodes = [];
  const tagCounts = {};

  function walk(element, depth) {
    if (!element || element.type !== 'tag') {
      return;
    }

    const tag = (element.tagName || element.name || '').toUpperCase();

    if (!tag || SKIP_TAGS.has(tag)) {
      return;
    }

    const attribs = element.attribs || {};
    const id = attribs.id || null;
    const className = attribs.class || null;

    tagCounts[tag] = (tagCounts[tag] || 0) + 1;

    const directText = (element.children || [])
      .filter(child => child.type === 'text')
      .map(child => (child.data || '').trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 200) || null;

    nodes.push({
      index: nodes.length,
      tag,
      id,
      class: className,
      depth,
      text: directText,
      role: attribs.role || null,
      href: attribs.href || null,
      src: attribs.src || null,
      type: attribs.type || null,
      name: attribs.name || null,
      ariaLabel: attribs['aria-label'] || null,
      alt: attribs.alt || null,
      content: attribs.content || null,
      rel: attribs.rel || null
    });

    for (const child of element.children || []) {
      if (child.type === 'tag') {
        walk(child, depth + 1);
      }
    }
  }

  const root = $('html')[0] || $('body')[0] || $.root()[0];

  if (root) {
    walk(root, 0);
  }

  return {
    nodes,
    statistics: {
      totalNodes: nodes.length,
      tags: tagCounts
    }
  };
}

module.exports = {
  parseHtmlToNodes
};
