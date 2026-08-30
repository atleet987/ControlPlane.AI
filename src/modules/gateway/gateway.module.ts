import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DecisionEngineModule } from '../decision-engine/decision-engine.module';
import { DetectionModule } from '../detection/detection.module';
import { PolicyConfigModule } from '../policy-config/policy-config.module';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

@Module({
  imports: [PolicyConfigModule, DetectionModule, DecisionEngineModule, AuditModule],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
