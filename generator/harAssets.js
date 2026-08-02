const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const paths = require('../shared/paths');
const { ensureDir } = require('../shared/load');

const EXT_BY_MIME = {
  'text/css': 'css',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/avif': 'avif',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'application/json': 'json'
};

const NON_REWRITABLE_SCHEME = /^(data|mailto|tel|javascript|#):/i;

// text/html responses in the HAR are page navigations (the captured page
// itself, or other real routes) — never a fetchable sub-resource. Without
// this guard, an internal nav link like href="/" (which matches the HAR
// entry for the page itself) would get "localized" into a copy of the
// entire captured HTML document. Those links should just stay same-origin
// relative like any other uncaptured page route.
function isDocumentResponse(mimeType) {
  return mimeType === 'text/html';
}

// Loads capture/raw/har/preny.har (recorded with mode:'full' by capture/har.js)
// and returns a Map<absoluteUrl, {buffer, mimeType}> for every entry that has
// a real captured response body — this is the only source of real asset bytes
// this pipeline has (it never downloads anything itself).
function loadHarContentMap() {
  const map = new Map();

  if (!fs.existsSync(paths.capture.har)) {
    return map;
  }

  let har;
  try {
    har = JSON.parse(fs.readFileSync(paths.capture.har, 'utf8'));
  } catch {
    return map;
  }

  const entries = har?.log?.entries || [];

  for (const entry of entries) {
    const content = entry.response?.content;
    if (!content || !content.text) continue;
    if (entry.response.status < 200 || entry.response.status >= 300) continue;

    const mimeType = (content.mimeType || '').split(';')[0].trim();
    const buffer = content.encoding === 'base64'
      ? Buffer.from(content.text, 'base64')
      : Buffer.from(content.text, 'utf8');

    map.set(entry.request.url, { buffer, mimeType });
  }

  return map;
}

function extForMime(mimeType, fallbackUrl) {
  if (EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType];

  const pathnameExt = (() => {
    try {
      return path.extname(new URL(fallbackUrl).pathname).replace('.', '');
    } catch {
      return '';
    }
  })();

  return pathnameExt || 'bin';
}

function resolveAbsolute(value, baseUrl) {
  if (!value || NON_REWRITABLE_SCHEME.test(value)) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

// Strips a URL down to a same-origin-relative reference (pathname + search),
// used when we have no captured bytes for it — this guarantees the reference
// never points at the original site (or any third-party host), even though
// it will 404 against our own deployment. Never hotlinks, never fabricates.
function toSameOriginRelative(absoluteUrl) {
  try {
    const u = new URL(absoluteUrl);
    return u.pathname + u.search;
  } catch {
    return absoluteUrl;
  }
}

function createAssetLocalizer(outputDir) {
  const harMap = loadHarContentMap();
  const assetsDir = path.join(outputDir, 'public', 'assets');
  ensureDir(assetsDir);

  const writtenHashes = new Set();
  const manifest = [];

  function writeBinary(buffer, mimeType, sourceUrl) {
    const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 16);
    const ext = extForMime(mimeType, sourceUrl);
    const filename = `${hash}.${ext}`;

    if (!writtenHashes.has(filename)) {
      fs.writeFileSync(path.join(assetsDir, filename), buffer);
      writtenHashes.add(filename);
    }

    return `/assets/${filename}`;
  }

  // Rewrites a single attribute value (src/href/action) that may be
  // root-relative or absolute. Returns a local /assets/... path when the
  // real bytes were captured in the HAR, otherwise a same-origin-relative
  // fallback that never touches the original host.
  function localize(value, baseUrl) {
    if (!value || NON_REWRITABLE_SCHEME.test(value)) return value;

    const absolute = resolveAbsolute(value, baseUrl);
    if (!absolute) return value;

    const hit = harMap.get(absolute);

    if (hit && hit.mimeType !== 'text/css' && !isDocumentResponse(hit.mimeType)) {
      manifest.push({ url: absolute, found: true, localPath: null });
      const localPath = writeBinary(hit.buffer, hit.mimeType, absolute);
      manifest[manifest.length - 1].localPath = localPath;
      return localPath;
    }

    manifest.push({ url: absolute, found: false, localPath: null });
    return value.startsWith('/') ? value : toSameOriginRelative(absolute);
  }

  function localizeSrcset(value, baseUrl) {
    if (!value) return value;

    return value
      .split(',')
      .map(part => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;

        const spaceIdx = trimmed.indexOf(' ');
        if (spaceIdx === -1) return localize(trimmed, baseUrl);

        const url = trimmed.slice(0, spaceIdx);
        const descriptor = trimmed.slice(spaceIdx);
        return localize(url, baseUrl) + descriptor;
      })
      .join(', ');
  }

  function localizeInlineStyleUrls(styleValue, baseUrl) {
    if (!styleValue || !styleValue.includes('url(')) return styleValue;

    return styleValue.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, ref) => {
      return `url(${quote}${localize(ref, baseUrl)}${quote})`;
    });
  }

  // A stylesheet's own bytes must be fetched from the HAR (not just have its
  // href rewritten) because its internal url(...) references (fonts, images)
  // also need localizing before it can be served offline.
  function localizeStylesheet(hrefValue, baseUrl) {
    const absolute = resolveAbsolute(hrefValue, baseUrl);
    if (!absolute) return null;

    const hit = harMap.get(absolute);
    if (!hit) {
      manifest.push({ url: absolute, found: false, localPath: null });
      return null;
    }

    const cssText = hit.buffer.toString('utf8');
    const rewritten = cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, ref) => {
      if (ref.startsWith('data:')) return match;
      return `url(${quote}${localize(ref, absolute)}${quote})`;
    });

    manifest.push({ url: absolute, found: true, localPath: null });
    const localPath = writeBinary(Buffer.from(rewritten, 'utf8'), 'text/css', absolute);
    manifest[manifest.length - 1].localPath = localPath;
    return localPath;
  }

  function localizeStyleBlockText(cssText, baseUrl) {
    if (!cssText || !cssText.includes('url(')) return cssText;

    return cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, ref) => {
      if (ref.startsWith('data:')) return match;
      return `url(${quote}${localize(ref, baseUrl)}${quote})`;
    });
  }

  return {
    localize,
    localizeSrcset,
    localizeInlineStyleUrls,
    localizeStylesheet,
    localizeStyleBlockText,
    getManifest: () => manifest.slice(),
    harEntryCount: harMap.size
  };
}

module.exports = {
  createAssetLocalizer,
  loadHarContentMap
};
