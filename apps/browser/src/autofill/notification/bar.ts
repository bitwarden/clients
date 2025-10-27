import { render } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { NotificationCipherData } from "../content/components/cipher/types";
import { CollectionView, I18n, OrgView } from "../content/components/common-types";
import { AtRiskNotification } from "../content/components/notification/at-risk-password/container";
import { NotificationConfirmationContainer } from "../content/components/notification/confirmation/container";
import { NotificationContainer } from "../content/components/notification/container";
import { selectedCipher as selectedCipherSignal } from "../content/components/signals/selected-cipher";
import { selectedFolder as selectedFolderSignal } from "../content/components/signals/selected-folder";
import { selectedVault as selectedVaultSignal } from "../content/components/signals/selected-vault";

import {
  NotificationBarWindowMessageHandlers,
  NotificationBarWindowMessage,
  NotificationBarIframeInitData,
  NotificationType,
  NotificationTypes,
} from "./abstractions/notification-bar";

let notificationBarIframeInitData: NotificationBarIframeInitData = {};
let windowMessageOrigin: string;

const notificationBarWindowMessageHandlers: NotificationBarWindowMessageHandlers = {
  initNotificationBar: ({ message }) => initNotificationBar(message),
  saveCipherAttemptCompleted: ({ message }) => handleSaveCipherConfirmation(message),
};

globalThis.addEventListener("load", load);

function load() {
  setupWindowMessageListener();
  postMessageToParent({ command: "initNotificationBar" });
}

function getI18n() {
  return {
    appName: chrome.i18n.getMessage("appName"),
    atRiskPassword: chrome.i18n.getMessage("atRiskPassword"),
    changePassword: chrome.i18n.getMessage("changePassword"),
    close: chrome.i18n.getMessage("close"),
    collection: chrome.i18n.getMessage("collection"),
    folder: chrome.i18n.getMessage("folder"),
    loginSaveConfirmation: chrome.i18n.getMessage("loginSaveConfirmation"),
    loginSaveSuccess: chrome.i18n.getMessage("loginSaveSuccess"),
    loginUpdatedConfirmation: chrome.i18n.getMessage("loginUpdatedConfirmation"),
    loginUpdateSuccess: chrome.i18n.getMessage("loginUpdateSuccess"),
    loginUpdateTaskSuccess: chrome.i18n.getMessage("loginUpdateTaskSuccess"),
    loginUpdateTaskSuccessAdditional: chrome.i18n.getMessage("loginUpdateTaskSuccessAdditional"),
    myVault: chrome.i18n.getMessage("myVault"),
    never: chrome.i18n.getMessage("never"),
    newItem: chrome.i18n.getMessage("newItem"),
    nextSecurityTaskAction: chrome.i18n.getMessage("nextSecurityTaskAction"),
    notificationAddDesc: chrome.i18n.getMessage("notificationAddDesc"),
    notificationAddSave: chrome.i18n.getMessage("notificationAddSave"),
    notificationChangeDesc: chrome.i18n.getMessage("notificationChangeDesc"),
    notificationEdit: chrome.i18n.getMessage("edit"),
    notificationEditTooltip: chrome.i18n.getMessage("notificationEditTooltip"),
    notificationLoginSaveConfirmation: chrome.i18n.getMessage("notificationLoginSaveConfirmation"),
    notificationLoginUpdatedConfirmation: chrome.i18n.getMessage(
      "notificationLoginUpdatedConfirmation",
    ),
    notificationUnlock: chrome.i18n.getMessage("notificationUnlock"),
    notificationUnlockDesc: chrome.i18n.getMessage("notificationUnlockDesc"),
    notificationUpdate: chrome.i18n.getMessage("notificationChangeSave"),
    notificationViewAria: chrome.i18n.getMessage("notificationViewAria"),
    saveAction: chrome.i18n.getMessage("notificationAddSave"),
    saveAsNewLoginAction: chrome.i18n.getMessage("saveAsNewLoginAction"),
    saveFailure: chrome.i18n.getMessage("saveFailure"),
    saveFailureDetails: chrome.i18n.getMessage("saveFailureDetails"),
    saveLogin: chrome.i18n.getMessage("saveLogin"),
    typeLogin: chrome.i18n.getMessage("typeLogin"),
    unlockToSave: chrome.i18n.getMessage("unlockToSave"),
    updateLogin: chrome.i18n.getMessage("updateLogin"),
    updateLoginAction: chrome.i18n.getMessage("updateLoginAction"),
    vault: chrome.i18n.getMessage("vault"),
    view: chrome.i18n.getMessage("view"),
  };
}

/**
 * Returns the localized header message for the notification bar based on the notification type.
 *
 * @returns The localized header message string, or undefined if the type is not recognized.
 */
export function getNotificationHeaderMessage(i18n: I18n, type?: NotificationType) {
  return type
    ? {
        [NotificationTypes.Add]: i18n.saveLogin,
        [NotificationTypes.Change]: i18n.updateLogin,
        [NotificationTypes.Unlock]: i18n.unlockToSave,
        [NotificationTypes.AtRiskPassword]: i18n.atRiskPassword,
      }[type]
    : undefined;
}

/**
 * Returns the localized header message for the confirmation message bar based on the notification type.
 *
 * @returns The localized header message string, or undefined if the type is not recognized.
 */
export function getConfirmationHeaderMessage(i18n: I18n, type?: NotificationType, error?: string) {
  if (error) {
    return i18n.saveFailure;
  }

  return type
    ? {
        [NotificationTypes.Add]: i18n.loginSaveSuccess,
        [NotificationTypes.Change]: i18n.loginUpdateSuccess,
        [NotificationTypes.Unlock]: "",
        [NotificationTypes.AtRiskPassword]: "",
      }[type]
    : undefined;
}

/**
 * Appends the header message to the document title.
 * If the header message is already present, it avoids duplication.
 */
export function appendHeaderMessageToTitle(headerMessage?: string) {
  if (!headerMessage) {
    return;
  }
  const baseTitle = document.title.split(" - ")[0];
  document.title = `${baseTitle} - ${headerMessage}`;
}

/**
 * Determines the effective notification type to use based on initialization data.
 *
 * If the vault is locked, the notification type will be set to `Unlock`.
 * Otherwise, the type provided in the init data is returned.
 *
 * @returns The resolved `NotificationType` to be used for rendering logic.
 */
function resolveNotificationType(initData: NotificationBarIframeInitData): NotificationType {
  if (initData.isVaultLocked) {
    return NotificationTypes.Unlock;
  }

  return initData.type as NotificationType;
}

/**
 * Returns the appropriate test ID based on the resolved notification type.
 *
 * @param type - The resolved NotificationType.
 * @param isConfirmation - Optional flag for confirmation vs. notification container.
 */
export function getNotificationTestId(
  notificationType: NotificationType,
  isConfirmation = false,
): string {
  if (isConfirmation) {
    return "confirmation-notification-bar";
  }

  return {
    [NotificationTypes.Unlock]: "unlock-notification-bar",
    [NotificationTypes.Add]: "save-notification-bar",
    [NotificationTypes.Change]: "update-notification-bar",
    [NotificationTypes.AtRiskPassword]: "at-risk-notification-bar",
  }[notificationType];
}

async function initNotificationBar(message: NotificationBarWindowMessage) {
  const { initData } = message;
  if (!initData) {
    return;
  }

  notificationBarIframeInitData = initData;
  const {
    isVaultLocked,
    removeIndividualVault: personalVaultDisallowed,
    theme,
  } = notificationBarIframeInitData;
  const i18n = getI18n();
  const resolvedTheme = getResolvedTheme(theme ?? ThemeTypes.Light);

  const notificationType = resolveNotificationType(notificationBarIframeInitData);
  const headerMessage = getNotificationHeaderMessage(i18n, notificationType);
  const notificationTestId = getNotificationTestId(notificationType);
  appendHeaderMessageToTitle(headerMessage);

  document.body.innerHTML = "";

  if (isVaultLocked) {
    const notificationConfig = {
      ...notificationBarIframeInitData,
      headerMessage,
      type: notificationType,
      notificationTestId,
      theme: resolvedTheme,
      personalVaultIsAllowed: !personalVaultDisallowed,
      handleCloseNotification,
      handleEditOrUpdateAction,
      i18n,
    };

    const handleSaveAction = () => {
      // cipher ID is null while vault is locked.
      sendSaveCipherMessage(null, true);

      render(
        NotificationContainer({
          ...notificationConfig,
          handleSaveAction: () => {},
          isLoading: true,
        }),
        document.body,
      );
    };

    const UnlockNotification = NotificationContainer({ ...notificationConfig, handleSaveAction });

    return render(UnlockNotification, document.body);
  }

  // Handle AtRiskPasswordNotification render
  if (notificationBarIframeInitData.type === NotificationTypes.AtRiskPassword) {
    return render(
      AtRiskNotification({
        ...notificationBarIframeInitData,
        type: notificationBarIframeInitData.type as NotificationType,
        theme: resolvedTheme,
        i18n,
        notificationTestId,
        params: initData.params,
        handleCloseNotification,
      }),
      document.body,
    );
  }

  // Default scenario: add or update password
  const orgId = selectedVaultSignal.get();

  await Promise.all([
    new Promise<OrgView[]>((resolve) => sendPlatformMessage({ command: "bgGetOrgData" }, resolve)),
    new Promise<FolderView[]>((resolve) =>
      sendPlatformMessage({ command: "bgGetFolderData" }, resolve),
    ),
    new Promise<NotificationCipherData[]>((resolve) =>
      sendPlatformMessage({ command: "bgGetDecryptedCiphers" }, resolve),
    ),
    new Promise<CollectionView[]>((resolve) =>
      sendPlatformMessage({ command: "bgGetCollectionData", orgId }, resolve),
    ),
  ]).then(([organizations, folders, ciphers, collections]) => {
    notificationBarIframeInitData = {
      ...notificationBarIframeInitData,
      organizations,
      folders,
      ciphers,
      collections,
    };

    // @TODO use context to avoid prop drilling
    return render(
      NotificationContainer({
        ...notificationBarIframeInitData,
        headerMessage,
        type: notificationType,
        theme: resolvedTheme,
        notificationTestId,
        personalVaultIsAllowed: !personalVaultDisallowed,
        handleCloseNotification,
        handleSaveAction,
        handleEditOrUpdateAction,
        i18n,
      }),
      document.body,
    );
  });

  function handleEditOrUpdateAction(e: Event) {
    e.preventDefault();
    sendSaveCipherMessage(selectedCipherSignal.get(), notificationType === NotificationTypes.Add);
  }
}

function handleCloseNotification(e: Event) {
  e.preventDefault();
  sendPlatformMessage({
    command: "bgCloseNotificationBar",
    fadeOutNotification: true,
  });
}

function handleSaveAction(e: Event) {
  const selectedCipher = selectedCipherSignal.get();
  const selectedVault = selectedVaultSignal.get();
  const selectedFolder = selectedFolderSignal.get();

  if (selectedVault.length > 1) {
    openAddEditVaultItemPopout(e, {
      organizationId: selectedVault,
      ...(selectedFolder?.length > 1 ? { folder: selectedFolder } : {}),
    });
    handleCloseNotification(e);
    return;
  }

  e.preventDefault();
  sendSaveCipherMessage(selectedCipher, removeIndividualVault(), selectedFolder);
  if (removeIndividualVault()) {
    return;
  }
}

function sendSaveCipherMessage(cipherId: CipherView["id"] | null, edit: boolean, folder?: string) {
  sendPlatformMessage({
    command: "bgSaveCipher",
    cipherId,
    folder,
    edit,
  });
}

function openAddEditVaultItemPopout(
  e: Event,
  options: {
    cipherId?: string;
    organizationId?: string;
    folder?: string;
  },
) {
  e.preventDefault();
  sendPlatformMessage({
    command: "bgOpenAddEditVaultItemPopout",
    ...options,
  });
}

function openViewVaultItemPopout(cipherId: string) {
  sendPlatformMessage({
    command: "bgOpenViewVaultItemPopout",
    cipherId,
  });
}

function handleSaveCipherConfirmation(message: NotificationBarWindowMessage) {
  const { theme, type } = notificationBarIframeInitData;
  const { error, data } = message;
  const { cipherId, task, itemName } = data || {};
  const i18n = getI18n();
  const resolvedTheme = getResolvedTheme(theme ?? ThemeTypes.Light);
  const resolvedType = resolveNotificationType(notificationBarIframeInitData);
  const headerMessage = getConfirmationHeaderMessage(i18n, resolvedType, error);
  const notificationTestId = getNotificationTestId(resolvedType, true);
  appendHeaderMessageToTitle(headerMessage);

  globalThis.setTimeout(() => sendPlatformMessage({ command: "bgCloseNotificationBar" }), 5000);

  return render(
    NotificationConfirmationContainer({
      ...notificationBarIframeInitData,
      error,
      handleCloseNotification,
      handleOpenTasks: () => sendPlatformMessage({ command: "bgOpenAtRiskPasswords" }),
      handleOpenVault: (e: Event) =>
        cipherId ? openViewVaultItemPopout(cipherId) : openAddEditVaultItemPopout(e, {}),
      headerMessage,
      i18n,
      itemName: itemName ?? i18n.typeLogin,
      notificationTestId,
      task,
      theme: resolvedTheme,
      type: type as NotificationType,
    }),
    document.body,
  );
}

function sendPlatformMessage(
  msg: Record<string, unknown>,
  responseCallback?: (response: any) => void,
) {
  chrome.runtime.sendMessage(msg, (response) => {
    if (responseCallback) {
      responseCallback(response);
    }
  });
}

function removeIndividualVault(): boolean {
  return Boolean(notificationBarIframeInitData?.removeIndividualVault);
}

function setupWindowMessageListener() {
  globalThis.addEventListener("message", handleWindowMessage);
}

function handleWindowMessage(event: MessageEvent) {
  if (!windowMessageOrigin) {
    windowMessageOrigin = event.origin;
  }

  if (event.origin !== windowMessageOrigin) {
    return;
  }

  const message = event.data as NotificationBarWindowMessage;
  const handler = notificationBarWindowMessageHandlers[message.command];
  if (!handler) {
    return;
  }

  handler({ message });
}

function getTheme(globalThis: any, theme: NotificationBarIframeInitData["theme"]) {
  if (theme === ThemeTypes.System) {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
      ? ThemeTypes.Dark
      : ThemeTypes.Light;
  }

  return theme;
}

function getResolvedTheme(theme: Theme) {
  const themeType = getTheme(globalThis, theme);

  // There are other possible passed theme values, but for now, resolve to dark or light
  const resolvedTheme: Theme = themeType === ThemeTypes.Dark ? ThemeTypes.Dark : ThemeTypes.Light;
  return resolvedTheme;
}

function postMessageToParent(message: NotificationBarWindowMessage) {
  globalThis.parent.postMessage(message, windowMessageOrigin || "*");
}
