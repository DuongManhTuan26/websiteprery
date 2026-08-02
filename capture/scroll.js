// Scrolls the full page height before any artifact is captured so that
// below-the-fold lazy-loaded images/icons (loading="lazy") actually fire
// their network requests and land in the HAR — without this, only
// above-the-fold assets are ever requested during a single page load,
// which is why capture/raw/har/preny.har only had real bytes for a subset
// of the images referenced in capture/raw/dom/dom.html (verified: 68/221
// referenced assets before this fix). Scrolls back to top afterwards so
// the full-page screenshot and computed-style snapshot reflect the same
// resting state as before.
async function scrollFullPage(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      const step = 400;
      let scrolled = 0;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, step);
        scrolled += step;

        if (scrolled >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });

  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

module.exports = {
  scrollFullPage
};
