// Hand-authored vanilla JS (no framework, no build step, no dependency) that
// restores click-to-toggle behavior for the disclosure widgets already
// present in the captured markup (Radix-style accordion/tabs/dialog
// triggers: real `aria-expanded` + `aria-controls`, some also carrying
// `data-state`). Verified against the real capture: the accordion/tabs
// targets referenced by `aria-controls` exist in `capture/raw/dom/dom.html`
// with `data-state="open|closed"` already on them, so their expand/collapse
// visuals are driven entirely by the real (now-localized) CSS
// `data-[state=...]` selectors — this script only needs to flip the state
// attributes, not reimplement any animation. Two trigger IDs in the capture
// (the language-select combobox, the mobile-nav dialog) have no matching
// target in the DOM at all — those open a Radix portal that only mounts on
// first interaction, so it was never captured; toggling still flips the
// trigger's own aria-expanded state (harmless, no error) but there is no
// captured popup content to reveal, which is a disclosed, evidence-backed
// gap rather than a bug.
//
// Deliberately NOT the real Next.js/React bundle: that bundle expects a
// server-rendered payload, RSC streaming chunks, and live API endpoints
// (app.preny.ai) this pipeline cannot reproduce offline — running it would
// mean either hotlinking those endpoints (forbidden) or hydration crashing
// against markup this pipeline has rewritten. This script is the bounded,
// evidence-based alternative: real markup + real CSS + minimal glue code.
function buildInteractionsJs() {
  return `(function () {
  'use strict';

  function setExpanded(trigger, next) {
    trigger.setAttribute('aria-expanded', String(next));

    if (trigger.hasAttribute('data-state')) {
      trigger.setAttribute('data-state', next ? 'open' : 'closed');
    }

    var controlsId = trigger.getAttribute('aria-controls');
    if (!controlsId) return;

    var target = document.getElementById(controlsId);
    if (!target) return;

    target.setAttribute('data-state', next ? 'open' : 'closed');
    if (next) {
      target.removeAttribute('hidden');
    } else if (target.hasAttribute('data-close-hides')) {
      target.setAttribute('hidden', '');
    }
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[aria-expanded]');
    if (!trigger) return;

    var expanded = trigger.getAttribute('aria-expanded') === 'true';
    setExpanded(trigger, !expanded);
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    if (!id) return;

    link.addEventListener('click', function (event) {
      var el = document.getElementById(id);
      if (!el) return;

      event.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
`;
}

module.exports = {
  buildInteractionsJs
};
