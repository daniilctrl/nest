import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);

  const configService = app.get(ConfigService);
  const port = configService.get<string>('NOTIFICATION_SERVICE_PORT');
  if (!port) {
    throw new Error(
      'NOTIFICATION_SERVICE_PORT environment variable is required',
    );
  }

  await app.listen(port);
}
bootstrap().catch((error: unknown) => {
  console.error('Failed to start notification-service:', error);
  process.exit(1);
});
