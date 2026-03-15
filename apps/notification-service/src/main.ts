import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);

  const configService = app.get(ConfigService);
  const brokersRaw = configService.getOrThrow<string>('KAFKA_BROKERS');
  const kafkaClientId = configService.getOrThrow<string>(
    'KAFKA_CLIENT_ID_NOTIFICATION_SERVICE',
  );
  const kafkaGroupId = configService.getOrThrow<string>(
    'KAFKA_CONSUMER_GROUP_NOTIFICATION',
  );

  const brokers = brokersRaw
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (brokers.length === 0) {
    throw new Error('KAFKA_BROKERS must contain at least one broker');
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: kafkaClientId,
        brokers,
      },
      consumer: {
        groupId: kafkaGroupId,
      },
    },
  });

  await app.startAllMicroservices();

  const port = configService.getOrThrow<string>('NOTIFICATION_SERVICE_PORT');

  await app.listen(port);
}
bootstrap().catch((error: unknown) => {
  console.error('Failed to start notification-service:', error);
  process.exit(1);
});
