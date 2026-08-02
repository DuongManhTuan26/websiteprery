const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cheerio = require('cheerio');
const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir } = require('../shared/load');

const CAPTURE_STALE_THRESHOLD_HOURS = 24;

const REQUIRED_OUTPUTS = [
  { path: paths.capture.report, stage: 'capture' },
  { path: paths.normalize.dom, stage: 'normalize' },
  { path: paths.normalize.css, stage: 'normalize' },
  { path: paths.normalize.text, stage: 'normalize' },
  { path: paths.normalize.assets, stage: 'normalize' },
  { path: paths.analyzer.analysis, stage: 'analyzer' },
  { path: paths.styleExtraction.tokens, stage: 'style-extraction' },
  { path: paths.collector.dataset, stage: 'collector' },
  { path: paths.aiAnalysis.semantic, stage: 'ai-analysis' },
  { path: paths.functionalSpec.spec, stage: 'functional-spec' },
  { path: paths.technicalSpec.spec, stage: 'technical-spec' },
  { path: path.join(paths.generator.output, 'index.html'), stage: 'generator' },
  { path: path.join(paths.generator.output, 'package.json'), stage: 'generator' }
];

function checkPlaceholders(obj, pathKey = '') {
  const issues = [];

  if (obj && typeof obj === 'object') {
    if (obj.status === 'placeholder') {
      issues.push(`Placeholder found at ${pathKey || 'root'}`);
    }

    for (const [key, value] of Object.entries(obj)) {
      issues.push(...checkPlaceholders(value, pathKey ? `${pathKey}.${key}` : key));
    }
  }

  return issues;
}

function validateOutputs() {
  const checks = [];

  for (const item of REQUIRED_OUTPUTS) {
    checks.push({
      path: item.path,
      stage: item.stage,
      exists: fs.existsSync(item.path),
      passed: fs.existsSync(item.path)
    });
  }

  return checks;
}

function validateAnalysis() {
  const analysis = readJson(paths.analyzer.analysis);
  const issues = [];

  if (!analysis.components) {
    issues.push('analysis.json missing components section');
  }

  if (analysis.layout?.totalNodes === 0) {
    issues.push('layout analysis has zero nodes');
  }

  issues.push(...checkPlaceholders(analysis));

  return issues;
}

function getCaptureStatus() {
  if (!fs.existsSync(paths.capture.report)) {
    return {
      available: false,
      stale: true,
      warning: 'capture/report.json không tồn tại — stage capture chưa từng chạy thành công trên máy này.'
    };
  }

  const report = readJson(paths.capture.report);
  const finishedAt = report.finishedAt ? new Date(report.finishedAt) : null;
  const ageHours = finishedAt && !Number.isNaN(finishedAt.getTime())
    ? (Date.now() - finishedAt.getTime()) / 3600000
    : null;
  const stale = ageHours === null || ageHours > CAPTURE_STALE_THRESHOLD_HOURS;
  const missingFiles = Object.entries(report.files || {})
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  return {
    available: true,
    target: report.target || null,
    finishedAt: report.finishedAt || null,
    ageHours: ageHours !== null ? Number(ageHours.toFixed(1)) : null,
    stale,
    missingFiles,
    warning: stale
      ? `Dữ liệu capture đã ${ageHours !== null ? ageHours.toFixed(1) + ' giờ' : 'không xác định tuổi'} — vượt ngưỡng ${CAPTURE_STALE_THRESHOLD_HOURS}h. Các stage sau có thể đang chạy trên dữ liệu capture cũ (vd. dùng --skip-capture) chứ không phải một lần capture mới thành công.`
      : null
  };
}

function validateRebuildBuild() {
  const rebuildDir = paths.generator.output;

  if (!fs.existsSync(path.join(rebuildDir, 'package.json'))) {
    return { passed: false, error: 'rebuild package.json missing' };
  }

  try {
    execSync('npm install', { cwd: rebuildDir, stdio: 'pipe' });
    execSync('npm run build', { cwd: rebuildDir, stdio: 'pipe' });

    const distExists = fs.existsSync(path.join(rebuildDir, 'dist', 'index.html'));

    return {
      passed: distExists,
      distExists
    };
  } catch (error) {
    return {
      passed: false,
      error: error.message
    };
  }
}

// Enforces the "no dependency on the original site" requirement: nothing in
// the generated rebuild may fetch CSS/JS/fonts/images/icons/favicon from the
// captured origin at build or runtime. `<link rel=canonical/alternate>` and
// og:*/twitter:* meta `content` values are metadata read by crawlers/social
// previews, never fetched by a browser rendering the page, so they're the
// only allowed references to the original host — everything else (src/href/
// action/srcset/inline style url(), plus the text of every localized CSS
// file) must be free of it.
function validateNoOriginDependency() {
  const indexPath = path.join(paths.generator.output, 'index.html');

  if (!fs.existsSync(paths.capture.report) || !fs.existsSync(indexPath)) {
    return { checked: false, host: null, issues: [] };
  }

  const report = readJson(paths.capture.report);
  let host;

  try {
    host = new URL(report.target).host;
  } catch {
    return { checked: false, host: null, issues: [] };
  }

  const issues = [];
  const html = fs.readFileSync(indexPath, 'utf8');
  const $ = cheerio.load(html);

  const allowedEls = new Set($('link[rel="canonical"], link[rel="alternate"], meta[property^="og:"], meta[name^="twitter:"]').toArray());

  $('*').each((_, el) => {
    if (allowedEls.has(el)) return;

    const attribs = el.attribs || {};
    for (const attr of ['src', 'href', 'action', 'srcset', 'style']) {
      const value = attribs[attr];
      if (!value || !value.includes(host)) continue;
      if (/^(mailto|tel):/i.test(value)) continue; // contact info, not a fetch

      issues.push(`<${el.tagName}> ${attr}="${value.slice(0, 140)}"`);
    }
  });

  const assetsDir = path.join(paths.generator.output, 'public', 'assets');

  if (fs.existsSync(assetsDir)) {
    for (const file of fs.readdirSync(assetsDir)) {
      if (!file.endsWith('.css') && !file.endsWith('.js')) continue;

      const text = fs.readFileSync(path.join(assetsDir, file), 'utf8');
      if (text.includes(host)) {
        issues.push(`public/assets/${file} still contains a reference to ${host}`);
      }
    }
  }

  return { checked: true, host, issues };
}

function getAssetManifestSummary() {
  const manifestPath = path.join(paths.generator.output, 'public', 'assets', 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const manifest = readJson(manifestPath);

  return {
    referencedTotal: manifest.referencedTotal,
    localized: manifest.localized,
    notCaptured: manifest.notCaptured
  };
}

function toMarkdown(report) {
  const lines = [
    '# QA Report',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Overall:** ${report.passed ? 'PASSED' : 'FAILED'}`,
    '',
    '## Output Validation',
    ''
  ];

  for (const check of report.outputChecks) {
    lines.push(`- [${check.passed ? 'x' : ' '}] ${check.stage}: ${check.path}`);
  }

  lines.push('', '## Analysis Validation', '');

  if (report.analysisIssues.length === 0) {
    lines.push('No issues found.');
  } else {
    report.analysisIssues.forEach(issue => lines.push(`- ${issue}`));
  }

  lines.push('', '## Rebuild Build', '');
  lines.push(`Build: ${report.rebuildBuild.passed ? 'PASSED' : 'FAILED'}`);

  if (report.rebuildBuild.error) {
    lines.push(`Error: ${report.rebuildBuild.error}`);
  }

  lines.push('', '## Origin Independence', '');

  if (!report.originDependency.checked) {
    lines.push('Not checked (capture report or generated index.html missing).');
  } else if (report.originDependency.issues.length === 0) {
    lines.push(`No references to the original host (${report.originDependency.host}) found outside metadata.`);
  } else {
    lines.push(`⚠️ References to ${report.originDependency.host} found:`);
    report.originDependency.issues.forEach(issue => lines.push(`- ${issue}`));
  }

  if (report.assetManifest) {
    lines.push('', `Localized assets: ${report.assetManifest.localized}/${report.assetManifest.referencedTotal} referenced (${report.assetManifest.notCaptured} not present in the capture HAR — see manifest.json).`);
  }

  lines.push('', '## Capture Status', '');

  if (!report.captureStatus.available) {
    lines.push(`⚠️ ${report.captureStatus.warning}`);
  } else {
    lines.push(`Target: ${report.captureStatus.target}`);
    lines.push(`Finished at: ${report.captureStatus.finishedAt}`);
    lines.push(`Age: ${report.captureStatus.ageHours} hours`);

    if (report.captureStatus.warning) {
      lines.push(`⚠️ ${report.captureStatus.warning}`);
    } else {
      lines.push('Capture data is fresh.');
    }

    if (report.captureStatus.missingFiles.length > 0) {
      lines.push(`⚠️ Missing capture artifacts: ${report.captureStatus.missingFiles.join(', ')}`);
    }
  }

  return lines.join('\n');
}

async function runQA() {
  ensureDir(paths.qa.output);

  const outputChecks = validateOutputs();
  const analysisIssues = validateAnalysis();
  const rebuildBuild = validateRebuildBuild();
  const captureStatus = getCaptureStatus();
  const originDependency = validateNoOriginDependency();
  const assetManifest = getAssetManifestSummary();

  const allOutputsExist = outputChecks.every(c => c.passed);
  const noPlaceholders = analysisIssues.length === 0;
  const noOriginDependency = !originDependency.checked || originDependency.issues.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    passed: allOutputsExist && noPlaceholders && rebuildBuild.passed && noOriginDependency,
    outputChecks,
    analysisIssues,
    rebuildBuild,
    originDependency,
    assetManifest,
    captureStatus,
    summary: {
      totalChecks: outputChecks.length,
      passedChecks: outputChecks.filter(c => c.passed).length,
      analysisIssues: analysisIssues.length,
      rebuildBuildPassed: rebuildBuild.passed,
      originDependencyIssues: originDependency.issues.length,
      captureStale: captureStatus.stale
    }
  };

  if (captureStatus.stale) {
    console.warn('QA WARNING —', captureStatus.warning);
  }

  writeJson(paths.qa.report, report);
  fs.writeFileSync(paths.qa.markdown, toMarkdown(report));

  console.log('QA', report.passed ? 'PASSED' : 'FAILED');

  if (!report.passed) {
    process.exitCode = 1;
  }
}

module.exports = {
  runQA
};

if (require.main === module) {
  runQA().catch(console.error);
}
