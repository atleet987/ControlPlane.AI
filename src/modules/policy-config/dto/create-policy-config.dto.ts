import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { RiskTier } from '../../../common/enums';
import { PolicyThresholds } from '../interfaces/policy.interface';

export class CreatePolicyConfigDto {
  @ApiProperty({ example: 'support-copilot' })
  @IsString()
  @Length(1, 128)
  useCaseId!: string;

  @ApiProperty({ example: 'Customer support copilot' })
  @IsString()
  @Length(1, 256)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: RiskTier, default: RiskTier.MEDIUM })
  @IsEnum(RiskTier)
  riskTier!: RiskTier;

  @ApiPropertyOptional({ description: 'Per-detector score bands.' })
  @IsObject()
  @IsOptional()
  thresholds?: PolicyThresholds;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  slowPathEnabled?: boolean;
}
