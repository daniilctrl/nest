import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TransferNotificationDocument =
  HydratedDocument<TransferNotification>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class TransferNotification {
  @Prop({ required: true, trim: true })
  fromUserId!: string;

  @Prop({ required: true, trim: true })
  toUserId!: string;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true })
  transferredAt!: Date;
}

export const TransferNotificationSchema =
  SchemaFactory.createForClass(TransferNotification);
