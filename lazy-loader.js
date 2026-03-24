// Ленивая загрузка данных
class LazyLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }

  async loadIdioms() {
    if (this.cache.has('idioms')) return this.cache.get('idioms');
    if (this.loading.has('idioms')) return this.loading.get('idioms');

    const loadPromise = import('./idioms.json')
      .then(module => {
        const idioms = module.default;
        this.cache.set('idioms', idioms);
        this.loading.delete('idioms');
        console.log(`📚 Ленивая загрузка: ${idioms.length} идиом`);
        return idioms;
      });

    this.loading.set('idioms', loadPromise);
    return loadPromise;
  }

  async loadDictionary() {
    if (this.cache.has('dictionary')) return this.cache.get('dictionary');
    if (this.loading.has('dictionary')) return this.loading.get('dictionary');

    const loadPromise = fetch('./dictionary.json')
      .then(res => res.json())
      .then(dict => {
        this.cache.set('dictionary', dict);
        this.loading.delete('dictionary');
        console.log(`📖 Ленивая загрузка: словарь загружен`);
        return dict;
      });

    this.loading.set('dictionary', loadPromise);
    return loadPromise;
  }
}

window.lazyLoader = new LazyLoader();
