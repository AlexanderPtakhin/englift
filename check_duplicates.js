const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('dictionary.json', 'utf-8'));
  
  // Проверяем дубли по полю "en"
  const duplicates = {};
  const seen = new Set();
  
  data.forEach((word, index) => {
    if (seen.has(word.en)) {
      if (!duplicates[word.en]) {
        duplicates[word.en] = [];
      }
      duplicates[word.en].push(index);
    } else {
      seen.add(word.en);
    }
  });
  
  const dupCount = Object.keys(duplicates).length;
  
  if (dupCount > 0) {
    console.log(`❌ Найдено ${dupCount} дубликатов:`);
    Object.entries(duplicates).forEach(([word, indices]) => {
      console.log(`  "${word}" - индексы: ${indices.join(', ')}`);
    });
  } else {
    console.log('✅ Дубликатов не найдено!');
  }
  
  console.log(`\n📊 Статистика:`);
  console.log(`  Всего слов: ${data.length}`);
  console.log(`  Уникальных слов: ${data.length - dupCount}`);
  console.log(`  Дубликатов: ${dupCount}`);
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
}
