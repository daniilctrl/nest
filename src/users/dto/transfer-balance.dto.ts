import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class TransferBalanceDto {
  @ApiProperty({
    description: 'Sender user ID',
    example: 'f9f5a11b-c338-4ee4-8d39-f4f20ac2d6e1',
  })
  @IsUUID()
  fromUserId: string;

  @ApiProperty({
    description: 'Receiver user ID',
    example: '1dd99f7d-b131-4491-ab80-89cfc84e3696',
  })
  @IsUUID()
  toUserId: string;

  @ApiProperty({
    description: 'Transfer amount in USD',
    example: 20.51,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must have at most 2 decimal places' },
  )
  @Min(0.01)
  amount: number;
}
