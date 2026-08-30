import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/configuration';
import { buildRedisOptions, isTlsUrl } from './redis.options';

/**
 * Wraps a single long-lived ioredis client pointed at Upstash.
 *
 * Two deliberate choices:
 * - TLS is switched on from the URL scheme. Upstash only accepts `rediss://`,
 *   and ioredis does not infer TLS options from the scheme on its own.
 * - Connection is lazy and failures are logged, not thrown. Redis is a cache in
 *   front of policy lookups, so an unreachable cache must degrade to a slower
 *   database read rather than take the gateway down at boot.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const config = this.configService.getOrThrow<RedisConfig>('redis');

    if (!config.url) {
      this.logger.warn('REDIS_URL is not set — caching is disabled for this run.');
      return;
    }

    const options = buildRedisOptions(config.url, config.keyPrefix);

    if (!isTlsUrl(config.url)) {
      this.logger.warn(
        'REDIS_URL does not use the rediss:// scheme — Upstash requires TLS and will reject this connection.',
      );
    }

    this.client = new Redis(config.url, options);

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.client.on('ready', () => {
      this.logger.log('Redis connected.');
    });

    // Kick off the connection without blocking bootstrap on it.
    void this.client.connect().catch((error: unknown) => {
      this.logger.error(
        'Redis failed to connect; continuing without cache.',
        error instanceof Error ? error.message : String(error),
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => this.client?.disconnect());
    }
  }

  /** Undefined when REDIS_URL is unset — callers must fall back to the database. */
  getClient(): Redis | undefined {
    return this.client;
  }

  isReady(): boolean {
    return this.client?.status === 'ready';
  }
}
