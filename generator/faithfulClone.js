const cheerio = require('cheerio');

function rewriteRootRelative(url, origin) {
  if (!url) return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  return origin + url;
}

function rewriteSrcset(value, origin) {
  if (!value) return value;

  return value
    .split(',')
    .map(part => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;

      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx === -1) return rewriteRootRelative(trimmed, origin);

      const url = trimmed.slice(0, spaceIdx);
      const descriptor = trimmed.slice(spaceIdx);
      return rewriteRootRelative(url, origin) + descriptor;
    })
    .join(', ');
}

function rewriteStyleUrls(styleValue, origin) {
  if (!styleValue) return styleValue;

  return styleValue.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, url) => {
    return `url(${quote}${rewriteRootRelative(url, origin)}${quote})`;
  });
}

function rewriteAllUrls($, origin) {
  $('*').each((_, el) => {
    const attribs = el.attribs || {};

    if (attribs.src) el.attribs.src = rewriteRootRelative(attribs.src, origin);
    if (attribs.href) el.attribs.href = rewriteRootRelative(attribs.href, origin);
    if (attribs.action) el.attribs.action = rewriteRootRelative(attribs.action, origin);
    if (attribs.srcset) el.attribs.srcset = rewriteSrcset(attribs.srcset, origin);
    if (attribs.style) el.attribs.style = rewriteStyleUrls(attribs.style, origin);
  });
}

// Builds a literal clone of the captured page: real HTML structure, real classes,
// real text, real <style> blocks, with root-relative asset/link URLs rewritten to
// the original origin (this pipeline never downloads binary assets — see
// CLAUDE.md "Faithful clone" section for why hotlinking is the deliberate choice).
function buildFaithfulClone(dataset) {
  const domHtml = dataset?.normalize?.dom?.html;
  const target = dataset?.source?.target;

  if (!domHtml || !target) {
    return { ok: false, reason: 'missing normalize.dom.html or source.target' };
  }

  let origin;
  try {
    origin = new URL(target).origin;
  } catch {
    return { ok: false, reason: 'invalid source.target URL' };
  }

  const $ = cheerio.load(domHtml, { xmlMode: false });

  // No JS runtime in the rebuild (architecture decision: framework='static-html',
  // see spec/technical) — analytics/hydration scripts and their noscript fallbacks
  // (tracking pixels) are dropped rather than shipped inert.
  $('script').remove();
  $('noscript').remove();
  $('link[as="script"]').remove();

  rewriteAllUrls($, origin);

  const bodyEl = $('body');
  const htmlEl = $('html');

  // Pull <meta charset> out so it can be re-emitted first — it must appear
  // within the first 1024 bytes of <head> per spec, ahead of our injected
  // fallback stylesheet links.
  const charsetMeta = $('head > meta[charset]').first();
  const charsetHtml = charsetMeta.length ? $.html(charsetMeta) : '';
  charsetMeta.remove();

  const result = {
    ok: true,
    lang: htmlEl.attr('lang') || null,
    charsetHtml,
    headHtml: ($('head').html() || '').trim(),
    bodyAttribs: { ...(bodyEl.get(0)?.attribs || {}) },
    bodyHtml: (bodyEl.html() || '').trim(),
    origin
  };

  return result;
}

module.exports = {
  buildFaithfulClone,
  rewriteRootRelative,
  rewriteSrcset,
  rewriteStyleUrls
};
