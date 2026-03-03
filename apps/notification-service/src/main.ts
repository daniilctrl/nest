import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BALANCE_TRANSFERRED_TOPIC } from '@app/shared';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);

  const configService = app.get(ConfigService);
  const brokersRaw = configService.get<string>('KAFKA_BROKERS');
  const kafkaClientId = configService.get<string>(
    'KAFKA_CLIENT_ID_NOTIFICATION_SERVICE',
  );
  const kafkaGroupId = configService.get<string>(
    'KAFKA_CONSUMER_GROUP_NOTIFICATION',
  );

  if (brokersRaw && kafkaClientId && kafkaGroupId) {
    const brokers = brokersRaw
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);

    if (brokers.length > 0) {
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
    }
  } else {
    console.warn(
      `Kafka consumer is disabled. Set KAFKA_BROKERS, KAFKA_CLIENT_ID_NOTIFICATION_SERVICE and KAFKA_CONSUMER_GROUP_NOTIFICATION to enable it. Using topic "${BALANCE_TRANSFERRED_TOPIC}".`,
    );
  }

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
