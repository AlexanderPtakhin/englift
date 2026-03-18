// Скрипт для поиска слов с разными уровнями CEFR
const fs = require('fs');

// Читаем CSV файл
const csvContent = fs.readFileSync('ENGLISH_CERF.csv', 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim());

// Парсим слова
const words = lines.map(line => {
  const [en, level] = line.split(',').map(s => s.trim());
  return { en: en.toLowerCase(), level };
}).filter(w => w.en && w.level);

// Находим дубликаты
const duplicates = {};
words.forEach(word => {
  if (!duplicates[word.en]) {
    duplicates[word.en] = [];
  }
  duplicates[word.en].push(word.level);
});

// Фильтруем только те, у которых разные уровни
const problematicWords = Object.entries(duplicates)
  .filter(([word, levels]) => {
    const uniqueLevels = [...new Set(levels)];
    return uniqueLevels.length > 1;
  })
  .map(([word, levels]) => ({
    word,
    levels: [...new Set(levels)],
    count: levels.length
  }))
  .sort((a, b) => b.count - a.count);

// Статистика
console.log(`\n📊 Статистика по словарю:`);
console.log(`Всего слов: ${words.length}`);
console.log(`Уникальных слов: ${Object.keys(duplicates).length}`);
console.log(`Слов с разными уровнями: ${problematicWords.length}\n`);

// Топ-50 самых проблемных слов
console.log(`🔥 Топ-50 слов с разными уровнями CEFR:`);
problematicWords.slice(0, 50).forEach((item, index) => {
  console.log(`${index + 1}. "${item.word}" - уровни: ${item.levels.join(', ')} (${item.count} вариантов)`);
});

// Сохраняем полный список
fs.writeFileSync('problematic_words.json', JSON.stringify(problematicWords, null, 2));
console.log(`\n💾 Полный список сохранен в problematic_words.json`);
console.log(`📁 Нужно добавить примеры для ${problematicWords.length} слов`);
