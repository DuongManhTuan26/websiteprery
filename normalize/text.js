const fs = require('fs');
const path = require('path');

async function normalizeText() {

  const input = path.join(
    'capture',
    'raw',
    'dom',
    'dom.html'
  );

  const outputDir = path.join(
    'normalize',
    'output'
  );

  const output = path.join(
    outputDir,
    'text.json'
  );

  fs.mkdirSync(outputDir, {
    recursive: true
  });

  const html = fs.readFileSync(
    input,
    'utf8'
  );

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const result = {
    length: text.length,
    text
  };

  fs.writeFileSync(
    output,
    JSON.stringify(result, null, 2)
  );

}

module.exports = {
  normalizeText
};