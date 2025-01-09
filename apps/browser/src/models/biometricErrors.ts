type BiometricError = {
  title: string;
  description: string;
};

export type BiometricErrorTypes =
  | "startDesktop"
  | "desktopIntegrationDisabled"
  | "not enabled"
  | "not supported"
  | "not unlocked"
  | "invalidateEncryption"
  | "userkey wrong"
  | "wrongUserId"
  | "not available";

export const BiometricErrors: Record<BiometricErrorTypes, BiometricError> = {
  startDesktop: {
    title: "startDesktopTitle",
    description: "startDesktopDesc",
  },
  desktopIntegrationDisabled: {
    title: "desktopIntegrationDisabledTitle",
    description: "desktopIntegrationDisabledDesc",
  },
  "not enabled": {
    title: "biometricsNotEnabledTitle",
    description: "biometricsNotEnabledDesc",
  },
  "not supported": {
    title: "biometricsNotSupportedTitle",
    description: "biometricsNotSupportedDesc",
  },
  "not unlocked": {
    title: "biometricsUnlockNotUnlockedTitle",
    description: "biometricsUnlockNotUnlockedDesc",
  },
  invalidateEncryption: {
    title: "nativeMessagingInvalidEncryptionTitle",
    description: "nativeMessagingInvalidEncryptionDesc",
  },
  "userkey wrong": {
    title: "nativeMessagingWrongUserKeyTitle",
    description: "nativeMessagingWrongUserKeyDesc",
  },
  wrongUserId: {
    title: "biometricsWrongUserTitle",
    description: "biometricsWrongUserDesc",
  },
  "not available": {
    title: "biometricsNotAvailableTitle",
    description: "biometricsNotAvailableDesc",
  },
};
