const fs = require('fs');
const path = require('path');

// Копируем sw.js как sw.js (стабильное имя)
const src = path.join(__dirname, '../sw.js');
const dest = path.join(__dirname, '../dist/sw.js');
fs.copyFileSync(src, dest);
console.log(`📁 Скопирован SW: sw.js`);

// Копируем data-manifest.json в dist
const manifestSrc = path.join(__dirname, '../data-manifest.json');
const manifestDest = path.join(__dirname, '../dist/data-manifest.json');
fs.copyFileSync(manifestSrc, manifestDest);
console.log(`📁 Скопирован data-manifest.json`);

// Копируем папку story в dist
const storySrc = path.join(__dirname, '../story');
const storyDest = path.join(__dirname, '../dist/story');
if (fs.existsSync(storySrc)) {
  if (!fs.existsSync(storyDest)) {
    fs.mkdirSync(storyDest, { recursive: true });
  }
  const copyRecursive = (src, dest) => {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    entries.forEach(entry => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  };
  copyRecursive(storySrc, storyDest);
  console.log(`📁 Скопирована папка story`);
} else {
  console.log(`⚠️ Папка story не найдена, пропускаем копирование`);
}

// Копируем папки словарей в dist (только JSON файлы)
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
levels.forEach(level => {
  const dictSrc = path.join(__dirname, '..', level);
  const dictDest = path.join(__dirname, '../dist', level);
  if (fs.existsSync(dictSrc)) {
    if (!fs.existsSync(dictDest)) {
      fs.mkdirSync(dictDest, { recursive: true });
    }
    // Копируем только JSON файлы
    const entries = fs.readdirSync(dictSrc, { withFileTypes: true });
    entries.forEach(entry => {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const srcPath = path.join(dictSrc, entry.name);
        const destPath = path.join(dictDest, entry.name);
        fs.copyFileSync(srcPath, destPath);
      }
    });
    console.log(`📁 Скопированы JSON файлы из папки ${level}`);
  } else {
    console.log(`⚠️ Папка ${level} не найдена, пропускаем копирование`);
  }
});
