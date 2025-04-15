import { render } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import type { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { AdjustNotificationBarMessageData } from "../background/abstractions/notification.background";
import { NotificationCipherData } from "../content/components/cipher/types";
import { OrgView } from "../content/components/common-types";
import { NotificationConfirmationContainer } from "../content/components/notification/confirmation/container";
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
    loginUpdateTaskSuccess: chrome.i18n.getMessage("loginUpdateTaskSuccess"),
    loginUpdateTaskSuccessAdditional: chrome.i18n.getMessage("loginUpdateTaskSuccessAdditional"),
    nextSecurityTaskAction: chrome.i18n.getMessage("nextSecurityTaskAction"),
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
    typeLogin: chrome.i18n.getMessage("typeLogin"),
    updateLoginAction: chrome.i18n.getMessage("updateLoginAction"),
    updateLoginPrompt: chrome.i18n.getMessage("updateLoginPrompt"),
    view: chrome.i18n.getMessage("view"),
  };
}

/**
 * Attempts to locate an element by ID within a template’s content and casts it to the specified type.
 *
 * @param templateElement - The template whose content will be searched for the element.
 * @param elementId - The ID of the element being searched for.
 * @returns The typed element if found, otherwise log error.
 *
 */
const findElementById = <ElementType extends HTMLElement>(
  templateElement: HTMLTemplateElement,
  elementId: string,
): ElementType => {
  const element = templateElement.content.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found in template.`);
  }
  return element as ElementType;
};

/**
 * Sets the text content of an element identified by ID within a template's content.
 *
 * @param template - The template whose content will be searched for the element.
 * @param elementId - The ID of the element whose text content is to be set.
 * @param text - The text content to set for the specified element.
 * @returns void
 *
 * This function attempts to locate an element by its ID within the content of a given HTML template.
 * If the element is found, it updates the element's text content with the provided text.
 * If the element is not found, the function does nothing, ensuring that the operation is safe and does not throw errors.
 */
function setElementText(template: HTMLTemplateElement, elementId: string, text: string): void {
  const element = template.content.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

async function initNotificationBar(message: NotificationBarWindowMessage) {
  const { initData } = message;
  if (!initData) {
    return;
  }

  notificationBarIframeInitData = initData;
  const { isVaultLocked, theme } = notificationBarIframeInitData;
  const i18n = getI18n();
  const resolvedTheme = getResolvedTheme(theme ?? ThemeTypes.Light);

  if (useComponentBar) {
    document.body.innerHTML = "";
    // Current implementations utilize a require for scss files which creates the need to remove the node.
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());

    await Promise.all([
      new Promise<OrgView[]>((resolve) =>
        sendPlatformMessage({ command: "bgGetOrgData" }, resolve),
      ),
      new Promise<FolderView[]>((resolve) =>
        sendPlatformMessage({ command: "bgGetFolderData" }, resolve),
      ),
      new Promise<NotificationCipherData[]>((resolve) =>
        sendPlatformMessage({ command: "bgGetDecryptedCiphers" }, resolve),
      ),
    ]).then(([organizations, folders, ciphers]) => {
      notificationBarIframeInitData = {
        ...notificationBarIframeInitData,
        folders,
        ciphers,
        organizations,
      };
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

    const neverButton = findElementById<HTMLButtonElement>(addTemplate, "never-save");
    neverButton.textContent = i18n.never;

    const selectFolder = findElementById<HTMLSelectElement>(addTemplate, "select-folder");
    selectFolder.hidden = isVaultLocked || removeIndividualVault();
    selectFolder.setAttribute("aria-label", i18n.folder);

    const addButton = findElementById<HTMLButtonElement>(addTemplate, "add-save");
    addButton.textContent = i18n.notificationAddSave;

    const addEditButton = findElementById<HTMLButtonElement>(addTemplate, "add-edit");
    // If Remove Individual Vault policy applies, "Add" opens the edit tab, so we hide the Edit button
    addEditButton.hidden = removeIndividualVault();
    addEditButton.textContent = i18n.notificationEdit;

    setElementText(addTemplate, "add-text", i18n.notificationAddDesc);

    // i18n for "Change" (update password) template
    const changeTemplate = document.getElementById("template-change") as HTMLTemplateElement;

    const changeButton = findElementById<HTMLSelectElement>(changeTemplate, "change-save");
    changeButton.textContent = i18n.notificationChangeSave;

    const changeEditButton = findElementById<HTMLButtonElement>(changeTemplate, "change-edit");
    changeEditButton.textContent = i18n.notificationEdit;

    setElementText(changeTemplate, "change-text", i18n.notificationChangeDesc);

    // i18n for "Unlock" (unlock extension) template
    const unlockTemplate = document.getElementById("template-unlock") as HTMLTemplateElement;

    const unlockButton = findElementById<HTMLButtonElement>(unlockTemplate, "unlock-vault");
    unlockButton.textContent = i18n.notificationUnlock;

    setElementText(unlockTemplate, "unlock-text", i18n.notificationUnlockDesc);

    // i18n for body content
    const closeButton = document.getElementById("close-button");
    if (closeButton) {
      closeButton.title = i18n.close;
    }

    const notificationType = initData.type;
    if (notificationType === "add") {
      handleTypeAdd();
    } else if (notificationType === "change") {
      handleTypeChange();
    } else if (notificationType === "unlock") {
      handleTypeUnlock();
    }

    closeButton?.addEventListener("click", handleCloseNotification);

    globalThis.addEventListener("resize", adjustHeight);
    adjustHeight();
  }
  function handleEditOrUpdateAction(e: Event) {
    const notificationType = initData?.type;
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
  addButton?.addEventListener("click", (e) => {
    e.preventDefault();

    // If Remove Individual Vault policy applies, "Add" opens the edit tab
    sendSaveCipherMessage(removeIndividualVault(), getSelectedFolder());
  });

  if (removeIndividualVault()) {
    // Everything past this point is only required if user has an individual vault
    return;
  }

  const editButton = document.getElementById("add-edit");
  editButton?.addEventListener("click", (e) => {
    e.preventDefault();

    sendSaveCipherMessage(true, getSelectedFolder());
  });

  const neverButton = document.getElementById("never-save");
  neverButton?.addEventListener("click", (e) => {
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
  changeButton?.addEventListener("click", (e) => {
    e.preventDefault();

    sendSaveCipherMessage(false);
  });

  const editButton = document.getElementById("change-edit");
  editButton?.addEventListener("click", (e) => {
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
      notificationBarOuterWrapper?.classList.add("error-event");
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
    notificationBarOuterWrapper?.classList.add("success-event");
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
  const resolvedTheme = getResolvedTheme(theme ?? ThemeTypes.Light);

  globalThis.setTimeout(() => sendPlatformMessage({ command: "bgCloseNotificationBar" }), 5000);

  return render(
    NotificationConfirmationContainer({
      ...notificationBarIframeInitData,
      type: type as NotificationType,
      theme: resolvedTheme,
      handleCloseNotification,
      i18n,
      error,
      username: username ?? i18n.typeLogin,
      handleOpenVault: (e) => cipherId && openViewVaultItemPopout(e, cipherId),
      handleOpenTasks: () => {},
    }),
    document.body,
  );
}

function handleTypeUnlock() {
  setContent(document.getElementById("template-unlock") as HTMLTemplateElement);

  const unlockButton = document.getElementById("unlock-vault");
  unlockButton?.addEventListener("click", (e) => {
    sendPlatformMessage({
      command: "bgReopenUnlockPopout",
    });
  });
}

function setContent(template: HTMLTemplateElement) {
  const content = document.getElementById("content");
  while (content?.firstChild) {
    content?.removeChild(content.firstChild);
  }

  const newElement = template.content.cloneNode(true) as HTMLElement;
  content?.appendChild(newElement);
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
    if (!select) {
      return;
    }

    if (!folderData?.length) {
      select.appendChild(new Option(chrome.i18n.getMessage("noFoldersFound"), undefined, true));
      select.setAttribute("disabled", "true");
      return;
    }

    select.appendChild(new Option(chrome.i18n.getMessage("selectFolder"), undefined, true));
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
  return Boolean(notificationBarIframeInitData?.removeIndividualVault);
}

function adjustHeight() {
  const body = document.querySelector("body");
  if (!body) {
    return;
  }
  const data: AdjustNotificationBarMessageData = {
    height: body.scrollHeight,
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
}

function postMessageToParent(message: NotificationBarWindowMessage) {
  globalThis.parent.postMessage(message, windowMessageOrigin || "*");
}
