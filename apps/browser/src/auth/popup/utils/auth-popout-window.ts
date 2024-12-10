// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/popup/browser-popup-utils";

const AuthPopoutType = {
  unlockExtension: "auth_unlockExtension",
  ssoAuthResult: "auth_ssoAuthResult",
  twoFactorAuth: "auth_twoFactorAuth",
} as const;
const extensionUnlockUrls = new Set([
  chrome.runtime.getURL("popup/index.html#/lock"),
  chrome.runtime.getURL("popup/index.html#/home"),
]);

/**
 * Opens a window that facilitates unlocking / logging into the extension.
 *
 * @param senderTab - Used to determine the windowId of the sender.
 * @param skipNotification - Used to determine whether to show the unlock notification.
 */
async function openUnlockPopout(senderTab: chrome.tabs.Tab, skipNotification = false) {
  const existingPopoutWindowTabs = await BrowserApi.tabsQuery({ windowType: "popup" });
  existingPopoutWindowTabs.forEach((tab) => {
    if (extensionUnlockUrls.has(tab.url)) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.removeWindow(tab.windowId);
    }
  });

  await BrowserPopupUtils.openPopout("popup/index.html", {
    singleActionKey: AuthPopoutType.unlockExtension,
    senderWindowId: senderTab.windowId,
  });
  await BrowserApi.tabSendMessageData(senderTab, "bgUnlockPopoutOpened", { skipNotification });
}

/**
 * Closes the unlock popout window.
 */
async function closeUnlockPopout() {
  await BrowserPopupUtils.closeSingleActionPopout(AuthPopoutType.unlockExtension);
}

/**
 * Opens a window that facilitates presenting the results for SSO authentication.
 *
 * @param resultData - The result data from the SSO authentication.
 */
async function openSsoAuthResultPopout(resultData: { code: string; state: string }) {
  const { code, state } = resultData;
  const authResultUrl = `popup/index.html#/sso?code=${encodeURIComponent(
    code,
  )}&state=${encodeURIComponent(state)}`;

  await BrowserPopupUtils.openPopout(authResultUrl, {
    singleActionKey: AuthPopoutType.ssoAuthResult,
  });
}

/**
 * Opens a window that facilitates two-factor authentication.
 *
 * @param twoFactorAuthData - The data from the two-factor authentication.
 */
async function openTwoFactorAuthPopout(twoFactorAuthData: { data: string; remember: string }) {
  const { data, remember } = twoFactorAuthData;
  const params =
    `webAuthnResponse=${encodeURIComponent(data)};` + `remember=${encodeURIComponent(remember)}`;
  const twoFactorUrl = `popup/index.html#/2fa;${params}`;

  await BrowserPopupUtils.openPopout(twoFactorUrl, {
    singleActionKey: AuthPopoutType.twoFactorAuth,
  });
}

/**
 * Closes the two-factor authentication popout window.
 */
async function closeTwoFactorAuthPopout() {
  await BrowserPopupUtils.closeSingleActionPopout(AuthPopoutType.twoFactorAuth);
}

export {
  AuthPopoutType,
  openUnlockPopout,
  closeUnlockPopout,
  openSsoAuthResultPopout,
  openTwoFactorAuthPopout,
  closeTwoFactorAuthPopout,
};
