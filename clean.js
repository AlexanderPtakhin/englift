const fs = require('fs');
const path = process.argv[2];
if (!path) {
  console.error('Укажи файл: node clean.js script.js');
  process.exit(1);
}

const content = fs.readFileSync(path, 'utf8');
fs.writeFileSync(path + '.backup', content);
console.log('Бэкап сохранён как', path + '.backup');

const lines = content.split('\n');
const cleaned = lines.filter(line => line.trim().length > 0).join('\n');
fs.writeFileSync(path, cleaned);
console.log(
  `Готово! Было ${lines.length} строк, стало ${cleaned.split('\n').length} строк`,
);



// Запустить скрипт 
// node clean.js script.js