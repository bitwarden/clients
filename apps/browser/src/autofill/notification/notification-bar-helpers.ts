import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { I18n } from "../content/components/common-types";

import {
  NotificationBarIframeInitData,
  NotificationType,
  NotificationTypes,
} from "./abstractions/notification-bar";

export function getNotificationHeaderMessage(i18n: I18n, type?: NotificationType) {
  if (!type) {
    return undefined;
  }
  const messages = {
    [NotificationTypes.Add]: i18n.saveLogin,
    [NotificationTypes.Change]: i18n.updateLogin,
    [NotificationTypes.Unlock]: i18n.unlockToSave,
    [NotificationTypes.AtRiskPassword]: i18n.atRiskPassword,
  };
  return messages[type];
}

export function getConfirmationHeaderMessage(i18n: I18n, type?: NotificationType, error?: string) {
  if (error) {
    return i18n.saveFailure;
  }
  if (!type) {
    return undefined;
  }
  const messages = {
    [NotificationTypes.Add]: i18n.loginSaveSuccess,
    [NotificationTypes.Change]: i18n.loginUpdateSuccess,
    [NotificationTypes.Unlock]: "",
    [NotificationTypes.AtRiskPassword]: "",
  };
  return messages[type];
}

export function getNotificationTestId(notificationType: NotificationType, isConfirmation = false) {
  if (isConfirmation) {
    return "confirmation-notification-bar";
  }
  const testIds = {
    [NotificationTypes.Unlock]: "unlock-notification-bar",
    [NotificationTypes.Add]: "save-notification-bar",
    [NotificationTypes.Change]: "update-notification-bar",
    [NotificationTypes.AtRiskPassword]: "at-risk-notification-bar",
  };
  return testIds[notificationType];
}

export function resolveNotificationType(initData: NotificationBarIframeInitData): NotificationType {
  return initData.isVaultLocked ? NotificationTypes.Unlock : (initData.type as NotificationType);
}

export function getResolvedTheme(theme: Theme): Theme {
  if (theme === ThemeTypes.System) {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
      ? ThemeTypes.Dark
      : ThemeTypes.Light;
  }
  return theme === ThemeTypes.Dark ? ThemeTypes.Dark : ThemeTypes.Light;
}
