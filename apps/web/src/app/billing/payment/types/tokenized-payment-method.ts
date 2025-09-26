import { PaymentMethodType } from "@bitwarden/common/billing/enums";

export const TokenizablePaymentMethods = {
  bankAccount: "bankAccount",
  card: "card",
  payPal: "payPal",
} as const;

export type BankAccountPaymentMethod = typeof TokenizablePaymentMethods.bankAccount;
export type CardPaymentMethod = typeof TokenizablePaymentMethods.card;
export type PayPalPaymentMethod = typeof TokenizablePaymentMethods.payPal;

export type TokenizablePaymentMethod =
  (typeof TokenizablePaymentMethods)[keyof typeof TokenizablePaymentMethods];

export const isTokenizablePaymentMethod = (value: string): value is TokenizablePaymentMethod => {
  const valid = Object.values(TokenizablePaymentMethods) as readonly string[];
  return valid.includes(value);
};

export const tokenizablePaymentMethodFromLegacyEnum = (
  legacyEnum: PaymentMethodType,
): TokenizablePaymentMethod | null => {
  switch (legacyEnum) {
    case PaymentMethodType.BankAccount:
      return "bankAccount";
    case PaymentMethodType.Card:
      return "card";
    case PaymentMethodType.PayPal:
      return "payPal";
    default:
      return null;
  }
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
