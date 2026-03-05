// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum TransactionType {
  Charge = 0,
  Credit = 1,
  PromotionalCredit = 2,
  ReferralCredit = 3,
  Refund = 4,
}
