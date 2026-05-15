const _FormCategory = Object.freeze({
  Login: "login",
  AccountCreation: "accountCreation",
  CreditCard: "creditCard",
  Identity: "identity",
} as const);

type _FormCategory = typeof _FormCategory;

export type FormCategory = _FormCategory[keyof _FormCategory];

// FIXME: Update typing of `FormCategory` to be `Record<keyof _FormCategory, FormCategory>` which is ADR-0025 compliant when the TypeScript version is at least 5.8.
export const FormCategory: typeof _FormCategory = _FormCategory;
