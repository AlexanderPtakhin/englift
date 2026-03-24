// Параллельная инициализация компонентов
class ParallelInit {
  constructor() {
    this.tasks = new Map();
    this.results = new Map();
  }

  // Регистрация задачи инициализации
  register(name, taskFn, priority = 0) {
    this.tasks.set(name, { fn: taskFn, priority });
  }

  // Запуск всех задач параллельно
  async startAll() {
    console.log('🚀 Запуск параллельной инициализации...');
    
    const sortedTasks = Array.from(this.tasks.entries())
      .sort(([, a], [, b]) => b.priority - a.priority);

    const promises = sortedTasks.map(async ([name, { fn }]) => {
      try {
        const startTime = performance.now();
        const result = await fn();
        const duration = performance.now() - startTime;
        
        this.results.set(name, { result, duration, success: true });
        console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
        return result;
      } catch (error) {
        this.results.set(name, { error, success: false });
        console.error(`❌ ${name}:`, error);
        return null;
      }
    });

    await Promise.allSettled(promises);
    console.log('🎉 Параллельная инициализация завершена');
    return this.results;
  }

  // Получение результата задачи
  getResult(name) {
    return this.results.get(name);
  }
}

// Регистрация компонентов для параллельной загрузки
const init = new ParallelInit();

// Основные компоненты (высокий приоритет)
init.register('auth', async () => {
  // Инициализация авторизации
  if (window.currentUserId) return window.currentUserId;
  return null;
}, 10);

init.register('theme', async () => {
  // Быстрая загрузка темы из localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    window.applyTheme(JSON.parse(savedTheme));
    return savedTheme;
  }
  return null;
}, 9);

init.register('words', async () => {
  // Загрузка слов из localStorage
  const local = localStorage.getItem('words');
  if (local) {
    window.words = JSON.parse(local);
    console.log(`⚡ Слова загружены из localStorage: ${window.words.length}`);
    return window.words;
  }
  return [];
}, 8);

// Второстепенные компоненты (низкий приоритет)
init.register('idioms', async () => {
  // Ленивая загрузка идиом
  return await window.lazyLoader.loadIdioms();
}, 3);

init.register('dictionary', async () => {
  // Ленивая загрузка словаря
  return await window.lazyLoader.loadDictionary();
}, 2);

init.register('friends', async () => {
  // Загрузка данных друзей
  if (window.currentUserId) {
    await window.loadFriendsDataNew();
    return true;
  }
  return false;
}, 1);

window.parallelInit = init;
