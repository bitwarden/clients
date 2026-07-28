export const InitiationPath = Object.freeze({
  RegistrationForm: "Registration form",
  PasswordManagerTrialFromMarketingWebsite: "Password Manager trial from marketing website",
  SecretsManagerTrialFromMarketingWebsite: "Secrets Manager trial from marketing website",
  NewOrganizationCreationInProduct: "New organization creation in-product",
  UpgradeInProduct: "Upgrade in-product",
} as const);

export type InitiationPath = (typeof InitiationPath)[keyof typeof InitiationPath];
