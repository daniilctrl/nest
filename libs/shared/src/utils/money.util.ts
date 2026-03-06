import { CENTS_IN_DOLLAR } from '../constants/money.constants';

export function toCents(value: string | number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Math.round(numericValue * CENTS_IN_DOLLAR);
}

export function toBalanceValue(cents: number): string {
  return (cents / CENTS_IN_DOLLAR).toFixed(2);
}
