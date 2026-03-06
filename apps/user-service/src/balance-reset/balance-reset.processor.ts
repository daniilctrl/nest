import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UsersService } from '../users/users.service';
import { BALANCE_RESET_QUEUE } from './constants';

@Injectable()
@Processor(BALANCE_RESET_QUEUE)
export class BalanceResetProcessor extends WorkerHost {
  private readonly logger = new Logger(BalanceResetProcessor.name);

  constructor(private readonly usersService: UsersService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.name} (${job.id ?? 'no-id'})`);
    await this.usersService.resetAllBalances();
    this.logger.log('All user balances were reset to 0.00');
  }
}
