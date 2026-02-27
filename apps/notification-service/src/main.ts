import { NestFactory } from '@nestjs/core';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error: unknown) => {
  console.error('Failed to start notification-service:', error);
  process.exit(1);
});
