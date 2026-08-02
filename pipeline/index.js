const { execSync } = require('child_process');
const path = require('path');

const STAGES = [
  { name: 'capture', script: 'capture/index.js', skipEnv: 'SKIP_CAPTURE' },
  { name: 'normalize', script: 'normalize/index.js', fn: 'runNormalize' },
  { name: 'analyze', script: 'analyzer/index.js', fn: 'runAnalyze' },
  { name: 'style-extraction', script: 'style-extraction/index.js', fn: 'extractStyles' },
  { name: 'collector', script: 'collector/index.js', fn: 'collect' },
  { name: 'ai-analysis', script: 'ai-analysis/index.js', fn: 'analyzeSemantic' },
  { name: 'functional-spec', script: 'spec/functional/index.js', fn: 'generateFunctionalSpec' },
  { name: 'technical-spec', script: 'spec/technical/index.js', fn: 'generateTechnicalSpec' },
  { name: 'generator', script: 'generator/index.js', fn: 'generateCode' },
  { name: 'qa', script: 'qa/index.js', fn: 'runQA' }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    from: null,
    only: null,
    skipCapture: process.env.SKIP_CAPTURE === 'true'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      options.from = args[++i];
    }

    if (args[i] === '--only' && args[i + 1]) {
      options.only = args[++i];
    }

    if (args[i] === '--skip-capture') {
      options.skipCapture = true;
    }
  }

  return options;
}

async function runStage(stage) {
  console.log(`\n========== ${stage.name.toUpperCase()} ==========\n`);

  if (stage.name === 'capture') {
    if (process.env.SKIP_CAPTURE === 'true') {
      console.log('Skipping capture (SKIP_CAPTURE=true)');
      return;
    }

    execSync('node capture/index.js', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    return;
  }

  const scriptPath = path.join(__dirname, '..', stage.script);
  const mod = require(scriptPath);
  const fn = mod[stage.fn];

  if (!fn) {
    throw new Error(`Stage ${stage.name} missing export: ${stage.fn}`);
  }

  await fn();
}

async function runPipeline() {
  const options = parseArgs();
  let stages = STAGES;

  if (options.only) {
    stages = STAGES.filter(s => s.name === options.only);
  } else if (options.from) {
    const fromIndex = STAGES.findIndex(s => s.name === options.from);

    if (fromIndex >= 0) {
      stages = STAGES.slice(fromIndex);
    }
  }

  if (options.skipCapture) {
    process.env.SKIP_CAPTURE = 'true';
  }

  console.log('Pipeline starting — stages:', stages.map(s => s.name).join(' → '));

  const startTime = Date.now();

  for (const stage of stages) {
    await runStage(stage);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n========== PIPELINE COMPLETE (${duration}s) ==========\n`);
}

runPipeline().catch(error => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});
