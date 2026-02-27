import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { BalanceResetService } from './balance-reset.service';

@ApiTags('Balance Reset')
@Controller('balance-reset')
export class BalanceResetController {
  constructor(private readonly balanceResetService: BalanceResetService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Enqueue user balance reset for all users' })
  resetAllBalances() {
    return this.balanceResetService.resetAllBalances();
  }
}
