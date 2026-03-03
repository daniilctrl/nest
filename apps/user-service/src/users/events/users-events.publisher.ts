import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import {
  BALANCE_TRANSFERRED_TOPIC,
  type BalanceTransferredEvent,
} from '@app/shared';
import { firstValueFrom } from 'rxjs';
import { USERS_KAFKA_CLIENT } from '../users.constants';

@Injectable()
export class UsersEventsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsersEventsPublisher.name);
  private isConnected = false;

  constructor(
    @Inject(USERS_KAFKA_CLIENT) private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.connectIfNeeded();
    } catch {
      // Do not fail app startup if Kafka is temporarily unavailable.
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    await this.kafkaClient.close();
    this.isConnected = false;
  }

  async publishBalanceTransferred(
    event: BalanceTransferredEvent,
  ): Promise<void> {
    await this.connectIfNeeded();
    await firstValueFrom(
      this.kafkaClient.emit(BALANCE_TRANSFERRED_TOPIC, event),
    );
    this.logger.log(
      `Kafka event published to ${BALANCE_TRANSFERRED_TOPIC} (eventId=${event.eventId})`,
    );
  }

  private async connectIfNeeded(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.kafkaClient.connect();
      this.isConnected = true;
    } catch (error: unknown) {
      this.logger.warn(
        `Kafka producer connection is unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
