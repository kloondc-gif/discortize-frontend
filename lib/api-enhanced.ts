/**
 * Enhanced API utilities with request deduplication and caching
 */

import { cache, CacheKeys, CacheDurations } from './cache';

// Track in-flight requests to prevent duplicate calls
const inflightRequests = new Map<string, Promise<any>>();

/**
 * Fetch with automatic deduplication - prevents multiple identical requests
 */
async function fetchWithDedup(url: string, options?: RequestInit): Promise<Response> {
  const key = `${url}_${JSON.stringify(options || {})}`;
  
  // If request is already in flight, return the existing promise
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key)!;
  }
  
  // Create new request
  const requestPromise = fetch(url, options).finally(() => {
    // Clean up after request completes
    inflightRequests.delete(key);
  });
  
  inflightRequests.set(key, requestPromise);
  return requestPromise;
}

/**
 * Get Discord client ID with caching
 */
export async function getDiscordClientId(): Promise<string> {
  // Check cache first
  const cached = cache.get<string>(CacheKeys.DISCORD_CLIENT_ID);
  if (cached) {
    return cached;
  }

  const response = await fetchWithDedup('http://localhost:8000/api/env/discord-client-id');
  if (response.ok) {
    const data = await response.json();
    // Cache for 1 hour (this rarely changes)
    cache.set(CacheKeys.DISCORD_CLIENT_ID, data.client_id, CacheDurations.STATIC);
    return data.client_id;
  }
  
  throw new Error('Failed to fetch Discord client ID');
}

/**
 * Check Discord connection with caching
 */
export async function checkDiscordConnection(token: string): Promise<{ connected: boolean; username?: string }> {
  // Cache for shorter duration since connection status can change
  const cached = cache.get<{ connected: boolean; username?: string }>(CacheKeys.DISCORD_CONNECTION);
  if (cached) {
    return cached;
  }

  const response = await fetchWithDedup('http://localhost:8000/api/discord/check-connection', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.ok) {
    const data = await response.json();
    // Cache for 5 minutes
    cache.set(CacheKeys.DISCORD_CONNECTION, data, CacheDurations.MEDIUM);
    return data;
  }
  
  return { connected: false };
}

/**
 * Fetch crypto configs with caching
 */
export async function getCryptoConfigs(token: string) {
  const cached = cache.get(CacheKeys.CRYPTO_CONFIGS);
  if (cached) {
    return cached;
  }

  const response = await fetchWithDedup('http://localhost:8000/api/crypto/config', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (response.ok) {
    const data = await response.json();
    // Cache for 5 minutes
    cache.set(CacheKeys.CRYPTO_CONFIGS, data, CacheDurations.MEDIUM);
    return data;
  }
  
  throw new Error('Failed to fetch crypto configs');
}

/**
 * Fetch invoices (with optional caching)
 */
export async function getInvoices(token: string, useCache: boolean = false) {
  if (useCache) {
    const cached = cache.get(CacheKeys.USER_INVOICES);
    if (cached) {
      return cached;
    }
  }

  const response = await fetchWithDedup('http://localhost:8000/api/crypto/invoices', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (response.ok) {
    const data = await response.json();
    if (useCache) {
      // Cache for 30 seconds
      cache.set(CacheKeys.USER_INVOICES, data, CacheDurations.SHORT);
    }
    return data;
  }
  
  throw new Error('Failed to fetch invoices');
}

/**
 * Invalidate specific cache entries
 */
export function invalidateCache(keys: string[]) {
  keys.forEach(key => cache.delete(key));
}

/**
 * Clear all cache (e.g., on logout)
 */
export function clearAllCache() {
  cache.clear();
}

// Token refresh functionality
let refreshInterval: NodeJS.Timeout | null = null;

export function startTokenRefresh() {
  if (refreshInterval) return;

  refreshInterval = setInterval(async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return;

      const response = await fetch('http://localhost:8000/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }, 14 * 60 * 1000); // Refresh every 14 minutes
}

export function stopTokenRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
