const config = require('./config');

function getHarOptions() {
  return {
    recordHar: {
      path: config.output.har,
      mode: 'full'
    }
  };
}

module.exports = {
  getHarOptions
};