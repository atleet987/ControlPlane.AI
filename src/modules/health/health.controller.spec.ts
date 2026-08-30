import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    })
      .useMocker((token) => {
        if (token === RedisService) {
          return { isReady: () => false };
        }
        if (token === AuditService) {
          return { transport: 'database' };
        }
        return undefined;
      })
      .compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('reports liveness', () => {
    expect(controller.live().status).toBe('ok');
  });

  it('reports the active audit transport', () => {
    expect(controller.ready().auditTransport).toBe('database');
  });
});
