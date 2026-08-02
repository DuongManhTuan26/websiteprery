// Opens every real disclosure/navigation widget it can find (accordions,
// tabs, dropdowns, comboboxes, dialogs, native <details>) before any
// artifact is captured, so lazy-mounted content (Radix-style portals, panel
// content that only renders once expanded) actually exists in the DOM and
// any images/requests it triggers land in the HAR. Runs against the LIVE
// page during capture — before generator/ ever strips scripts — so real
// framework click handlers fire exactly as they would for a real user.
//
// Generic on purpose (no site-specific selectors): targets the same ARIA/
// native-semantics surface this pipeline already reads elsewhere
// (analyzer/interaction.js, generator/runtimeInteractions.js) —
// aria-expanded="false", unselected role="tab", and <summary> (native
// <details>). Every candidate is marked with data-capture-opened right
// before it's clicked so nothing is ever clicked twice — that's what
// guarantees termination even if a click toggles the attribute back, and
// why newly-mounted content (which can itself contain more matching
// elements) is naturally picked up by the next round instead of being
// missed.
const OPEN_SELECTOR = [
  '[aria-expanded="false"]',
  '[role="tab"]:not([aria-selected="true"])',
  'summary'
].join(',');

async function openAllInteractive(page, options = {}) {
  const maxRounds = options.maxRounds ?? 6;
  const waitAfterClick = options.waitAfterClick ?? 500;
  const idleTimeout = options.idleTimeout ?? 3000;

  let totalOpened = 0;

  for (let round = 0; round < maxRounds; round++) {
    const openedCount = await page.evaluate(selector => {
      const candidates = Array.from(document.querySelectorAll(selector))
        .filter(el => !el.hasAttribute('data-capture-opened'));

      candidates.forEach(el => {
        el.setAttribute('data-capture-opened', 'true');
        try {
          el.click();
        } catch {
          // one failing trigger must not abort the whole capture
        }
      });

      return candidates.length;
    }, OPEN_SELECTOR);

    if (openedCount === 0) break;

    totalOpened += openedCount;
    await page.waitForTimeout(waitAfterClick);

    try {
      // real sites keep background analytics/chat beacons alive
      // indefinitely — a timeout here is expected, not a failure
      await page.waitForLoadState('networkidle', { timeout: idleTimeout });
    } catch {
      // ignore
    }
  }

  return totalOpened;
}

module.exports = {
  openAllInteractive,
  OPEN_SELECTOR
};
