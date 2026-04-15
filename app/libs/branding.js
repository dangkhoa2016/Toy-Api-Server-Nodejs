const fs = require('node:fs');
const path = require('node:path');

const assetsDirectory = path.join(__dirname, '..', 'imgs');

const faviconIco = fs.readFileSync(path.join(assetsDirectory, 'favicon.ico'));
const faviconPng = fs.readFileSync(path.join(assetsDirectory, 'favicon.png'));

const swaggerUiTheme = {
  favicon: [
    {
      filename: 'toy-favicon-32x32.png',
      rel: 'icon',
      sizes: '32x32',
      type: 'image/png',
      content: faviconPng,
    },
    {
      filename: 'toy-favicon-16x16.png',
      rel: 'icon',
      sizes: '16x16',
      type: 'image/png',
      content: faviconPng,
    },
  ],
};

const swaggerUiLogo = {
  type: 'image/png',
  content: faviconPng,
  href: '/docs/',
  target: '_self',
};

module.exports = {
  faviconIco,
  faviconPng,
  swaggerUiLogo,
  swaggerUiTheme,
};
