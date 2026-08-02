const fs = require('fs');
const path = require('path');
const config = require('./config');

function generateReport(startTime, endTime) {
  const report = {
    target: config.target,
    startedAt: startTime,
    finishedAt: endTime,
    durationMs: new Date(endTime) - new Date(startTime),

    files: {
      har: fs.existsSync(path.join('capture/raw/har/preny.har')),
      html: fs.existsSync(path.join('capture/raw/html/index.html')),
      dom: fs.existsSync(path.join('capture/raw/dom/dom.html')),
      screenshot: fs.existsSync(path.join('capture/raw/screenshots/home.png')),
      cookies: fs.existsSync(path.join('capture/raw/cookies/cookies.json')),
      localStorage: fs.existsSync(path.join('capture/raw/storage/localStorage.json')),
      sessionStorage: fs.existsSync(path.join('capture/raw/storage/sessionStorage.json')),
      indexedDB: fs.existsSync(path.join('capture/raw/storage/indexedDB.json')),
      websocket: fs.existsSync(path.join('capture/raw/websocket/frames.json')),
      styles: fs.existsSync(path.join('capture/raw/style/styles.json'))
    }
  };

  fs.writeFileSync(
    path.join('capture', 'report.json'),
    JSON.stringify(report, null, 2)
  );
}

module.exports = {
  generateReport
};