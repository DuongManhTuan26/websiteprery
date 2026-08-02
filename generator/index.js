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

function resolveUrl(src, baseUrl) {
  if (!src) return null;

  try {
    return new URL(src, baseUrl || undefined).href;
  } catch {
    return null;
  }
}

function buildImageHtml(image, baseUrl, className) {
  const resolvedSrc = resolveUrl(image?.src, baseUrl);

  if (!resolvedSrc) {
    return '';
  }

  return `<img src="${escapeHtml(resolvedSrc)}" alt="${escapeHtml(image.alt || '')}" class="${className}" loading="lazy">`;
}

function buildTokensCss(tokens) {
  const lines = [':root {'];

  tokens.colors.forEach(color => {
    lines.push(`  --${color.name}: ${color.value};`);
  });

  if (tokens.accentColor) {
    lines.push(`  --accent: ${tokens.accentColor};`);
  }

  if (tokens.textColor) {
    lines.push(`  --text-primary: ${tokens.textColor};`);
  }

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
  color: var(--text-primary, #111);
  background: var(--primary, #fff);
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

.hero-image {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 2rem auto 0;
  display: block;
}

.logo-image {
  max-height: 40px;
  width: auto;
  display: block;
}

.section-image {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin-top: 1.5rem;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  background: var(--accent, #6366f1);
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

function buildHeaderSection(semantic, interaction, ctaHref, baseUrl) {
  const logo = semantic.branding?.logo;
  const logoHtml = logo
    ? buildImageHtml(logo, baseUrl, 'logo-image')
    : '<strong>Rebuilt</strong>';

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

  const ctaHtml = ctaHref ? `<a href="${ctaHref}" class="btn">Get Started</a>` : '';

  return `
<header class="site-header container">
  <a href="/" class="logo">${logoHtml}</a>
  ${navHtml}
  ${ctaHtml}
</header>`.trim();
}

function buildHeroSection(section, baseUrl, ctaHref) {
  if (!section || !section.text) {
    return '';
  }

  const imageHtml = buildImageHtml(section.image, baseUrl, 'hero-image');
  const ctaHtml = ctaHref ? `<a href="${ctaHref}" class="btn">Learn More</a>` : '';

  return `
<section class="hero" id="hero">
  <div class="container">
    <h1>${escapeHtml(section.text)}</h1>
    ${ctaHtml}
    ${imageHtml}
  </div>
</section>`.trim();
}

const SECTION_HEADINGS = {
  navigation: 'Navigation',
  pricing: 'Pricing',
  cta: 'Get Started',
  testimonial: 'Testimonials'
};

function buildBodySections(bodySections, baseUrl) {
  const sections = bodySections
    .filter(s => s.type !== 'header' && s.type !== 'footer')
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

    const imageHtml = buildImageHtml(s.image, baseUrl, 'section-image');

    return `
<section class="section" id="${s.type}-${i}">
  <div class="container">
    <h2>${escapeHtml(heading)}</h2>
    <p>${escapeHtml(s.text)}</p>
    ${imageHtml}
  </div>
</section>`.trim();
  });
}

function getFormFields(interaction) {
  return (interaction.elements || [])
    .filter(el => el.tag === 'INPUT' || el.tag === 'TEXTAREA')
    .filter(el => !['hidden', 'submit', 'button'].includes(el.type))
    .slice(0, 8);
}

function buildFormSection(interaction, fields) {
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

function buildIndexHtml(sections, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || 'Rebuilt Site')}</title>
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
  const interaction = dataset.analysis?.interaction || { elements: [], forms: 0 };
  const baseUrl = dataset.source?.target || null;

  const contentSections = semantic.contentSections || [];
  const [heroSection, ...restSections] = contentSections;
  const fields = getFormFields(interaction);
  const ctaHref = (interaction.forms > 0 && fields.length > 0) ? '#contact' : null;

  const sections = [
    buildHeaderSection(semantic, interaction, ctaHref, baseUrl),
    buildHeroSection(heroSection, baseUrl, ctaHref),
    ...buildBodySections(restSections, baseUrl),
    buildFormSection(interaction, fields),
    buildFooterSection()
  ].filter(Boolean);

  fs.writeFileSync(path.join(outputDir, 'index.html'), buildIndexHtml(sections, semantic.branding?.title));
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
