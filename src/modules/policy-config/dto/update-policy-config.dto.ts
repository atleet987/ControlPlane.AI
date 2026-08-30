import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { CreatePolicyConfigDto } from './create-policy-config.dto';

/** `useCaseId` is the identity of the policy and is not editable in place. */
export class UpdatePolicyConfigDto extends PartialType(
  OmitType(CreatePolicyConfigDto, ['useCaseId'] as const),
) {}
