import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BALANCE_RESET_QUEUE } from './constants';
import { BalanceResetController } from './balance-reset.controller';
import { BalanceResetService } from './balance-reset.service';
import { BalanceResetJob } from './balance-reset.job';
import { BalanceResetProcessor } from './balance-reset.processor';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: BALANCE_RESET_QUEUE }),
    UsersModule,
  ],
  controllers: [BalanceResetController],
  providers: [BalanceResetService, BalanceResetJob, BalanceResetProcessor],
})
export class BalanceResetModule {}
