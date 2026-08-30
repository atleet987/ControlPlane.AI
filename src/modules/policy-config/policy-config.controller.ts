import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePolicyConfigDto, UpdatePolicyConfigDto } from './dto';
import { PolicyConfigEntity } from './entities/policy-config.entity';
import { PolicyConfigService } from './policy-config.service';

@ApiTags('policy-config')
@Controller('policies')
export class PolicyConfigController {
  constructor(private readonly policyConfigService: PolicyConfigService) {}

  @Post()
  @ApiOperation({ summary: 'Create a policy for a use-case' })
  create(@Body() dto: CreatePolicyConfigDto): Promise<PolicyConfigEntity> {
    return this.policyConfigService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List active policies' })
  findAll(): Promise<PolicyConfigEntity[]> {
    return this.policyConfigService.findAll();
  }

  @Get(':useCaseId')
  @ApiOperation({ summary: 'Fetch the active policy for a use-case' })
  findOne(@Param('useCaseId') useCaseId: string): Promise<PolicyConfigEntity> {
    return this.policyConfigService.findOne(useCaseId);
  }

  @Patch(':useCaseId')
  @ApiOperation({ summary: 'Update a policy, creating a new version' })
  update(
    @Param('useCaseId') useCaseId: string,
    @Body() dto: UpdatePolicyConfigDto,
  ): Promise<PolicyConfigEntity> {
    return this.policyConfigService.update(useCaseId, dto);
  }

  @Delete(':useCaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a policy (soft)' })
  deactivate(@Param('useCaseId') useCaseId: string): Promise<void> {
    return this.policyConfigService.deactivate(useCaseId);
  }
}
