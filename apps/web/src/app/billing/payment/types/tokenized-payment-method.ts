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

export type TokenizedPaymentMethod = {
  type: TokenizablePaymentMethod;
  token: string;
};
