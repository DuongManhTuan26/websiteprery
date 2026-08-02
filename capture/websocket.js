const fs = require('fs');
const path = require('path');
const config = require('./config');

function attachWebSocketLogger(page) {
  const frames = [];

  page.on('websocket', ws => {
    ws.on('framesent', payload => {
      frames.push({
        direction: 'sent',
        time: new Date().toISOString(),
        payload
      });
    });

    ws.on('framereceived', payload => {
      frames.push({
        direction: 'received',
        time: new Date().toISOString(),
        payload
      });
    });
  });

  page._wsFrames = frames;
}

function flushWebSocketFrames(page) {
  const frames = page._wsFrames || [];

  fs.mkdirSync(path.dirname(config.output.websocket), { recursive: true });

  fs.writeFileSync(
    config.output.websocket,
    JSON.stringify(frames, null, 2)
  );
}

module.exports = {
  attachWebSocketLogger,
  flushWebSocketFrames
};