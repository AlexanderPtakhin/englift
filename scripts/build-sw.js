const fs = require('fs');
const path = require('path');

// Просто обновляем CACHE_NAME в sw.js на основе содержимого
const swSrc = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const hash = require('crypto')
  .createHash('md5')
  .update(swSrc)
  .digest('hex')
  .slice(0, 8);
const newCacheName = `enguply-v2-${hash}`;

// Обновляем CACHE_NAME в sw.js
const updatedSw = swSrc.replace(
  /const CACHE_NAME = '[^']+';/,
  `const CACHE_NAME = '${newCacheName}';`
);
fs.writeFileSync(path.join(__dirname, '../sw.js'), updatedSw);

// Обновляем версию в HTML
const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Обновляем мета-тег версии
html = html.replace(
  /<meta name="app-version" content="[^"]*">/,
  `<meta name="app-version" content="${newCacheName}">`,
);

// Убираем мета-тег sw-file если есть
html = html.replace(
  /<meta name="sw-file" content="[^"]*">\n?/,
  ''
);

fs.writeFileSync(indexPath, html);

console.log(`✅ SW готов: /sw.js`);
console.log(`📦 CACHE_NAME: ${newCacheName}`);
