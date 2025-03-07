// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { render } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import type { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { AdjustNotificationBarMessageData } from "../background/abstractions/notification.background";
import { NotificationConfirmationContainer } from "../content/components/notification/confirmation-container";
import { NotificationContainer } from "../content/components/notification/container";
import { buildSvgDomElement } from "../utils";
import { circleCheckIcon } from "../utils/svg-icons";

import {
  NotificationBarWindowMessageHandlers,
  NotificationBarWindowMessage,
  NotificationBarIframeInitData,
  NotificationType,
} from "./abstractions/notification-bar";

const logService = new ConsoleLogService(false);
let notificationBarIframeInitData: NotificationBarIframeInitData = {};
let windowMessageOrigin: string;
let useComponentBar = false;

const notificationBarWindowMessageHandlers: NotificationBarWindowMessageHandlers = {
  initNotificationBar: ({ message }) => initNotificationBar(message),
  saveCipherAttemptCompleted: ({ message }) =>
    useComponentBar
      ? handleSaveCipherConfirmation(message)
      : handleSaveCipherAttemptCompletedMessage(message),
};

globalThis.addEventListener("load", load);

function load() {
  setupWindowMessageListener();
  sendPlatformMessage({ command: "notificationRefreshFlagValue" }, (flagValue) => {
    useComponentBar = flagValue;
    applyNotificationBarStyle();
  });
}
function applyNotificationBarStyle() {
  if (!useComponentBar) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./bar.scss");
  }
  postMessageToParent({ command: "initNotificationBar" });
}

function getI18n() {
  return {
    appName: chrome.i18n.getMessage("appName"),
    close: chrome.i18n.getMessage("close"),
    folder: chrome.i18n.getMessage("folder"),
    loginSaveSuccess: chrome.i18n.getMessage("loginSaveSuccess"),
    loginSaveSuccessDetails: chrome.i18n.getMessage("loginSaveSuccessDetails"),
    loginUpdateSuccess: chrome.i18n.getMessage("loginUpdateSuccess"),
    loginUpdateSuccessDetails: chrome.i18n.getMessage("loginUpdatedSuccessDetails"),
    newItem: chrome.i18n.getMessage("newItem"),
    never: chrome.i18n.getMessage("never"),
    notificationAddDesc: chrome.i18n.getMessage("notificationAddDesc"),
    notificationAddSave: chrome.i18n.getMessage("notificationAddSave"),
    notificationChangeDesc: chrome.i18n.getMessage("notificationChangeDesc"),
    notificationChangeSave: chrome.i18n.getMessage("notificationChangeSave"),
    notificationEdit: chrome.i18n.getMessage("edit"),
    notificationUnlock: chrome.i18n.getMessage("notificationUnlock"),
    notificationUnlockDesc: chrome.i18n.getMessage("notificationUnlockDesc"),
    saveAction: chrome.i18n.getMessage("notificationAddSave"),
    saveAsNewLoginAction: chrome.i18n.getMessage("saveAsNewLoginAction"),
    saveFailure: chrome.i18n.getMessage("saveFailure"),
    saveFailureDetails: chrome.i18n.getMessage("saveFailureDetails"),
    saveLoginPrompt: chrome.i18n.getMessage("saveLoginPrompt"),
    updateLoginAction: chrome.i18n.getMessage("updateLoginAction"),
    updateLoginPrompt: chrome.i18n.getMessage("updateLoginPrompt"),
    view: chrome.i18n.getMessage("view"),
  };
}

function initNotificationBar(message: NotificationBarWindowMessage) {
  const { initData } = message;
  if (!initData) {
    return;
  }

  notificationBarIframeInitData = initData;
  const { isVaultLocked, theme } = notificationBarIframeInitData;
  const i18n = getI18n();
  const resolvedTheme = getResolvedTheme(theme);

  if (useComponentBar) {
    document.body.innerHTML = "";
    // Current implementations utilize a require for scss files which creates the need to remove the node.
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());

    sendPlatformMessage({ command: "bgGetDecryptedCiphers" }, (cipherData) => {
      // @TODO use context to avoid prop drilling
      return render(
        NotificationContainer({
          ...notificationBarIframeInitData,
          type: notificationBarIframeInitData.type as NotificationType,
          theme: resolvedTheme,
          handleCloseNotification,
          handleSaveAction,
          handleEditOrUpdateAction,
          i18n,
          ciphers: cipherData,
        }),
        document.body,
      );
    });
  } else {
    setNotificationBarTheme();

    (document.getElementById("logo") as HTMLImageElement).src = isVaultLocked
      ? chrome.runtime.getURL("images/icon38_locked.png")
      : chrome.runtime.getURL("images/icon38.png");

    setupLogoLink(i18n);

    // i18n for "Add" template
    const addTemplate = document.getElementById("template-add") as HTMLTemplateElement;

    const neverButton = addTemplate.content.getElementById("never-save");
    neverButton.textContent = i18n.never;

    const selectFolder = addTemplate.content.getElementById("select-folder");
    selectFolder.hidden = isVaultLocked || removeIndividualVault();
    selectFolder.setAttribute("aria-label", i18n.folder);

    const addButton = addTemplate.content.getElementById("add-save");
    addButton.textContent = i18n.notificationAddSave;

    const addEditButton = addTemplate.content.getElementById("add-edit");
    // If Remove Individual Vault policy applies, "Add" opens the edit tab, so we hide the Edit button
    addEditButton.hidden = removeIndividualVault();
    addEditButton.textContent = i18n.notificationEdit;

    addTemplate.content.getElementById("add-text").textContent = i18n.notificationAddDesc;

    // i18n for "Change" (update password) template
    const changeTemplate = document.getElementById("template-change") as HTMLTemplateElement;

    const changeButton = changeTemplate.content.getElementById("change-save");
    changeButton.textContent = i18n.notificationChangeSave;

    const changeEditButton = changeTemplate.content.getElementById("change-edit");
    changeEditButton.textContent = i18n.notificationEdit;

    changeTemplate.content.getElementById("change-text").textContent = i18n.notificationChangeDesc;

    // i18n for "Unlock" (unlock extension) template
    const unlockTemplate = document.getElementById("template-unlock") as HTMLTemplateElement;

    const unlockButton = unlockTemplate.content.getElementById("unlock-vault");
    unlockButton.textContent = i18n.notificationUnlock;

    unlockTemplate.content.getElementById("unlock-text").textContent = i18n.notificationUnlockDesc;

    // i18n for body content
    const closeButton = document.getElementById("close-button");
    closeButton.title = i18n.close;

    const notificationType = initData.type;
    if (notificationType === "add") {
      handleTypeAdd();
    } else if (notificationType === "change") {
      handleTypeChange();
    } else if (notificationType === "unlock") {
      handleTypeUnlock();
    }

    closeButton.addEventListener("click", handleCloseNotification);

    globalThis.addEventListener("resize", adjustHeight);
    adjustHeight();
  }
  function handleEditOrUpdateAction(e: Event) {
    const notificationType = initData.type;
    e.preventDefault();
    notificationType === "add" ? sendSaveCipherMessage(true) : sendSaveCipherMessage(false);
  }
}
function handleCloseNotification(e: Event) {
  e.preventDefault();
  sendPlatformMessage({
    command: "bgCloseNotificationBar",
  });
}

function handleSaveAction(e: Event) {
  e.preventDefault();

  sendSaveCipherMessage(removeIndividualVault());
  if (removeIndividualVault()) {
    return;
  }
}

function handleTypeAdd() {
  setContent(document.getElementById("template-add") as HTMLTemplateElement);

  const addButton = document.getElementById("add-save");
  addButton.addEventListener("click", (e) => {
    e.preventDefault();

    // If Remove Individual Vault policy applies, "Add" opens the edit tab
    sendSaveCipherMessage(removeIndividualVault(), getSelectedFolder());
  });

  if (removeIndividualVault()) {
    // Everything past this point is only required if user has an individual vault
    return;
  }

  const editButton = document.getElementById("add-edit");
  editButton.addEventListener("click", (e) => {
    e.preventDefault();

    sendSaveCipherMessage(true, getSelectedFolder());
  });

  const neverButton = document.getElementById("never-save");
  neverButton.addEventListener("click", (e) => {
    e.preventDefault();
    sendPlatformMessage({
      command: "bgNeverSave",
    });
  });

  loadFolderSelector();
}

function handleTypeChange() {
  setContent(document.getElementById("template-change") as HTMLTemplateElement);
  const changeButton = document.getElementById("change-save");
  changeButton.addEventListener("click", (e) => {
    e.preventDefault();

    sendSaveCipherMessage(false);
  });

  const editButton = document.getElementById("change-edit");
  editButton.addEventListener("click", (e) => {
    e.preventDefault();

    sendSaveCipherMessage(true);
  });
}

function sendSaveCipherMessage(edit: boolean, folder?: string) {
  sendPlatformMessage({
    command: "bgSaveCipher",
    folder,
    edit,
  });
}

function handleSaveCipherAttemptCompletedMessage(message: NotificationBarWindowMessage) {
  const addSaveButtonContainers = document.querySelectorAll(".add-change-cipher-buttons");
  const notificationBarOuterWrapper = document.getElementById("notification-bar-outer-wrapper");
  if (message?.error) {
    addSaveButtonContainers.forEach((element) => {
      element.textContent = chrome.i18n.getMessage("saveCipherAttemptFailed");
      element.classList.add("error-message");
      notificationBarOuterWrapper.classList.add("error-event");
    });

    adjustHeight();
    logService.error(`Error encountered when saving credentials: ${message.error}`);
    return;
  }
  const messageName =
    notificationBarIframeInitData.type === "add" ? "passwordSaved" : "passwordUpdated";

  addSaveButtonContainers.forEach((element) => {
    element.textContent = chrome.i18n.getMessage(messageName);
    element.prepend(buildSvgDomElement(circleCheckIcon));
    element.classList.add("success-message");
    notificationBarOuterWrapper.classList.add("success-event");
  });
  adjustHeight();
  globalThis.setTimeout(
    () => sendPlatformMessage({ command: "bgCloseNotificationBar", fadeOutNotification: true }),
    3000,
  );
}

function openViewVaultItemPopout(e: Event, cipherId: string) {
  e.preventDefault();
  sendPlatformMessage({
    command: "bgOpenVault",
    cipherId,
  });
}

function handleSaveCipherConfirmation(message: NotificationBarWindowMessage) {
  const { theme, type } = notificationBarIframeInitData;
  const { error, username, cipherId } = message;
  const i18n = getI18n();
  const resolvedTheme = getResolvedTheme(theme);

  globalThis.setTimeout(() => sendPlatformMessage({ command: "bgCloseNotificationBar" }), 5000);

  return render(
    NotificationConfirmationContainer({
      ...notificationBarIframeInitData,
      type: type as NotificationType,
      theme: resolvedTheme,
      handleCloseNotification,
      i18n,
      error,
      username,
      handleOpenVault: (e) => openViewVaultItemPopout(e, cipherId),
    }),
    document.body,
  );
}

function handleTypeUnlock() {
  setContent(document.getElementById("template-unlock") as HTMLTemplateElement);

  const unlockButton = document.getElementById("unlock-vault");
  unlockButton.addEventListener("click", (e) => {
    sendPlatformMessage({
      command: "bgReopenUnlockPopout",
    });
  });
}

function setContent(template: HTMLTemplateElement) {
  const content = document.getElementById("content");
  while (content.firstChild) {
    content.removeChild(content.firstChild);
  }

  const newElement = template.content.cloneNode(true) as HTMLElement;
  content.appendChild(newElement);
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

function loadFolderSelector() {
  const populateFolderData = (folderData: FolderView[]) => {
    const select = document.getElementById("select-folder");
    if (!folderData?.length) {
      select.appendChild(new Option(chrome.i18n.getMessage("noFoldersFound"), null, true));
      select.setAttribute("disabled", "true");
      return;
    }

    select.appendChild(new Option(chrome.i18n.getMessage("selectFolder"), null, true));
    folderData.forEach((folder: FolderView) => {
      // Select "No Folder" (id=null) folder by default
      select.appendChild(new Option(folder.name, folder.id || "", false));
    });
  };

  sendPlatformMessage({ command: "bgGetFolderData" }, populateFolderData);
}

function getSelectedFolder(): string {
  return (document.getElementById("select-folder") as HTMLSelectElement).value;
}

function removeIndividualVault(): boolean {
  return notificationBarIframeInitData.removeIndividualVault;
}

function adjustHeight() {
  const data: AdjustNotificationBarMessageData = {
    height: document.querySelector("body").scrollHeight,
  };
  sendPlatformMessage({
    command: "bgAdjustNotificationBar",
    data,
  });
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

function setupLogoLink(i18n: Record<string, string>) {
  const logoLink = document.getElementById("logo-link") as HTMLAnchorElement;
  logoLink.title = i18n.appName;
  const setWebVaultUrlLink = (webVaultURL: string) => {
    const newVaultURL = webVaultURL && decodeURIComponent(webVaultURL);
    if (newVaultURL && newVaultURL !== logoLink.href) {
      logoLink.href = newVaultURL;
    }
  };
  sendPlatformMessage({ command: "getWebVaultUrlForNotification" }, setWebVaultUrlLink);
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

function setNotificationBarTheme() {
  const theme = getTheme(globalThis, notificationBarIframeInitData.theme);

  document.documentElement.classList.add(`theme_${theme}`);

  if (notificationBarIframeInitData.applyRedesign) {
    document.body.classList.add("notification-bar-redesign");
  }
}

function postMessageToParent(message: NotificationBarWindowMessage) {
  globalThis.parent.postMessage(message, windowMessageOrigin || "*");
}
