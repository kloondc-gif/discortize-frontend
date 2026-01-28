/**
 * Simple frontend cache utility for reducing redundant API calls
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

class FrontendCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get cached data if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.expiresIn) {
      // Cache expired, remove it
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with expiration time
   */
  set<T>(key: string, data: T, expiresIn: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn
    });
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if cache has valid entry
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// Singleton instance
export const cache = new FrontendCache();

// Cache keys
export const CacheKeys = {
  DISCORD_CLIENT_ID: 'discord_client_id',
  DISCORD_CONNECTION: 'discord_connection',
  CRYPTO_CONFIGS: 'crypto_configs',
  USER_INVOICES: 'user_invoices',
  USER_BALANCE: 'user_balance',
};

// Cache durations (in milliseconds)
export const CacheDurations = {
  STATIC: 60 * 60 * 1000, // 1 hour for static data like client IDs
  MEDIUM: 5 * 60 * 1000,   // 5 minutes for semi-static data like configs
  SHORT: 30 * 1000,         // 30 seconds for dynamic data like balances
};
