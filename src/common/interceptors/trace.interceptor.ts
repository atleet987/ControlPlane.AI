import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const TRACE_ID_HEADER = 'x-trace-id';

/**
 * Ensures every request carries a traceId in and out, so gateway logs, decision
 * records and Kafka audit events can be stitched together after the fact.
 */
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const traceId = (request.headers[TRACE_ID_HEADER] as string) || randomUUID();
    request.headers[TRACE_ID_HEADER] = traceId;
    response.setHeader(TRACE_ID_HEADER, traceId);

    const startedAt = Date.now();
    return next.handle().pipe(
      tap(() => {
        response.setHeader('x-processing-ms', String(Date.now() - startedAt));
      }),
    );
  }
}
