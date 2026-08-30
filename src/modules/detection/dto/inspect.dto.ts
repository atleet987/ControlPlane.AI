import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { InspectionStage } from '../../../common/enums';

export class InspectDto {
  @ApiProperty({ example: 'support-copilot' })
  @IsString()
  useCaseId!: string;

  @ApiProperty({ enum: InspectionStage })
  @IsEnum(InspectionStage)
  stage!: InspectionStage;

  @ApiProperty({ description: 'Prompt or completion text to inspect.' })
  @IsString()
  @Length(1, 200_000)
  content!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Passages the content should be entailed by.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  groundingSources?: string[];

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
