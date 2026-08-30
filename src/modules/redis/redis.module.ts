import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Global: policy-config and detection both cache through this one client. */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
