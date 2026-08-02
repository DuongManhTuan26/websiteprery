const paths = require('../shared/paths');
const { readJson, writeJson } = require('../shared/load');

async function mergeResults() {
  const files = [
    { file: 'layout.json', key: 'layout' },
    { file: 'components.json', key: 'components' },
    { file: 'design.json', key: 'design' },
    { file: 'interaction.json', key: 'interaction' },
    { file: 'vision.json', key: 'vision' }
  ];

  const result = {
    generatedAt: new Date().toISOString(),
    version: '1.0.0'
  };

  for (const { file, key } of files) {
    const filePath = require('path').join(paths.analyzer.output, file);
    result[key] = readJson(filePath);
  }

  writeJson(paths.analyzer.analysis, result);

  console.log('Merge analysis OK');
}

module.exports = {
  mergeResults
};
