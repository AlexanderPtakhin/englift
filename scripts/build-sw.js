const fs = require('fs');
const path = require('path');

// Уникальное имя на основе даты + хеш содержимого
const swSrc = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const hash = require('crypto')
  .createHash('md5')
  .update(swSrc)
  .digest('hex')
  .slice(0, 8);
const version = `${Date.now()}-${hash}`;
const swFileName = `sw.${version}.js`;

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Обновляем мета-тег версии
html = html.replace(
  /<meta name="app-version" content="[^"]*">/,
  `<meta name="app-version" content="${version}">`,
);

// Добавляем или обновляем мета-тег с именем файла SW
if (html.includes('<meta name="sw-file"')) {
  html = html.replace(
    /<meta name="sw-file" content="[^"]*">/,
    `<meta name="sw-file" content="/${swFileName}">`,
  );
} else {
  html = html.replace(
    '</head>',
    `  <meta name="sw-file" content="/${swFileName}">\n</head>`,
  );
}

fs.writeFileSync(indexPath, html);

console.log(`✅ SW готов: ${swFileName}`);
console.log(`📦 Версия: ${version}`);
