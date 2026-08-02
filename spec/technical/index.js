const fs = require('fs');
const paths = require('../../shared/paths');
const { readJson, writeJson, ensureDir } = require('../../shared/load');

function buildTechnicalSpec(dataset, semantic, functionalSpec, tokens) {
  const analysis = dataset.analysis;

  const components = (analysis.components.components || [])
    .reduce((acc, comp) => {
      const type = comp.type;

      if (!acc[type]) {
        acc[type] = [];
      }

      acc[type].push({
        tag: comp.tag,
        id: comp.id,
        class: comp.class
      });

      return acc;
    }, {});

  return {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    stack: {
      framework: semantic.recommendations.framework,
      styling: semantic.recommendations.styling,
      language: 'javascript',
      buildTool: 'vite'
    },
    architecture: {
      pattern: 'component-based',
      layoutModel: analysis.layout.layoutModel,
      componentStrategy: semantic.recommendations.componentStrategy
    },
    designSystem: {
      tokens: {
        colors: tokens.colors.slice(0, 10),
        typography: tokens.typography
      },
      primaryFont: tokens.typography.primaryFont,
      dominantColors: analysis.design.dominantColors
    },
    components,
    dataModel: {
      pages: [{ name: 'home', route: '/' }],
      sections: semantic.contentSections.map(s => s.type)
    },
    apiSurface: {
      endpoints: [],
      note: 'Static rebuild — no backend API required for initial version'
    },
    dependencies: {
      runtime: [],
      dev: ['vite']
    },
    functionalSpecRef: functionalSpec.version
  };
}

function toMarkdown(spec) {
  const lines = [
    '# Technical Specification',
    '',
    `**Generated:** ${spec.generatedAt}`,
    '',
    '## Stack',
    '',
    `- Framework: ${spec.stack.framework}`,
    `- Styling: ${spec.stack.styling}`,
    `- Build tool: ${spec.stack.buildTool}`,
    '',
    '## Architecture',
    '',
    `- Pattern: ${spec.architecture.pattern}`,
    `- Layout model: ${spec.architecture.layoutModel}`,
    `- Component strategy: ${spec.architecture.componentStrategy}`,
    '',
    '## Design System',
    '',
    `Primary font: ${spec.designSystem.primaryFont}`,
    '',
    'Colors:',
    ...spec.designSystem.tokens.colors.map(c => `- ${c.name}: ${c.value}`),
    '',
    '## Components',
    ''
  ];

  for (const [type, items] of Object.entries(spec.components)) {
    lines.push(`### ${type} (${items.length})`);
  }

  lines.push('', '## Data Model', '');
  lines.push('Pages:');
  spec.dataModel.pages.forEach(p => lines.push(`- ${p.name} (${p.route})`));
  lines.push('');
  lines.push('Sections:');
  spec.dataModel.sections.forEach(s => lines.push(`- ${s}`));

  return lines.join('\n');
}

async function generateTechnicalSpec() {
  ensureDir(paths.technicalSpec.output);

  const dataset = readJson(paths.collector.dataset);
  const semantic = readJson(paths.aiAnalysis.semantic);
  const functionalSpec = readJson(paths.functionalSpec.spec);
  const tokens = readJson(paths.styleExtraction.tokens);

  const spec = buildTechnicalSpec(dataset, semantic, functionalSpec, tokens);

  writeJson(paths.technicalSpec.spec, spec);
  fs.writeFileSync(paths.technicalSpec.markdown, toMarkdown(spec));

  console.log('Technical spec OK — stack:', spec.stack.framework);
}

module.exports = {
  generateTechnicalSpec
};

if (require.main === module) {
  generateTechnicalSpec().catch(console.error);
}
