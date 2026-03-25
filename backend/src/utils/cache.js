/**
 * Lightweight In-Memory TTL Cache
 * Used for rate-limiting expensive DB queries (e.g., global analytics) across workers.
 */

class TTLCache {
  constructor(defaultTtlSeconds = 60) {
    this.cache = new Map();
    this.defaultTtl = defaultTtlSeconds * 1000;
  }

  set(key, value, ttlSeconds = null) {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + ttl,
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

// Singleton cache instance
const apiCache = new TTLCache();

module.exports = apiCache;
