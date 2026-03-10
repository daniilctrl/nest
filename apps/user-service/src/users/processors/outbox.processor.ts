import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { UsersEventsPublisher } from '../events/users-events.publisher';
import { BalanceTransferredEvent } from '@app/shared';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    private readonly usersEventsPublisher: UsersEventsPublisher,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async processOutboxEvents() {
    const events = await this.outboxRepository.find({
      take: 100,
      order: { createdAt: 'ASC' },
    });

    if (events.length === 0) {
      return;
    }

    this.logger.debug(`Found ${events.length} outbox events to process`);

    for (const event of events) {
      try {
        if (event.topic === 'balance.transferred') {
          const payload = event.payload as unknown as BalanceTransferredEvent;
          await this.usersEventsPublisher.publishBalanceTransferred(payload);
        } else {
          this.logger.warn(`Unknown outbox event topic: ${event.topic}`);
        }

        // Remove the successfully processed event block. No transaction here,
        // to not block if Kafka fails on next message. At-least-once delivery.
        await this.outboxRepository.remove(event);
      } catch (error) {
        this.logger.error(
          `Failed to process outbox event ${event.id}: ${
            error instanceof Error ? error.stack : String(error)
          }`,
        );
        // Break to avoid processing newer messages if Kafka is down
        break;
      }
    }
  }
}
