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

export const BankAccountTypeI18nKeys: Record<BankAccountType, string> = {
  checking: "bankAccountTypeChecking",
  savings: "bankAccountTypeSavings",
  certificateOfDeposit: "bankAccountTypeCertificateOfDeposit",
  lineOfCredit: "bankAccountTypeLineOfCredit",
  investmentBrokerage: "bankAccountTypeInvestmentBrokerage",
  moneyMarket: "bankAccountTypeMoneyMarket",
  other: "bankAccountTypeOther",
};
