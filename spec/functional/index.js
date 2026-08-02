const fs = require('fs');
const paths = require('../../shared/paths');
const { readJson, writeJson, ensureDir } = require('../../shared/load');

function buildFunctionalSpec(dataset, semantic) {
  const analysis = dataset.analysis;

  const requirements = semantic.features.map(feature => ({
    id: `FR-${feature.name.toUpperCase()}`,
    title: feature.name.replace(/-/g, ' '),
    description: `The page must include ${feature.name} functionality as detected in the original site.`,
    priority: feature.name === 'navigation' || feature.name === 'hero' ? 'high' : 'medium',
    acceptanceCriteria: [
      `User can access ${feature.name} section`,
      `${feature.name} renders correctly on desktop viewport`
    ]
  }));

  return {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    projectName: dataset.source.target || 'Rebuilt Website',
    pageType: semantic.pageType,
    overview: {
      description: `Functional specification for rebuilding ${dataset.source.target || 'the captured website'}.`,
      totalSections: semantic.contentSections.length,
      totalInteractiveElements: analysis.interaction.totalInteractive,
      layoutModel: analysis.layout.layoutModel
    },
    userFlows: semantic.userFlows,
    requirements,
    contentSections: semantic.contentSections
  };
}

function toMarkdown(spec) {
  const lines = [
    '# Functional Specification',
    '',
    `**Project:** ${spec.projectName}`,
    `**Page Type:** ${spec.pageType}`,
    `**Generated:** ${spec.generatedAt}`,
    '',
    '## Overview',
    '',
    spec.overview.description,
    '',
    `- Layout model: ${spec.overview.layoutModel}`,
    `- Interactive elements: ${spec.overview.totalInteractiveElements}`,
    `- Content sections: ${spec.overview.totalSections}`,
    '',
    '## User Flows',
    ''
  ];

  for (const flow of spec.userFlows) {
    lines.push(`### ${flow.name}`);
    flow.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push('');
  }

  lines.push('## Requirements', '');

  for (const req of spec.requirements) {
    lines.push(`### ${req.id}: ${req.title}`);
    lines.push(`**Priority:** ${req.priority}`);
    lines.push('');
    lines.push(req.description);
    lines.push('');
    lines.push('Acceptance criteria:');
    req.acceptanceCriteria.forEach(c => lines.push(`- ${c}`));
    lines.push('');
  }

  return lines.join('\n');
}

async function generateFunctionalSpec() {
  ensureDir(paths.functionalSpec.output);

  const dataset = readJson(paths.collector.dataset);
  const semantic = readJson(paths.aiAnalysis.semantic);

  const spec = buildFunctionalSpec(dataset, semantic);

  writeJson(paths.functionalSpec.spec, spec);
  fs.writeFileSync(paths.functionalSpec.markdown, toMarkdown(spec));

  console.log('Functional spec OK —', spec.requirements.length, 'requirements');
}

module.exports = {
  generateFunctionalSpec
};

if (require.main === module) {
  generateFunctionalSpec().catch(console.error);
}
