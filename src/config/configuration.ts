/**
 * Central typed configuration, loaded once at bootstrap from environment.
 * Access via `ConfigService.get<AppConfig>('app')` etc.
 */

export interface AppConfig {
  env: string;
  port: number;
  logLevel: string;
}

/**
 * Local dev runs on SQLite; production runs the same entities and schema on
 * MySQL. Only this block changes between the two — no application code does.
 */
export type DatabaseDriver = 'sqlite' | 'mysql';

export interface DatabaseConfig {
  driver: DatabaseDriver;
  /** SQLite only: path to the on-disk database file. */
  sqlitePath: string;
  /** MySQL only; ignored when the driver is sqlite. */
  mysql: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  /**
   * Full connection string. Upstash issues `rediss://` URLs; the `s` is what
   * turns on TLS in the client, so don't downgrade it to `redis://`.
   */
  url?: string;
  keyPrefix: string;
}

export interface DetectionConfig {
  fastPathTimeoutMs: number;
  slowPathTimeoutMs: number;
  slowPathEnabled: boolean;
}

/**
 * Slow-path LLM-as-judge configuration.
 *
 * The judge layer is model-agnostic: `provider` selects which implementation of
 * the JudgeProvider interface is bound, and everything else here is generic
 * (key, model id, timeout). Swapping vendors is a config change plus one class.
 */
export type JudgeProviderName = 'gemini';

export interface JudgeConfig {
  provider: JudgeProviderName;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface RootConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  detection: DetectionConfig;
  judge: JudgeConfig;
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value: string | undefined, fallback = false): boolean =>
  value === undefined || value === '' ? fallback : value.toLowerCase() === 'true';

export default (): RootConfig => {
  const driver: DatabaseDriver = process.env.DATABASE_DRIVER === 'mysql' ? 'mysql' : 'sqlite';

  return {
    app: {
      env: process.env.NODE_ENV ?? 'development',
      port: toInt(process.env.PORT, 3000),
      logLevel: process.env.LOG_LEVEL ?? 'debug',
    },
    database: {
      driver,
      sqlitePath: process.env.SQLITE_PATH ?? './data/controlplane.sqlite',
      mysql: {
        host: process.env.MYSQL_HOST ?? 'localhost',
        port: toInt(process.env.MYSQL_PORT, 3306),
        username: process.env.MYSQL_USER ?? 'controlplane',
        password: process.env.MYSQL_PASSWORD ?? 'controlplane',
        database: process.env.MYSQL_DATABASE ?? 'controlplane',
      },
      // SQLite dev has no migrations yet, so let TypeORM create the tables.
      // MySQL keeps this false — migrations own the production schema.
      synchronize: toBool(process.env.DATABASE_SYNCHRONIZE, driver === 'sqlite'),
      logging: toBool(process.env.DATABASE_LOGGING, false),
    },
    redis: {
      url: process.env.REDIS_URL || undefined,
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'cpai:',
    },
    detection: {
      fastPathTimeoutMs: toInt(process.env.DETECTION_FAST_PATH_TIMEOUT_MS, 150),
      // Measured judge latency is 2.5-20s against a live model, so the original
      // 3s budget would have cut off most verdicts. Sized above the judge's own
      // timeout; high-risk tiers await this inline, others reconcile via audit.
      slowPathTimeoutMs: toInt(process.env.DETECTION_SLOW_PATH_TIMEOUT_MS, 25000),
      slowPathEnabled: toBool(process.env.DETECTION_SLOW_PATH_ENABLED, true),
    },
    judge: {
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY ?? '',
      // gemini-2.5-flash is closed to new API keys — the endpoint 404s with a
      // pointer to 3.6-flash. Override with GEMINI_MODEL on a key that has it.
      model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
      // Kept below the slow-path lane budget so the provider gives up first and
      // the lane records a judge timeout rather than being cut off mid-call.
      timeoutMs: toInt(process.env.JUDGE_TIMEOUT_MS, 20000),
    },
  };
};
