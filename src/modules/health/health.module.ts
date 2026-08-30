import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AuditModule } from '../audit/audit.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, AuditModule],
  controllers: [HealthController],
})
export class HealthModule {}
