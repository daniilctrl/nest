import { Injectable, Logger } from '@nestjs/common';
import { BalanceResetJob } from './balance-reset.job';

@Injectable()
export class BalanceResetService {
  private readonly logger = new Logger(BalanceResetService.name);

  constructor(private readonly balanceResetJob: BalanceResetJob) {}

  async resetAllBalances(): Promise<{ queued: boolean }> {
    await this.balanceResetJob.enqueue();
    this.logger.log('Manual balance reset enqueue requested');
    return { queued: true };
  }
}
