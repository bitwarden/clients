// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType } from "@bitwarden/common/vault/enums";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

const VaultPopoutType = {
  viewVaultItem: "vault_viewVaultItem",
  addEditVaultItem: "vault_AddEditVaultItem",
  fido2Popout: "vault_Fido2Popout",
} as const;

/**
 * Opens a popout window that facilitates viewing a vault item.
 *
 * @param senderTab - The tab that sent the request.
 * @param cipherOptions - The cipher id and action to perform.
 */
async function openViewVaultItemPopout(
  senderTab: chrome.tabs.Tab,
  cipherOptions: {
    cipherId: string;
    action: string;
    forceCloseExistingWindows?: boolean;
  },
) {
  const { cipherId, action, forceCloseExistingWindows } = cipherOptions;
  let promptWindowPath = "popup/index.html#/view-cipher";
  let queryParamToken = "?";
  const formatQueryString = (key: string, value: string) => {
    const queryString = `${queryParamToken}${key}=${value}`;
    queryParamToken = "&";
    return queryString;
  };

  if (cipherId) {
    promptWindowPath += formatQueryString("cipherId", cipherId);
  }
  if (senderTab.id) {
    promptWindowPath += formatQueryString("senderTabId", String(senderTab.id));
  }
  if (action) {
    promptWindowPath += formatQueryString("action", action);
  }

  await BrowserPopupUtils.openPopout(promptWindowPath, {
    singleActionKey: `${VaultPopoutType.viewVaultItem}_${cipherId}`,
    senderWindowId: senderTab.windowId,
    forceCloseExistingWindows,
  });
}

/**
 * Closes the view vault item popout window.
 *
 * @param singleActionKey - The single action popout key used to identify the popout.
 * @param delayClose - The amount of time to wait before closing the popout. Defaults to 0.
 */
async function closeViewVaultItemPopout(singleActionKey: string, delayClose = 0) {
  await BrowserPopupUtils.closeSingleActionPopout(singleActionKey, delayClose);
}

/**
 * Opens a popout window that facilitates re-prompting for
 * the password of a vault item.
 *
 * @param senderTab - The tab that sent the request.
 * @param cipherOptions - The cipher id and action to perform.
 */
async function openVaultItemPasswordRepromptPopout(
  senderTab: chrome.tabs.Tab,
  cipherOptions: {
    cipherId: string;
    action: string;
  },
) {
  await openViewVaultItemPopout(senderTab, {
    forceCloseExistingWindows: true,
    ...cipherOptions,
  });
  await BrowserApi.tabSendMessageData(senderTab, "bgVaultItemRepromptPopoutOpened");
}

/**
 * Opens a popout window that facilitates adding or editing a vault item.
 *
 * @param senderTab - The window id of the sender.
 * @param cipherOptions - Options passed as query params to the popout.
 */
async function openAddEditVaultItemPopout(
  senderTab: chrome.tabs.Tab,
  cipherOptions: { cipherId?: string; cipherType?: CipherType } = {},
) {
  const { cipherId, cipherType } = cipherOptions;
  const { url, windowId } = senderTab;
  let singleActionKey = VaultPopoutType.addEditVaultItem;
  let addEditCipherUrl = "popup/index.html#/edit-cipher";
  let queryParamToken = "?";
  const formatQueryString = (key: string, value: string) => {
    const queryString = `${queryParamToken}${key}=${value}`;
    queryParamToken = "&";
    return queryString;
  };

  if (cipherId && !cipherType) {
    singleActionKey += `_${cipherId}`;
    addEditCipherUrl += formatQueryString("cipherId", cipherId);
  }
  if (cipherType && !cipherId) {
    singleActionKey += `_${cipherType}`;
    addEditCipherUrl += formatQueryString("type", String(cipherType));
  }
  if (senderTab.url) {
    addEditCipherUrl += formatQueryString("uri", url);
  }

  await BrowserPopupUtils.openPopout(addEditCipherUrl, {
    singleActionKey,
    senderWindowId: windowId,
  });
}

/**
 * Closes the add/edit vault item popout window.
 *
 * @param delayClose - The amount of time to wait before closing the popout. Defaults to 0.
 */
async function closeAddEditVaultItemPopout(delayClose = 0) {
  await BrowserPopupUtils.closeSingleActionPopout(VaultPopoutType.addEditVaultItem, delayClose);
}

/**
 * Opens a popout window that facilitates FIDO2
 * authentication and passkey management.
 *
 * @param senderTab - The tab that sent the request.
 * @param options - Options passed as query params to the popout.
 */
async function openFido2Popout(
  senderTab: chrome.tabs.Tab,
  options: {
    sessionId: string;
    fallbackSupported: boolean;
  },
): Promise<chrome.windows.Window["id"]> {
  const { sessionId, fallbackSupported } = options;
  const promptWindowPath =
    "popup/index.html#/fido2" +
    `?sessionId=${sessionId}` +
    `&fallbackSupported=${fallbackSupported}` +
    `&senderTabId=${senderTab.id}` +
    `&senderUrl=${encodeURIComponent(senderTab.url)}`;

  const popoutWindow = await BrowserPopupUtils.openPopout(promptWindowPath, {
    singleActionKey: `${VaultPopoutType.fido2Popout}_${sessionId}`,
    senderWindowId: senderTab.windowId,
    forceCloseExistingWindows: true,
    windowOptions: { height: 570 },
  });

  return popoutWindow.id;
}

/**
 * Closes the FIDO2 popout window associated with the passed session ID.
 *
 * @param sessionId - The session ID of the popout to close.
 */
async function closeFido2Popout(sessionId: string): Promise<void> {
  await BrowserPopupUtils.closeSingleActionPopout(`${VaultPopoutType.fido2Popout}_${sessionId}`);
}

export {
  VaultPopoutType,
  openViewVaultItemPopout,
  closeViewVaultItemPopout,
  openVaultItemPasswordRepromptPopout,
  openAddEditVaultItemPopout,
  closeAddEditVaultItemPopout,
  openFido2Popout,
  closeFido2Popout,
};
