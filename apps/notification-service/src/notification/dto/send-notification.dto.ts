import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
