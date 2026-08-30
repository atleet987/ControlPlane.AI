import { Module } from '@nestjs/common';
import { DecisionEngineService } from './decision-engine.service';
import { DECISION_RULES } from './interfaces';
import { ThresholdResolver } from './threshold.resolver';

@Module({
  providers: [
    DecisionEngineService,
    ThresholdResolver,
    {
      // Rules are registered here as they are implemented.
      provide: DECISION_RULES,
      useValue: [],
    },
  ],
  exports: [DecisionEngineService],
})
export class DecisionEngineModule {}
