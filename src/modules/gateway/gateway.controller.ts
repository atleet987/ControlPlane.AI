import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TRACE_ID_HEADER } from '../../common/interceptors/trace.interceptor';
import { CompletionRequestDto, CompletionResponseDto } from './dto';
import { GatewayService } from './gateway.service';

@ApiTags('gateway')
@Controller('v1')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('completions')
  @ApiOperation({ summary: 'Policy-checked completion through the control plane' })
  complete(
    @Body() dto: CompletionRequestDto,
    @Headers(TRACE_ID_HEADER) traceId: string,
  ): Promise<CompletionResponseDto> {
    return this.gatewayService.complete(dto, traceId);
  }
}
