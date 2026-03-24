// Оптимизированная инициализация приложения
(async function() {
  console.log('🚀 Оптимизированная загрузка приложения...');
  
  // 1. Подключаем оптимизаторы
  await import('./lazy-loader.js');
  await import('./profile-optimizer.js');
  await import('./parallel-init.js');
  
  // 2. Быстрый старт - показываем UI сразу
  const loader = document.getElementById('loading-indicator');
  if (loader) loader.style.display = 'block';
  
  // 3. Параллельная инициализация
  const results = await window.parallelInit.startAll();
  
  // 4. Быстрая загрузка профиля
  if (window.currentUserId) {
    const profile = await window.profileOptimizer.loadProfileFast(window.currentUserId);
    if (profile) {
      window.applyProfileData(profile);
      console.log('⚡ Профиль применен быстро');
    }
  }
  
  // 5. Минимальный рендер для старта
  if (window.words && window.words.length > 0) {
    window.renderWords();
    console.log('⚡ Быстрый рендер слов');
  }
  
  // 6. Фоновые задачи
  setTimeout(() => {
    // Загрузка друзей в фоне
    if (!results.get('friends')?.success && window.currentUserId) {
      window.loadFriendsDataNew();
    }
    
    // Предзагрузка идиом
    if (!results.get('idioms')?.success) {
      window.lazyLoader.loadIdioms();
    }
  }, 1000);
  
  // 7. Скрываем лоадер
  setTimeout(() => {
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.style.display = 'none', 300);
    }
    document.body.classList.remove('loading');
    console.log('⚡ Приложение готово');
  }, 500);
  
})();
