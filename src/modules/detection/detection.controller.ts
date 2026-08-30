import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DetectionService } from './detection.service';
import { InspectDto } from './dto';
import { DetectionResult } from './interfaces';

/**
 * Direct detection endpoint, exposed for debugging and for callers that want
 * signals without the gateway's decisioning wrapped around them.
 */
@ApiTags('detection')
@Controller('detection')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post('inspect')
  @ApiOperation({ summary: 'Run detection over a piece of content' })
  inspect(@Body() _dto: InspectDto): Promise<DetectionResult> {
    // TODO: map DTO -> InspectionContext (resolving policy for the risk tier).
    throw new Error('DetectionController.inspect not implemented');
  }
}
