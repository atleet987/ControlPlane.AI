import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyConfigEntity } from './entities/policy-config.entity';
import { PolicyConfigController } from './policy-config.controller';
import { PolicyConfigService } from './policy-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([PolicyConfigEntity])],
  controllers: [PolicyConfigController],
  providers: [PolicyConfigService],
  exports: [PolicyConfigService],
})
export class PolicyConfigModule {}
