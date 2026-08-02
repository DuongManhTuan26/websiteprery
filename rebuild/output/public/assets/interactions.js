(function () {
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
