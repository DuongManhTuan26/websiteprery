const paths = require('../shared/paths');
const { readJson, writeJson, ensureDir } = require('../shared/load');

const VIETNAMESE_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

function detectLanguage(text) {
  return VIETNAMESE_CHARS.test(text) ? 'vi' : 'unknown';
}

const FEATURE_KEYWORDS = {
  navigation: ['nav', 'menu', 'header'],
  hero: ['hero', 'banner'],
  pricing: ['pricing', 'price', 'plan'],
  testimonial: ['testimonial', 'review'],
  cta: ['cta', 'signup', 'register', 'dang-ky', 'dangky'],
  chat: ['chat', 'chatbot', 'bot'],
  form: ['form', 'input', 'contact'],
  footer: ['footer']
};

function detectPageType(text, components) {
  const lower = text.toLowerCase();

  if (lower.includes('chatbot') || lower.includes('ai')) {
    return 'saas-ai-landing';
  }

  if (components.componentTypes?.pricing) {
    return 'saas-pricing';
  }

  return 'marketing-landing';
}

function detectFeatures(components, interactions, text) {
  const lower = text.toLowerCase();
  const features = [];

  for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS)) {
    const inText = keywords.some(kw => lower.includes(kw));
    const inComponents = (components.components || []).some(c =>
      keywords.some(kw =>
        (c.class || '').toLowerCase().includes(kw) ||
        (c.type || '').toLowerCase().includes(kw)
      )
    );

    if (inText || inComponents) {
      features.push({
        name: feature,
        detected: true,
        source: inText && inComponents ? 'text+components' : inText ? 'text' : 'components'
      });
    }
  }

  if (interactions.totalInteractive > 0) {
    features.push({
      name: 'interactive-elements',
      detected: true,
      count: interactions.totalInteractive
    });
  }

  return features;
}

function mapUserFlows(features, interactions) {
  const flows = [];

  if (features.some(f => f.name === 'navigation')) {
    flows.push({
      name: 'browse',
      steps: ['view-header', 'navigate-sections', 'view-footer']
    });
  }

  if (features.some(f => f.name === 'cta')) {
    flows.push({
      name: 'conversion',
      steps: ['view-hero', 'click-cta']
    });
  }

  if (interactions.forms > 0) {
    flows.push({
      name: 'form-submission',
      steps: ['view-form', 'fill-inputs', 'submit']
    });
  }

  return flows;
}

const SPECIFIC_COMPONENT_TYPES = ['hero', 'pricing', 'cta', 'testimonial', 'card', 'modal'];

function findTopLevelBodySections(semanticSections) {
  const candidates = (semanticSections || []).filter(s => s.tag === 'SECTION' || s.tag === 'ASIDE');

  return candidates
    .filter(s => !candidates.some(other => other !== s && other.index < s.index && s.index < other.endIndex))
    .sort((a, b) => a.index - b.index);
}

function classifySection(containedComponents) {
  const votes = {};

  for (const c of containedComponents) {
    if (SPECIFIC_COMPONENT_TYPES.includes(c.type)) {
      votes[c.type] = (votes[c.type] || 0) + 1;
    }
  }

  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return ranked.length > 0 ? ranked[0][0] : 'section';
}

function sectionText(allNodes, section) {
  const candidates = allNodes
    .filter(n => n.index > section.index && n.index < section.endIndex && n.text)
    .map(n => n.text)
    .sort((a, b) => b.length - a.length);

  return candidates[0] || null;
}

function extractContentSections(layout, components, allNodes) {
  const allComponents = components.components || [];
  const bodySections = findTopLevelBodySections(layout?.semanticSections);

  return bodySections.slice(0, 12).map(section => {
    const contained = allComponents.filter(c => c.index > section.index && c.index < section.endIndex);

    return {
      type: classifySection(contained),
      tag: section.tag,
      text: sectionText(allNodes, section)
    };
  });
}

async function analyzeSemantic() {
  ensureDir(paths.aiAnalysis.output);

  const dataset = readJson(paths.collector.dataset);
  const analysis = dataset.analysis;
  const text = dataset.normalize.text?.text || '';

  const pageType = detectPageType(text, analysis.components);
  const features = detectFeatures(analysis.components, analysis.interaction, text);
  const userFlows = mapUserFlows(features, analysis.interaction);
  const contentSections = extractContentSections(analysis.layout, analysis.components, dataset.normalize.dom?.nodes || []);

  const semantic = {
    generatedAt: new Date().toISOString(),
    pageType,
    language: detectLanguage(text),
    features,
    userFlows,
    contentSections,
    recommendations: {
      framework: 'static-html',
      styling: 'css-variables',
      componentStrategy: 'section-based'
    }
  };

  writeJson(paths.aiAnalysis.semantic, semantic);

  console.log('AI analysis OK — page type:', pageType, ', features:', features.length);
}

module.exports = {
  analyzeSemantic
};

if (require.main === module) {
  analyzeSemantic().catch(console.error);
}
