const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const paths = {
  root: ROOT,

  capture: {
    raw: path.join(ROOT, 'capture', 'raw'),
    html: path.join(ROOT, 'capture', 'raw', 'html', 'index.html'),
    dom: path.join(ROOT, 'capture', 'raw', 'dom', 'dom.html'),
    styles: path.join(ROOT, 'capture', 'raw', 'style', 'styles.json'),
    screenshot: path.join(ROOT, 'capture', 'raw', 'screenshots', 'home.png'),
    har: path.join(ROOT, 'capture', 'raw', 'har', 'preny.har'),
    cookies: path.join(ROOT, 'capture', 'raw', 'cookies', 'cookies.json'),
    localStorage: path.join(ROOT, 'capture', 'raw', 'storage', 'localStorage.json'),
    sessionStorage: path.join(ROOT, 'capture', 'raw', 'storage', 'sessionStorage.json'),
    indexedDB: path.join(ROOT, 'capture', 'raw', 'storage', 'indexedDB.json'),
    websocket: path.join(ROOT, 'capture', 'raw', 'websocket', 'frames.json'),
    report: path.join(ROOT, 'capture', 'report.json')
  },

  normalize: {
    output: path.join(ROOT, 'normalize', 'output'),
    dom: path.join(ROOT, 'normalize', 'output', 'dom.json'),
    css: path.join(ROOT, 'normalize', 'output', 'css.json'),
    text: path.join(ROOT, 'normalize', 'output', 'text.json'),
    assets: path.join(ROOT, 'normalize', 'output', 'assets.json')
  },

  analyzer: {
    output: path.join(ROOT, 'analyzer', 'output'),
    layout: path.join(ROOT, 'analyzer', 'output', 'layout.json'),
    components: path.join(ROOT, 'analyzer', 'output', 'components.json'),
    design: path.join(ROOT, 'analyzer', 'output', 'design.json'),
    interaction: path.join(ROOT, 'analyzer', 'output', 'interaction.json'),
    vision: path.join(ROOT, 'analyzer', 'output', 'vision.json'),
    analysis: path.join(ROOT, 'analyzer', 'output', 'analysis.json')
  },

  styleExtraction: {
    output: path.join(ROOT, 'style-extraction', 'output'),
    tokens: path.join(ROOT, 'style-extraction', 'output', 'tokens.json')
  },

  collector: {
    output: path.join(ROOT, 'collector', 'output'),
    dataset: path.join(ROOT, 'collector', 'output', 'dataset.json')
  },

  aiAnalysis: {
    output: path.join(ROOT, 'ai-analysis', 'output'),
    semantic: path.join(ROOT, 'ai-analysis', 'output', 'semantic.json')
  },

  functionalSpec: {
    output: path.join(ROOT, 'spec', 'functional', 'output'),
    spec: path.join(ROOT, 'spec', 'functional', 'output', 'spec.json'),
    markdown: path.join(ROOT, 'spec', 'functional', 'output', 'spec.md')
  },

  technicalSpec: {
    output: path.join(ROOT, 'spec', 'technical', 'output'),
    spec: path.join(ROOT, 'spec', 'technical', 'output', 'spec.json'),
    markdown: path.join(ROOT, 'spec', 'technical', 'output', 'spec.md')
  },

  generator: {
    output: path.join(ROOT, 'rebuild', 'output')
  },

  qa: {
    output: path.join(ROOT, 'qa', 'output'),
    report: path.join(ROOT, 'qa', 'output', 'report.json'),
    markdown: path.join(ROOT, 'qa', 'output', 'report.md')
  }
};

module.exports = paths;
