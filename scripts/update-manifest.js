const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Функция для вычисления MD5 хеша файла
function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    console.error(`Ошибка чтения файла ${filePath}:`, error);
    return null;
  }
}

// Функция для вычисления хеша папки (сумма хешей всех файлов)
function getFolderHash(folderPath, extensions = ['.json']) {
  try {
    const files = fs.readdirSync(folderPath);
    let combinedHash = '';

    files.forEach(file => {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        const filePath = path.join(folderPath, file);
        const fileHash = getFileHash(filePath);
        if (fileHash) {
          combinedHash += fileHash;
        }
      }
    });

    return crypto.createHash('md5').update(combinedHash).digest('hex');
  } catch (error) {
    console.error(`Ошибка чтения папки ${folderPath}:`, error);
    return null;
  }
}

// Путь к data-manifest.json
const manifestPath = path.join(__dirname, '../data-manifest.json');
const projectDir = path.join(__dirname, '..');
const storyDir = path.join(__dirname, '../story');

// Читаем текущий манифест
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error('Ошибка чтения data-manifest.json:', error);
  process.exit(1);
}

// Вычисляем хеши для словарей
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
let dictChanged = false;
let storiesChanged = false;

levels.forEach(level => {
  const dictFile = path.join(projectDir, level, `dict-${level}.json`);
  const currentHash = getFileHash(dictFile);
  
  if (currentHash && manifest[level]) {
    const oldHash = manifest[level].hash || '';
    if (currentHash !== oldHash) {
      console.log(`[MANIFEST] Словарь ${level} изменился: ${oldHash} -> ${currentHash}`);
      dictChanged = true;
      manifest[level].hash = currentHash;
      manifest[level].version = currentHash; // Связываем version с hash
      manifest[level].lastUpdated = new Date().toISOString();
    }
  } else if (currentHash) {
    console.log(`[MANIFEST] Добавлен хеш для словаря ${level}: ${currentHash}`);
    manifest[level].hash = currentHash;
    manifest[level].version = currentHash; // Связываем version с hash
  }
});

// Вычисляем хеш для историй
const storiesManifestFile = path.join(storyDir, 'stories.json');
const storiesHash = getFileHash(storiesManifestFile);

if (storiesHash && manifest.stories) {
  const oldStoriesHash = manifest.stories.hash || '';
  if (storiesHash !== oldStoriesHash) {
    storiesChanged = true;
    console.log(`[MANIFEST] Истории изменились: ${oldStoriesHash} -> ${storiesHash}`);
    manifest.stories.hash = storiesHash;
    manifest.stories.lastUpdated = new Date().toISOString();
  }
} else if (storiesHash) {
  console.log(`[MANIFEST] Добавлен хеш для историй: ${storiesHash}`);
  manifest.stories.hash = storiesHash;
}

// Обновляем общую версию если что-то изменилось
if (dictChanged || storiesChanged) {
  manifest.appVersion = new Date().toISOString();
  console.log(`[MANIFEST] Обновлена общая версия: ${manifest.appVersion}`);
}

// Сохраняем обновлённый манифест
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('[MANIFEST] ✅ data-manifest.json обновлён');
