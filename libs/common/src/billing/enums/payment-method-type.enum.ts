// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum PaymentMethodType {
  Card = 0,
  BankAccount = 1,
  PayPal = 2,
  BitPay = 3,
  Credit = 4,
  WireTransfer = 5,
  Check = 8,
}
