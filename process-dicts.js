const fs = require('fs');
const path = require('path');

const c1Path = path.join(__dirname, 'C1', 'dict-C1.json');
const c2Path = path.join(__dirname, 'C2', 'dict-C2.json');

function normalizeWord(word) {
  const normalized = {
    en: word.en,
    ru: word.ru,
    phonetic: word.phonetic || '',
    examples: word.examples || [],
    tags: word.tags || [],
    grammar: {
      collocations: [],
    },
  };

  // Обрабатываем коллокации - оставляем только первые 3
  if (
    word.grammar &&
    word.grammar.collocations &&
    Array.isArray(word.grammar.collocations)
  ) {
    normalized.grammar.collocations = word.grammar.collocations
      .slice(0, 3)
      .map(c => ({
        en: c.en,
        ru: c.ru,
      }));
  }

  return normalized;
}

function processFile(inputPath, outputPath) {
  console.log(`Processing ${inputPath}...`);

  // Восстанавливаем из бэкапа
  const backupPath = inputPath + '.backup';
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log(`Loaded ${data.length} words from backup`);

  const normalized = data.map(normalizeWord);

  fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2), 'utf8');
  console.log(`Saved ${normalized.length} words to ${outputPath}`);
}

// Обрабатываем C1
processFile(c1Path, c1Path);

// Обрабатываем C2
processFile(c2Path, c2Path);

console.log('Done!');
