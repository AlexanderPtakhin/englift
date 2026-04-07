const fs = require('fs');
const path = require('path');

// Берём имя SW из ИСХОДНОГО index.html (который только что обновил build-sw.js)
const indexPath = path.join(__dirname, '../index.html');
const html = fs.readFileSync(indexPath, 'utf8');

// Ищем мета-тег в обычном формате
const match = html.match(/<meta name="sw-file" content="\/([^"]+)">/);

if (!match) {
  console.error('❌ sw-file meta tag not found in source index.html');
  console.error('Проверяем содержимое:', html.substring(0, 500) + '...');
  process.exit(1);
}

const swFileName = match[1];
const src = path.join(__dirname, '../sw.js');
const dest = path.join(__dirname, '../dist', swFileName);
fs.copyFileSync(src, dest);
console.log(`📁 Скопирован SW: ${swFileName}`);
