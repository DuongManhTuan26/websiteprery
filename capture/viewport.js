const config = require('./config');

const viewports = {
  desktop: {
    width: 1440,
    height: 900
  },

  tablet: {
    width: 820,
    height: 1180
  },

  mobile: {
    width: 390,
    height: 844
  }
};

function getViewport(name = 'desktop') {
  return viewports[name] || config.viewport;
}

function getViewportNames() {
  return Object.keys(viewports);
}

module.exports = {
  getViewport,
  getViewportNames
};