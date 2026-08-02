const { analyzeLayout } = require('./layout');
const { analyzeComponents } = require('./component');
const { analyzeDesign } = require('./design');
const { analyzeInteractions } = require('./interaction');
const { analyzeVision } = require('./vision');
const { mergeResults } = require('./merge');

async function runAnalyze() {
  console.log('1. Layout');
  await analyzeLayout();

  console.log('2. Components');
  await analyzeComponents();

  console.log('3. Design');
  await analyzeDesign();

  console.log('4. Interactions');
  await analyzeInteractions();

  console.log('5. Vision');
  await analyzeVision();

  console.log('6. Merge');
  await mergeResults();

  console.log('Analyzer completed.');
}

module.exports = {
  runAnalyze
};

if (require.main === module) {
  runAnalyze().catch(console.error);
}
