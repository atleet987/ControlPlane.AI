import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class MessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant'] })
  @IsIn(['system', 'user', 'assistant'])
  role!: 'system' | 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content!: string;
}

/** Provider-agnostic request shape the gateway accepts from client apps. */
export class CompletionRequestDto {
  @ApiProperty({ example: 'support-copilot', description: 'Selects the policy to apply.' })
  @IsString()
  useCaseId!: string;

  @ApiProperty({ type: [MessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages!: MessageDto[];

  @ApiPropertyOptional({ description: 'Overrides the policy default model.' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ type: [String], description: 'Passages the answer must be grounded in.' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  groundingSources?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 2 })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
