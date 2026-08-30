import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';

/**
 * Boots the real AppModule against a throwaway SQLite file. This is the check
 * that local dev needs no Docker, no Kafka and no reachable Redis.
 */
describe('App bootstrap (e2e)', () => {
  let app: INestApplication;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cpai-e2e-'));
    process.env.SQLITE_PATH = join(tempDir, 'test.sqlite');
    process.env.DATABASE_DRIVER = 'sqlite';
    process.env.DATABASE_SYNCHRONIZE = 'true';
    delete process.env.REDIS_URL;

    // Imported after the env is set so configuration() reads these values.
    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /health returns ok', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(200);

    expect((response.body as { status: string }).status).toBe('ok');
  });

  it('GET /health/ready reports the database audit transport', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/health/ready')
      .expect(200);

    const body = response.body as { auditTransport: string; redis: string };
    expect(body.auditTransport).toBe('database');
    expect(body.redis).toBe('unavailable');
  });
});
