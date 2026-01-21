import { PaymentMethodType } from "@bitwarden/common/billing/enums";

export const TokenizablePaymentMethods = {
  bankAccount: "bankAccount",
  card: "card",
  payPal: "payPal",
} as const;

export const NonTokenizablePaymentMethods = {
  accountCredit: "accountCredit",
} as const;

export type BankAccountPaymentMethod = typeof TokenizablePaymentMethods.bankAccount;
export type CardPaymentMethod = typeof TokenizablePaymentMethods.card;
export type PayPalPaymentMethod = typeof TokenizablePaymentMethods.payPal;
export type AccountCreditPaymentMethod = typeof NonTokenizablePaymentMethods.accountCredit;

export type TokenizablePaymentMethod =
  (typeof TokenizablePaymentMethods)[keyof typeof TokenizablePaymentMethods];
export type NonTokenizablePaymentMethod =
  (typeof NonTokenizablePaymentMethods)[keyof typeof NonTokenizablePaymentMethods];

export const isTokenizablePaymentMethod = (value: string): value is TokenizablePaymentMethod => {
  const valid = Object.values(TokenizablePaymentMethods) as readonly string[];
  return valid.includes(value);
};

export const tokenizablePaymentMethodToLegacyEnum = (
  paymentMethod: TokenizablePaymentMethod,
): PaymentMethodType => {
  switch (paymentMethod) {
    case "bankAccount":
      return PaymentMethodType.BankAccount;
    case "card":
      return PaymentMethodType.Card;
    case "payPal":
      return PaymentMethodType.PayPal;
  }
};

export type TokenizedPaymentMethod = {
  type: TokenizablePaymentMethod;
  token: string;
};

export type NonTokenizedPaymentMethod = {
  type: NonTokenizablePaymentMethod;
};
