import { REDIS_MAX_RETRIES, buildRedisOptions, isTlsUrl } from './redis.options';

describe('buildRedisOptions', () => {
  it('enables TLS for an Upstash rediss:// URL', () => {
    const options = buildRedisOptions('rediss://default:token@eu1.upstash.io:6379', 'cpai:');

    expect(options.tls).toEqual({});
    expect(options.keyPrefix).toBe('cpai:');
    expect(options.lazyConnect).toBe(true);
  });

  it('omits TLS for a plaintext redis:// URL', () => {
    const options = buildRedisOptions('redis://localhost:6379', 'cpai:');

    expect(options.tls).toBeUndefined();
  });

  it('detects the TLS scheme', () => {
    expect(isTlsUrl('rediss://host:6379')).toBe(true);
    expect(isTlsUrl('redis://host:6379')).toBe(false);
  });

  it('backs off and then gives up rather than retrying forever', () => {
    const { retryStrategy } = buildRedisOptions('rediss://host:6379', 'cpai:');

    expect(retryStrategy).toBeDefined();
    expect(retryStrategy?.(1)).toBe(200);
    expect(retryStrategy?.(REDIS_MAX_RETRIES)).toBeLessThanOrEqual(2000);
    expect(retryStrategy?.(REDIS_MAX_RETRIES + 1)).toBeNull();
  });
});
