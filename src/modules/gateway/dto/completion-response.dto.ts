import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DecisionAction, InspectionStage } from '../../../common/enums';
import { DetectionSignal } from '../../../common/interfaces';
import { ContentEdit } from '../../decision-engine/interfaces';

/** What the gateway returns, always annotated with what it did and why. */
export class CompletionResponseDto {
  @ApiProperty()
  traceId!: string;

  @ApiProperty({ enum: DecisionAction })
  action!: DecisionAction;

  @ApiPropertyOptional({ description: 'Absent when the call is held for review.' })
  content?: string;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty({ description: 'The signals that drove the action.' })
  signals!: DetectionSignal[];

  @ApiPropertyOptional({ description: 'Redactions applied, for the EDIT tier.' })
  edits?: ContentEdit[];

  @ApiPropertyOptional({ description: 'Set when the call is held for human review.' })
  escalationId?: string;

  @ApiPropertyOptional({ description: 'Original text awaiting review, for the ESCALATE tier.' })
  heldContent?: string;

  @ApiProperty({ enum: InspectionStage, description: 'Which stage produced the decision.' })
  stage!: InspectionStage;

  @ApiProperty()
  policyVersion!: number;

  @ApiProperty()
  latencyMs!: number;
}
