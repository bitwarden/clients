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

// FIXME: Update typing of `BankAccountType` to be `Record<keyof _BankAccountType, BankAccountType>` which is ADR-0025 compliant when the TypeScript version is at least 5.8.
export const BankAccountType: typeof _BankAccountType = _BankAccountType;
