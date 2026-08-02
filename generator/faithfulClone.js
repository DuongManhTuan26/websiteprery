const cheerio = require('cheerio');

// Tags/attributes that describe the page rather than something the browser
// fetches on render (crawler/social-preview metadata) — these keep pointing
// at the real origin verbatim. Nothing else is allowed to reference it.
const METADATA_LINK_RELS = new Set(['canonical', 'alternate']);

// Localizes every fetchable URL in the document via the HAR-backed asset
// localizer: real captured bytes go to /assets/<hash>.<ext>, anything not
// captured is neutered to a same-origin-relative reference (never left
// pointing at the original host — see generator/harAssets.js).
function localizeAllUrls($, origin, localizer) {
  $('*').each((_, el) => {
    const attribs = el.attribs || {};
    const tag = el.tagName;

    if (tag === 'link' && METADATA_LINK_RELS.has((attribs.rel || '').toLowerCase())) {
      return;
    }

    if (tag === 'link' && (attribs.rel || '').toLowerCase() === 'stylesheet' && attribs.href) {
      const localHref = localizer.localizeStylesheet(attribs.href, origin);
      el.attribs.href = localHref || localizer.localize(attribs.href, origin);
      return;
    }

    if (tag === 'style') {
      const text = $(el).html();
      if (text) $(el).html(localizer.localizeStyleBlockText(text, origin));
      return;
    }

    if (attribs.src) el.attribs.src = localizer.localize(attribs.src, origin);
    if (attribs.href) el.attribs.href = localizer.localize(attribs.href, origin);
    if (attribs.action) el.attribs.action = localizer.localize(attribs.action, origin);
    if (attribs.srcset) el.attribs.srcset = localizer.localizeSrcset(attribs.srcset, origin);
    if (attribs.style) el.attribs.style = localizer.localizeInlineStyleUrls(attribs.style, origin);
  });
}

// Builds a literal, self-contained clone of the captured page: real HTML
// structure, real classes, real text, real <style> blocks — with every
// fetchable URL localized to a real asset extracted from the capture HAR
// (capture/raw/har/preny.har, recorded with mode:'full'). Nothing in the
// output references the original origin for CSS/JS/fonts/images/icons; see
// CLAUDE.md "Faithful clone" section for the localization design and its
// one disclosed limitation (assets never actually requested during the
// single capture pass — e.g. below-the-fold lazy images — aren't in the
// HAR and can't be fabricated, so those specific references are left
// same-origin-relative and 404 gracefully instead of hotlinking elsewhere).
function buildFaithfulClone(dataset, localizer) {
  const domHtml = dataset?.normalize?.dom?.html;
  const target = dataset?.source?.target;

  if (!domHtml || !target) {
    return { ok: false, reason: 'missing normalize.dom.html or source.target' };
  }

  if (!localizer) {
    return { ok: false, reason: 'missing asset localizer' };
  }

  let origin;
  try {
    origin = new URL(target).origin;
  } catch {
    return { ok: false, reason: 'invalid source.target URL' };
  }

  const $ = cheerio.load(domHtml, { xmlMode: false });

  // The real Next.js/React bundle + analytics scripts are dropped, not shipped
  // inert — running the real bundle would need either hotlinking app.preny.ai's
  // API endpoints (forbidden) or it would hydration-crash against markup this
  // pipeline has rewritten. generator/index.js adds back exactly one small
  // hand-authored vanilla script (generator/runtimeInteractions.js) for the
  // disclosure widgets (accordion/tabs) whose real toggle targets survived
  // capture — see that file's header comment for the evidence and scope.
  $('script').remove();
  $('noscript').remove();
  $('link[as="script"]').remove();

  localizeAllUrls($, origin, localizer);

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
  buildFaithfulClone
};
