import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BALANCE_RESET_JOB,
  BALANCE_RESET_QUEUE,
  BALANCE_RESET_REPEAT_EVERY_MS,
  BALANCE_RESET_REPEAT_JOB_ID,
} from './constants';

@Injectable()
export class BalanceResetJob implements OnModuleInit {
  private readonly logger = new Logger(BalanceResetJob.name);

  constructor(
    @InjectQueue(BALANCE_RESET_QUEUE)
    private readonly balanceResetQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureRepeatable();
  }

  async enqueue(): Promise<void> {
    await this.balanceResetQueue.add(
      BALANCE_RESET_JOB,
      {},
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('Balance reset job enqueued');
  }

  async ensureRepeatable(): Promise<void> {
    await this.balanceResetQueue.add(
      BALANCE_RESET_JOB,
      {},
      {
        jobId: BALANCE_RESET_REPEAT_JOB_ID,
        repeat: { every: BALANCE_RESET_REPEAT_EVERY_MS },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('Repeatable balance reset job is configured');
  }
}
