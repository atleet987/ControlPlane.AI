import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { dirname } from 'node:path';
import configuration, { DatabaseConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AuditModule } from './modules/audit/audit.module';
import { DecisionEngineModule } from './modules/decision-engine/decision-engine.module';
import { DetectionModule } from './modules/detection/detection.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { HealthModule } from './modules/health/health.module';
import { PolicyConfigModule } from './modules/policy-config/policy-config.module';
import { RedisModule } from './modules/redis/redis.module';

/**
 * Local dev uses SQLite; production uses MySQL. Both run the same entities and
 * the same schema — this factory is the only thing that differs between them.
 */
function buildDataSourceOptions(database: DatabaseConfig): TypeOrmModuleOptions {
  const shared = {
    autoLoadEntities: true,
    synchronize: database.synchronize,
    logging: database.logging,
  };

  if (database.driver === 'mysql') {
    return {
      type: 'mysql' as const,
      host: database.mysql.host,
      port: database.mysql.port,
      username: database.mysql.username,
      password: database.mysql.password,
      database: database.mysql.database,
      retryAttempts: 5,
      retryDelay: 3000,
      ...shared,
    };
  }

  // sql.js is a pure-WASM SQLite build: no native module, no compiler toolchain
  // and no service to run, which is what makes local dev dependency-free.
  // `autoSave` flushes the in-memory database back to the file on every write.
  mkdirSync(dirname(database.sqlitePath), { recursive: true });

  return {
    type: 'sqljs' as const,
    // Passed explicitly: TypeORM's own require() of sql.js comes back wrapped in
    // an ESM interop object, and the driver then calls a non-function.
    driver: initSqlJs,
    location: database.sqlitePath,
    autoSave: true,
    ...shared,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildDataSourceOptions(configService.getOrThrow<DatabaseConfig>('database')),
    }),
    RedisModule,
    HealthModule,
    PolicyConfigModule,
    DetectionModule,
    DecisionEngineModule,
    AuditModule,
    GatewayModule,
  ],
})
export class AppModule {}
