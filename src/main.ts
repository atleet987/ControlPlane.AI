import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TraceInterceptor } from './common/interceptors/trace.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const { port, env } = configService.getOrThrow<AppConfig>('app');

  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });

  // Demo UI, served by the gateway itself so the video needs no second server.
  // Static assets sit outside the global API prefix.
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/demo' });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TraceInterceptor());

  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ControlPlane.AI')
      .setDescription('Policy-driven middleware between client applications and LLM APIs.')
      .setVersion('0.1.0')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`ControlPlane.AI listening on http://localhost:${port} (env=${env})`);
  if (env !== 'production') {
    logger.log(`API docs at http://localhost:${port}/docs`);
    logger.log(`Demo UI at http://localhost:${port}/demo/`);
  }
}

void bootstrap();
