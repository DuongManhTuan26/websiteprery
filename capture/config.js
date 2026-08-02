const path = require('path');

module.exports = {
  target: process.env.CAPTURE_TARGET || 'https://preny.ai',

  output: {
    har: path.join(
      'capture',
      'raw',
      'har',
      'preny.har'
    ),

    html: path.join(
      'capture',
      'raw',
      'html',
      'index.html'
    ),

    dom: path.join(
      'capture',
      'raw',
      'dom',
      'dom.html'
    ),

    screenshot: path.join(
      'capture',
      'raw',
      'screenshots',
      'home.png'
    ),

    cookies: path.join(
      'capture',
      'raw',
      'cookies',
      'cookies.json'
    ),

    localStorage: path.join(
      'capture',
      'raw',
      'storage',
      'localStorage.json'
    ),

    sessionStorage: path.join(
      'capture',
      'raw',
      'storage',
      'sessionStorage.json'
    ),

    indexedDB: path.join(
      'capture',
      'raw',
      'storage',
      'indexedDB.json'
    ),

    websocket: path.join(
      'capture',
      'raw',
      'websocket',
      'frames.json'
    ),

    styles: path.join(
      'capture',
      'raw',
      'style',
      'styles.json'
    )
  },

  browser: {
    channel: 'chrome',
    headless: process.env.CAPTURE_HEADLESS === 'true'
  },

  viewport: {
    width: 1440,
    height: 900
  }
};