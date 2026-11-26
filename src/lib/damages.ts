/**
 * Damages found at return: the fee is kept from the caution (never more than the
 * franchise of the contract); what the caution does not cover is still owed.
 */
export type Settlement = {
  /** Damage fee, capped at the franchise. */
  fee: number;
  /** Part of the fee kept from the caution. */
  kept: number;
  /** Caution to give back. */
  refund: number;
  /** What the client still pays now: rental balance + fee not covered by the caution. */
  toPay: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function settleReturn({ due, deposit, fee, franchise }: { due: number; deposit: number; fee: number; franchise: number }): Settlement {
  const f = round(Math.max(0, Math.min(fee, franchise)));
  const d = round(Math.max(0, deposit));
  const kept = Math.min(f, d);
  return { fee: f, kept, refund: round(d - kept), toPay: round(Math.max(0, due) + f - kept) };
}
