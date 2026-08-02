const fs = require('fs');
const config = require('./config');

async function saveStyles(page) {

  const styles = await page.evaluate(() => {

    const elements = [...document.querySelectorAll('*')];

    return elements.map(el => {

      const css = window.getComputedStyle(el);

      return {
        tag: el.tagName,
        id: el.id || null,
        class: el.className || null,

        style: {
          fontFamily: css.fontFamily,
          fontSize: css.fontSize,
          fontWeight: css.fontWeight,
          lineHeight: css.lineHeight,

          color: css.color,
          background: css.backgroundColor,

          width: css.width,
          height: css.height,

          margin: css.margin,
          padding: css.padding,

          border: css.border,
          borderRadius: css.borderRadius,

          display: css.display,
          position: css.position,

          flex: css.flex,
          grid: css.grid,

          opacity: css.opacity,
          zIndex: css.zIndex,

          boxShadow: css.boxShadow,
          transform: css.transform
        }

      };

    });

  });

  fs.writeFileSync(
    config.output.styles,
    JSON.stringify(styles, null, 2)
  );

}

module.exports = {
  saveStyles
};