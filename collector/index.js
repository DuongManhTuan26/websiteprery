const fs = require('fs');
const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir } = require('../shared/load');

function loadOptional(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return readJson(filePath);
}

async function collect() {
  ensureDir(paths.collector.output);

  const dataset = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    source: {
      captureReport: loadOptional(paths.capture.report),
      target: loadOptional(paths.capture.report)?.target || null
    },
    normalize: {
      dom: loadOptional(paths.normalize.dom),
      css: loadOptional(paths.normalize.css),
      text: loadOptional(paths.normalize.text),
      assets: loadOptional(paths.normalize.assets)
    },
    analysis: loadOptional(paths.analyzer.analysis),
    tokens: loadOptional(paths.styleExtraction.tokens)
  };

  dataset.summary = {
    totalNodes: dataset.normalize.dom?.statistics?.totalNodes || 0,
    totalStyles: dataset.normalize.css?.totalElements || 0,
    layoutModel: dataset.analysis?.layout?.layoutModel || null,
    componentCount: dataset.analysis?.components?.totalComponents || 0,
    interactiveCount: dataset.analysis?.interaction?.totalInteractive || 0,
    primaryFont: dataset.analysis?.design?.primaryFont || null,
    dominantColors: dataset.analysis?.design?.dominantColors || []
  };

  writeJson(paths.collector.dataset, dataset);

  console.log('Collector OK — dataset assembled');
}

module.exports = {
  collect
};

if (require.main === module) {
  collect().catch(console.error);
}
