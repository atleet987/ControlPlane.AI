import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DecisionAction } from '../../../common/enums';

/** What the gateway returns, always annotated with what it did and why. */
export class CompletionResponseDto {
  @ApiProperty()
  traceId!: string;

  @ApiProperty({ enum: DecisionAction })
  action!: DecisionAction;

  @ApiPropertyOptional({ description: 'Absent when the request was blocked.' })
  content?: string;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiPropertyOptional({ description: 'Set when the call is held for human review.' })
  escalationId?: string;

  @ApiProperty()
  policyVersion!: number;

  @ApiProperty()
  latencyMs!: number;
}
