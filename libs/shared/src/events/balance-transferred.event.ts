export const BALANCE_TRANSFERRED_TOPIC = 'user.balance.transferred';

export interface BalanceTransferredEvent {
  eventId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  transferredAt: string;
}
