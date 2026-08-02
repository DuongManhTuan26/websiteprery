const fs = require('fs');
const path = require('path');
const paths = require('../shared/paths');
const { readJson, ensureDir } = require('../shared/load');

function escapeHtml(text) {
  if (!text) return '';

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTokensCss(tokens) {
  const lines = [':root {'];

  tokens.colors.forEach(color => {
    lines.push(`  --${color.name}: ${color.value};`);
  });

  if (tokens.typography.primaryFont) {
    lines.push(`  --font-primary: "${tokens.typography.primaryFont}", system-ui, sans-serif;`);
  }

  tokens.typography.fontSizes.slice(0, 6).forEach((size, i) => {
    lines.push(`  --font-size-${i + 1}: ${size.value};`);
  });

  lines.push('}');

  return lines.join('\n');
}

function buildMainCss() {
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-primary, system-ui, sans-serif);
  color: var(--primary, #111);
  background: var(--secondary, #fff);
  line-height: 1.6;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1rem;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0.5rem 1rem;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  margin: 1rem auto;
  max-width: 1400px;
}

.site-nav {
  display: flex;
  gap: 2rem;
  list-style: none;
}

.site-nav a {
  text-decoration: none;
  color: inherit;
  font-weight: 500;
}

.hero {
  padding: 4rem 1rem;
  text-align: center;
}

.hero h1 {
  font-size: clamp(2rem, 5vw, 3.5rem);
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.125rem;
  opacity: 0.8;
  max-width: 600px;
  margin: 0 auto 2rem;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  background: var(--primary, #6366f1);
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.section {
  padding: 4rem 1rem;
}

.section h2 {
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.1);
  background: #fff;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 480px;
  margin: 0 auto;
}

.form-field {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.15);
  font: inherit;
}

.site-footer {
  padding: 2rem 1rem;
  text-align: center;
  opacity: 0.7;
  border-top: 1px solid rgba(0,0,0,0.1);
  margin-top: 4rem;
}
`.trim();
}

function buildHeaderSection(semantic, interaction) {
  const seenText = new Set();
  const navLinks = (interaction.elements || [])
    .filter(el => el.tag === 'A' && el.href && el.text && el.text.length <= 40)
    .filter(el => {
      if (seenText.has(el.text)) return false;
      seenText.add(el.text);
      return true;
    })
    .slice(0, 6);

  const navHtml = navLinks.length > 0
    ? `<nav>
    <ul class="site-nav">
      ${navLinks.map(item => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.text)}</a></li>`).join('\n      ')}
    </ul>
  </nav>`
    : '';

  return `
<header class="site-header container">
  <a href="/" class="logo"><strong>Rebuilt</strong></a>
  ${navHtml}
  <a href="#cta" class="btn">Get Started</a>
</header>`.trim();
}

function buildHeroSection(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 30).join(' ');

  if (!words) {
    return '';
  }

  const title = words.length > 80 ? words.slice(0, 80) + '...' : words;

  return `
<section class="hero" id="hero">
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    <p>Rebuilt from captured website data using the capture-rebuild pipeline.</p>
    <a href="#cta" class="btn">Learn More</a>
  </div>
</section>`.trim();
}

const SECTION_HEADINGS = {
  navigation: 'Navigation',
  pricing: 'Pricing',
  cta: 'Get Started',
  testimonial: 'Testimonials'
};

function buildBodySections(semantic) {
  const sections = (semantic.contentSections || [])
    .filter(s => s.type !== 'header' && s.type !== 'footer' && s.type !== 'hero')
    .filter(s => s.text);

  let genericCount = 0;

  return sections.map((s, i) => {
    let heading;

    if (SECTION_HEADINGS[s.type]) {
      heading = SECTION_HEADINGS[s.type];
    } else if (s.type === 'section') {
      genericCount++;
      heading = `Section ${genericCount}`;
    } else {
      heading = s.type.charAt(0).toUpperCase() + s.type.slice(1);
    }

    return `
<section class="section" id="${s.type}-${i}">
  <div class="container">
    <h2>${escapeHtml(heading)}</h2>
    <p>${escapeHtml(s.text)}</p>
  </div>
</section>`.trim();
  });
}

function buildFormSection(interaction) {
  const fields = (interaction.elements || [])
    .filter(el => el.tag === 'INPUT' || el.tag === 'TEXTAREA')
    .filter(el => !['hidden', 'submit', 'button'].includes(el.type))
    .slice(0, 8);

  if (!interaction.forms || interaction.forms === 0 || fields.length === 0) {
    return '';
  }

  const inputsHtml = fields.map(el => {
    const label = escapeHtml(el.ariaLabel || el.name || el.type || 'field');

    if (el.tag === 'TEXTAREA') {
      return `<textarea class="form-field" name="${escapeHtml(el.name || '')}" placeholder="${label}"></textarea>`;
    }

    return `<input class="form-field" type="${escapeHtml(el.type || 'text')}" name="${escapeHtml(el.name || '')}" placeholder="${label}">`;
  }).join('\n      ');

  return `
<section class="section" id="contact">
  <div class="container">
    <h2>Contact</h2>
    <form class="contact-form">
      ${inputsHtml}
      <button type="submit" class="btn">Submit</button>
    </form>
  </div>
</section>`.trim();
}

function buildFooterSection() {
  return `
<footer class="site-footer">
  <div class="container">
    <p>Generated by capture-rebuild pipeline</p>
  </div>
</footer>`.trim();
}

function buildIndexHtml(sections) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rebuilt Site</title>
  <link rel="stylesheet" href="/styles/tokens.css">
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
${sections.join('\n\n')}
</body>
</html>`;
}

function buildPackageJson() {
  return {
    name: 'rebuilt-site',
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview'
    },
    devDependencies: {
      vite: '^5.4.0'
    }
  };
}

function buildViteConfig() {
  return `import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist'
  }
});
`;
}

async function generateCode() {
  const outputDir = paths.generator.output;
  ensureDir(outputDir);
  ensureDir(path.join(outputDir, 'styles'));
  ensureDir(path.join(outputDir, 'public'));

  const dataset = readJson(paths.collector.dataset);
  const semantic = readJson(paths.aiAnalysis.semantic);
  const tokens = readJson(paths.styleExtraction.tokens);
  const text = dataset.normalize.text?.text || '';
  const interaction = dataset.analysis?.interaction || { elements: [], forms: 0 };

  const sections = [
    buildHeaderSection(semantic, interaction),
    buildHeroSection(text),
    ...buildBodySections(semantic),
    buildFormSection(interaction),
    buildFooterSection()
  ].filter(Boolean);

  fs.writeFileSync(path.join(outputDir, 'index.html'), buildIndexHtml(sections));
  fs.writeFileSync(path.join(outputDir, 'styles', 'tokens.css'), buildTokensCss(tokens));
  fs.writeFileSync(path.join(outputDir, 'styles', 'main.css'), buildMainCss());
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(buildPackageJson(), null, 2));
  fs.writeFileSync(path.join(outputDir, 'vite.config.js'), buildViteConfig());

  console.log('Code generator OK — output at', outputDir);
}

module.exports = {
  generateCode
};

if (require.main === module) {
  generateCode().catch(console.error);
}
