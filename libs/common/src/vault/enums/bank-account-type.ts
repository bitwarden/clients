const _BankAccountType = Object.freeze({
  Checking: "checking",
  Savings: "savings",
  CertificateOfDeposit: "certificateOfDeposit",
  LineOfCredit: "lineOfCredit",
  InvestmentBrokerage: "investmentBrokerage",
  MoneyMarket: "moneyMarket",
  Other: "other",
} as const);

type _BankAccountType = typeof _BankAccountType;

export type BankAccountType = _BankAccountType[keyof _BankAccountType];

export const BankAccountType: Record<keyof _BankAccountType, BankAccountType> = _BankAccountType;
