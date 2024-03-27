import { StateDefinition } from "./state-definition";

/**
 * `StateDefinition`s comes with some rules, to facilitate a quick review from
 * platform of this file, ensure you follow these rules, the ones marked with (tested)
 * have unit tests that you can run locally.
 *
 * 1. (tested) Names should not be null or undefined
 * 2. (tested) Name and storage location should be unique
 * 3. (tested) Name and storage location can't differ from another export by only casing
 * 4. (tested) Name should be longer than 3 characters. It should be descriptive, but brief.
 * 5. (tested) Name should not contain spaces or underscores
 * 6. Name should be human readable
 * 7. Name should be in camelCase format (unit tests ensure the first character is lowercase)
 * 8. Teams should only use state definitions they have created
 * 9. StateDefinitions should only be used for keys relating to the state name they chose
 *
 */

// Admin Console

export const ORGANIZATIONS_DISK = new StateDefinition("organizations", "disk");
export const POLICIES_DISK = new StateDefinition("policies", "disk");
export const PROVIDERS_DISK = new StateDefinition("providers", "disk");
export const ORGANIZATION_MANAGEMENT_PREFERENCES_DISK = new StateDefinition(
  "organizationManagementPreferences",
  "disk",
  {
    web: "disk-local",
  },
);

// Billing
export const BILLING_DISK = new StateDefinition("billing", "disk");

// Auth

export const ACCOUNT_MEMORY = new StateDefinition("account", "memory");
export const AVATAR_DISK = new StateDefinition("avatar", "disk", { web: "disk-local" });
export const SSO_DISK = new StateDefinition("ssoLogin", "disk");
export const TOKEN_DISK = new StateDefinition("token", "disk");
export const TOKEN_DISK_LOCAL = new StateDefinition("tokenDiskLocal", "disk", {
  web: "disk-local",
});
export const TOKEN_MEMORY = new StateDefinition("token", "memory");
export const LOGIN_STRATEGY_MEMORY = new StateDefinition("loginStrategy", "memory");
export const USER_DECRYPTION_OPTIONS_DISK = new StateDefinition("userDecryptionOptions", "disk");

// Autofill

export const BADGE_SETTINGS_DISK = new StateDefinition("badgeSettings", "disk");
export const USER_NOTIFICATION_SETTINGS_DISK = new StateDefinition(
  "userNotificationSettings",
  "disk",
);

export const DOMAIN_SETTINGS_DISK = new StateDefinition("domainSettings", "disk");
export const AUTOFILL_SETTINGS_DISK = new StateDefinition("autofillSettings", "disk");
export const AUTOFILL_SETTINGS_DISK_LOCAL = new StateDefinition("autofillSettingsLocal", "disk", {
  web: "disk-local",
});

// Components

export const NEW_WEB_LAYOUT_BANNER_DISK = new StateDefinition("newWebLayoutBanner", "disk", {
  web: "disk-local",
});

// Platform

export const APPLICATION_ID_DISK = new StateDefinition("applicationId", "disk", {
  web: "disk-local",
});
export const BIOMETRIC_SETTINGS_DISK = new StateDefinition("biometricSettings", "disk");
export const CLEAR_EVENT_DISK = new StateDefinition("clearEvent", "disk");
export const CONFIG_DISK = new StateDefinition("config", "disk", {
  web: "disk-local",
});
export const CRYPTO_DISK = new StateDefinition("crypto", "disk");
export const CRYPTO_MEMORY = new StateDefinition("crypto", "memory");
export const DESKTOP_SETTINGS_DISK = new StateDefinition("desktopSettings", "disk");
export const ENVIRONMENT_DISK = new StateDefinition("environment", "disk");
export const ENVIRONMENT_MEMORY = new StateDefinition("environment", "memory");
export const THEMING_DISK = new StateDefinition("theming", "disk", { web: "disk-local" });
export const TRANSLATION_DISK = new StateDefinition("translation", "disk");

// Secrets Manager

export const SM_ONBOARDING_DISK = new StateDefinition("smOnboarding", "disk", {
  web: "disk-local",
});

// Tools

export const GENERATOR_DISK = new StateDefinition("generator", "disk");
export const GENERATOR_MEMORY = new StateDefinition("generator", "memory");
export const EVENT_COLLECTION_DISK = new StateDefinition("eventCollection", "disk");

// Vault

export const COLLECTION_DATA = new StateDefinition("collection", "disk", {
  web: "memory",
});
export const FOLDER_DISK = new StateDefinition("folder", "disk", { web: "memory" });
export const VAULT_FILTER_DISK = new StateDefinition("vaultFilter", "disk", {
  web: "disk-local",
});
export const VAULT_ONBOARDING = new StateDefinition("vaultOnboarding", "disk", {
  web: "disk-local",
});
export const VAULT_SETTINGS_DISK = new StateDefinition("vaultSettings", "disk", {
  web: "disk-local",
});
