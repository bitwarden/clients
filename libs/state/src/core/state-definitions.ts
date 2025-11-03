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
export const DELETE_MANAGED_USER_WARNING = new StateDefinition(
  "showDeleteManagedUserWarning",
  "disk",
  {
    web: "disk-local",
  },
);
export const AUTO_CONFIRM = new StateDefinition("autoConfirm", "disk");

// Billing
export const BILLING_DISK = new StateDefinition("billing", "disk");

// Auth

export const ACCOUNT_DISK = new StateDefinition("account", "disk");
export const ACCOUNT_MEMORY = new StateDefinition("account", "memory");
export const AUTH_REQUEST_DISK_LOCAL = new StateDefinition("authRequestLocal", "disk", {
  web: "disk-local",
});
export const AVATAR_DISK = new StateDefinition("avatar", "disk", { web: "disk-local" });
export const DEVICE_TRUST_DISK_LOCAL = new StateDefinition("deviceTrust", "disk", {
  web: "disk-local",
  browser: "disk-backup-local-storage",
});
export const KDF_CONFIG_DISK = new StateDefinition("kdfConfig", "disk");
export const KEY_CONNECTOR_DISK = new StateDefinition("keyConnector", "disk");
export const LOGIN_EMAIL_DISK = new StateDefinition("loginEmail", "disk", {
  web: "disk-local",
});
export const LOGIN_EMAIL_MEMORY = new StateDefinition("loginEmail", "memory");
export const LOGIN_STRATEGY_MEMORY = new StateDefinition("loginStrategy", "memory");
export const MASTER_PASSWORD_DISK = new StateDefinition("masterPassword", "disk");
export const MASTER_PASSWORD_MEMORY = new StateDefinition("masterPassword", "memory");
export const MASTER_PASSWORD_UNLOCK_DISK = new StateDefinition("masterPasswordUnlock", "disk");
export const PIN_DISK = new StateDefinition("pinUnlock", "disk");
export const PIN_MEMORY = new StateDefinition("pinUnlock", "memory");
export const ROUTER_DISK = new StateDefinition("router", "disk");
export const SSO_DISK = new StateDefinition("ssoLogin", "disk");
export const SSO_DISK_LOCAL = new StateDefinition("ssoLoginLocal", "disk", { web: "disk-local" });
export const TOKEN_DISK = new StateDefinition("token", "disk");
export const TOKEN_DISK_LOCAL = new StateDefinition("tokenDiskLocal", "disk", {
  web: "disk-local",
});
export const TOKEN_MEMORY = new StateDefinition("token", "memory");
export const SEND_ACCESS_DISK = new StateDefinition("sendAccess", "disk");
export const TWO_FACTOR_MEMORY = new StateDefinition("twoFactor", "memory");
export const USER_DECRYPTION_OPTIONS_DISK = new StateDefinition("userDecryptionOptions", "disk");
export const ORGANIZATION_INVITE_DISK = new StateDefinition("organizationInvite", "disk");
export const VAULT_TIMEOUT_SETTINGS_DISK_LOCAL = new StateDefinition(
  "vaultTimeoutSettings",
  "disk",
  {
    web: "disk-local",
  },
);

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

export const AUTOTYPE_SETTINGS_DISK = new StateDefinition("autotypeSettings", "disk");

// Components

export const NEW_WEB_LAYOUT_BANNER_DISK = new StateDefinition("newWebLayoutBanner", "disk", {
  web: "disk-local",
});

// DIRT

export const PHISHING_DETECTION_DISK = new StateDefinition("phishingDetection", "disk");

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
export const POPUP_VIEW_MEMORY = new StateDefinition("popupView", "memory", {
  browser: "memory-large-object",
});
export const SYNC_DISK = new StateDefinition("sync", "disk", { web: "memory" });
export const THEMING_DISK = new StateDefinition("theming", "disk", { web: "disk-local" });
export const TRANSLATION_DISK = new StateDefinition("translation", "disk", { web: "disk-local" });
export const ANIMATION_DISK = new StateDefinition("animation", "disk");
export const TASK_SCHEDULER_DISK = new StateDefinition("taskScheduler", "disk");
export const EXTENSION_INITIAL_INSTALL_DISK = new StateDefinition(
  "extensionInitialInstall",
  "disk",
);
export const WEB_PUSH_SUBSCRIPTION = new StateDefinition("webPushSubscription", "disk", {
  web: "disk-local",
});

// Design System

export const POPUP_STYLE_DISK = new StateDefinition("popupStyle", "disk");

// Secrets Manager

export const SM_ONBOARDING_DISK = new StateDefinition("smOnboarding", "disk", {
  web: "disk-local",
});

// Tools

export const EXTENSION_DISK = new StateDefinition("extension", "disk");
export const GENERATOR_DISK = new StateDefinition("generator", "disk");
export const GENERATOR_MEMORY = new StateDefinition("generator", "memory");
export const BROWSER_SEND_MEMORY = new StateDefinition("sendBrowser", "memory");
export const EVENT_COLLECTION_DISK = new StateDefinition("eventCollection", "disk");
export const SEND_DISK = new StateDefinition("encryptedSend", "disk", {
  web: "memory",
});
export const SEND_MEMORY = new StateDefinition("decryptedSend", "memory", {
  browser: "memory-large-object",
});
export const SEND_ACCESS_AUTH_MEMORY = new StateDefinition("sendAccessAuth", "memory");

// Vault

export const COLLECTION_DISK = new StateDefinition("collection", "disk", {
  web: "memory",
});
export const COLLECTION_MEMORY = new StateDefinition("decryptedCollections", "memory", {
  browser: "memory-large-object",
});

export const FOLDER_DISK = new StateDefinition("folder", "disk", { web: "memory" });
export const FOLDER_MEMORY = new StateDefinition("decryptedFolders", "memory", {
  browser: "memory-large-object",
});
export const VAULT_FILTER_DISK = new StateDefinition("vaultFilter", "disk", {
  web: "disk-local",
});
export const VAULT_ONBOARDING = new StateDefinition("vaultOnboarding", "disk", {
  web: "disk-local",
});
export const VAULT_SETTINGS_DISK = new StateDefinition("vaultSettings", "disk", {
  web: "disk-local",
});
export const VAULT_BROWSER_MEMORY = new StateDefinition("vaultBrowser", "memory", {
  browser: "memory-large-object",
});
export const VAULT_SEARCH_MEMORY = new StateDefinition("vaultSearch", "memory", {
  browser: "memory-large-object",
});
export const CIPHERS_DISK = new StateDefinition("ciphers", "disk", { web: "memory" });
export const CIPHERS_DISK_LOCAL = new StateDefinition("ciphersLocal", "disk", {
  web: "disk-local",
});
export const CIPHERS_MEMORY = new StateDefinition("ciphersMemory", "memory", {
  browser: "memory-large-object",
});
export const PREMIUM_BANNER_DISK_LOCAL = new StateDefinition("premiumBannerReprompt", "disk", {
  web: "disk-local",
});
export const BANNERS_DISMISSED_DISK = new StateDefinition("bannersDismissed", "disk");
export const VAULT_APPEARANCE = new StateDefinition("vaultAppearance", "disk");
export const SECURITY_TASKS_DISK = new StateDefinition("securityTasks", "disk");
export const AT_RISK_PASSWORDS_PAGE_DISK = new StateDefinition("atRiskPasswordsPage", "disk");
export const NOTIFICATION_DISK = new StateDefinition("notifications", "disk");
export const NUDGES_DISK = new StateDefinition("nudges", "disk", { web: "disk-local" });
export const SETUP_EXTENSION_DISMISSED_DISK = new StateDefinition(
  "setupExtensionDismissed",
  "disk",
  {
    web: "disk-local",
  },
);
export const VAULT_BROWSER_INTRO_CAROUSEL = new StateDefinition(
  "vaultBrowserIntroCarousel",
  "disk",
);
export const VAULT_AT_RISK_PASSWORDS_MEMORY = new StateDefinition("vaultAtRiskPasswords", "memory");
