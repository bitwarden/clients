export const InitiationPath = Object.freeze({
  RegistrationForm: "Registration form",
  PasswordManagerTrialFromMarketingWebsite: "Password Manager trial from marketing website",
  SecretsManagerTrialFromMarketingWebsite: "Secrets Manager trial from marketing website",
  NewOrganizationCreationInProduct: "New organization creation in-product",
  UpgradeInProduct: "Upgrade in-product",
  SalesAssistedTrialFromAdminPortal: "Sales assisted trial from admin portal",
} as const);

export type InitiationPath = (typeof InitiationPath)[keyof typeof InitiationPath];
