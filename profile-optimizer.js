// Оптимизированная загрузка профиля с кешированием
class ProfileOptimizer {
  constructor() {
    this.cache = new Map();
    this.lastSync = 0;
    this.SYNC_INTERVAL = 30000; // 30 секунд
  }

  // Быстрая загрузка профиля из localStorage с фоновым обновлением
  async loadProfileFast(userId) {
    const cacheKey = `profile_${userId}`;
    const cached = this.cache.get(cacheKey);
    
    // Если есть свежий кеш (менее 30 сек), возвращаем его
    if (cached && Date.now() - cached.timestamp < this.SYNC_INTERVAL) {
      console.log('⚡ Профиль загружен из кеша');
      return cached.data;
    }

    // Загружаем из localStorage (быстро)
    const localProfile = this.loadFromLocalStorage(userId);
    if (localProfile) {
      console.log('⚡ Профиль загружен из localStorage');
      this.cache.set(cacheKey, {
        data: localProfile,
        timestamp: Date.now()
      });
      
      // Фоновое обновление с сервера
      this.backgroundSync(userId);
      return localProfile;
    }

    // Если нет локальных данных, ждем сервер
    return this.loadFromServer(userId);
  }

  loadFromLocalStorage(userId) {
    try {
      const stored = localStorage.getItem(`profile_${userId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('❌ Ошибка загрузки профиля из localStorage:', e);
      return null;
    }
  }

  async loadFromServer(userId) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
        this.cache.set(`profile_${userId}`, {
          data: profile,
          timestamp: Date.now()
        });
        this.saveToLocalStorage(userId, profile);
        console.log('🌐 Профиль загружен с сервера');
        return profile;
      }
    } catch (e) {
      console.error('❌ Ошибка загрузки профиля с сервера:', e);
      return null;
    }
  }

  async backgroundSync(userId) {
    if (Date.now() - this.lastSync < this.SYNC_INTERVAL) return;
    
    this.lastSync = Date.now();
    try {
      const serverProfile = await this.loadFromServer(userId);
      const localProfile = this.loadFromLocalStorage(userId);
      
      // Объединяем данные (серверные приоритетнее)
      if (serverProfile && localProfile) {
        const merged = { ...localProfile, ...serverProfile };
        this.saveToLocalStorage(userId, merged);
        this.cache.set(`profile_${userId}`, {
          data: merged,
          timestamp: Date.now()
        });
        console.log('🔄 Профиль синхронизирован в фоне');
      }
    } catch (e) {
      console.warn('⚠️ Фоновая синхронизация не удалась:', e);
    }
  }

  saveToLocalStorage(userId, profile) {
    try {
      localStorage.setItem(`profile_${userId}`, JSON.stringify(profile));
    } catch (e) {
      console.warn('❌ Ошибка сохранения профиля в localStorage:', e);
    }
  }
}

window.profileOptimizer = new ProfileOptimizer();
