import { RedisOptions } from 'ioredis';

/** Give up after this many consecutive connection failures. */
export const REDIS_MAX_RETRIES = 5;

/**
 * Builds ioredis options from a connection string.
 *
 * TLS is derived from the scheme: Upstash issues `rediss://` URLs and rejects
 * plaintext connections, and ioredis does not turn TLS on from the scheme by
 * itself — the `tls` option has to be present.
 */
export function buildRedisOptions(url: string, keyPrefix: string): RedisOptions {
  return {
    keyPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    // Fail a cache read immediately when disconnected instead of queueing it —
    // the caller falls back to the database, which is faster than waiting.
    enableOfflineQueue: false,
    // Bounded backoff. ioredis retries forever by default, which turns a bad
    // URL into an endless error log; returning null stops the client instead.
    retryStrategy: (times: number) =>
      times > REDIS_MAX_RETRIES ? null : Math.min(times * 200, 2000),
    ...(isTlsUrl(url) ? { tls: {} } : {}),
  };
}

export function isTlsUrl(url: string): boolean {
  return url.startsWith('rediss://');
}
