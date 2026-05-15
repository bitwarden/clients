export const FormCategory = Object.freeze({
  Login: "login",
  AccountCreation: "accountCreation",
  CreditCard: "creditCard",
  Identity: "identity",
} as const);
export type FormCategory = (typeof FormCategory)[keyof typeof FormCategory];
