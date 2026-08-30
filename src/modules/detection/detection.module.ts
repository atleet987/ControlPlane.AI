import { Module } from '@nestjs/common';
import { PolicyConfigModule } from '../policy-config/policy-config.module';
import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';
import { FastPathService } from './fast-path/fast-path.service';
import { PiiDetector } from './fast-path/pii.detector';
import { PromptInjectionDetector } from './fast-path/prompt-injection.detector';
import { ToxicityDetector } from './fast-path/toxicity.detector';
import { FAST_PATH_DETECTORS, SLOW_PATH_DETECTORS } from './interfaces';
import { EntailmentDetector } from './slow-path/entailment.detector';
import { GeminiJudgeProvider } from './slow-path/judge/gemini-judge.provider';
import { JUDGE_PROVIDER } from './slow-path/judge/judge-provider.interface';
import { JudgeDetector } from './slow-path/judge.detector';
import { SlowPathService } from './slow-path/slow-path.service';

@Module({
  imports: [PolicyConfigModule],
  controllers: [DetectionController],
  providers: [
    DetectionService,
    FastPathService,
    SlowPathService,
    PiiDetector,
    ToxicityDetector,
    PromptInjectionDetector,
    EntailmentDetector,
    JudgeDetector,
    GeminiJudgeProvider,
    // The one place that names a judge vendor. ControlPlane.AI's AI-as-judge
    // layer is model-agnostic: binding a different JudgeProvider here — OpenAI,
    // Anthropic, a self-hosted model — swaps the provider for the whole
    // pipeline. No detector, rule or audit consumer changes.
    { provide: JUDGE_PROVIDER, useExisting: GeminiJudgeProvider },
    {
      provide: FAST_PATH_DETECTORS,
      useFactory: (
        pii: PiiDetector,
        toxicity: ToxicityDetector,
        injection: PromptInjectionDetector,
      ) => [pii, toxicity, injection],
      inject: [PiiDetector, ToxicityDetector, PromptInjectionDetector],
    },
    {
      provide: SLOW_PATH_DETECTORS,
      useFactory: (entailment: EntailmentDetector, judge: JudgeDetector) => [entailment, judge],
      inject: [EntailmentDetector, JudgeDetector],
    },
  ],
  exports: [DetectionService],
})
export class DetectionModule {}
