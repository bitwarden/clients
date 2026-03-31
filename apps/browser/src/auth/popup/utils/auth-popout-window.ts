// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

const AuthPopoutType = {
  unlockExtension: "auth_unlockExtension",
  ssoAuthResult: "auth_ssoAuthResult",
  twoFactorAuthWebAuthn: "auth_twoFactorAuthWebAuthn",
  twoFactorAuthEmail: "auth_twoFactorAuthEmail",
  twoFactorAuthDuo: "auth_twoFactorAuthDuo",
} as const;

const extensionUnlockUrls = new Set([
  chrome.runtime.getURL("popup/index.html#/lock"),
  chrome.runtime.getURL("popup/index.html#/login"),
]);

let unlockPopoutWindowId: number | undefined;

/**
 * Opens a window that facilitates unlocking / logging into the extension.
 *
 * @param senderTab - Used to determine the windowId of the sender.
 */
async function openUnlockPopout(senderTab: chrome.tabs.Tab) {
  const existingPopoutWindowTabs = await BrowserApi.tabsQuery({ windowType: "popup" });

  const newWindow = await BrowserPopupUtils.openPopout("popup/index.html", {
    singleActionKey: AuthPopoutType.unlockExtension,
    senderWindowId: senderTab.windowId,
  });
  unlockPopoutWindowId = newWindow?.id;

  // Remove existing unlock popup windows AFTER the new popup is created. In Safari,
  // tabsQuery returns the toolbar popover as a popup-type tab, and its removal fires
  // chrome.tabs.onRemoved which triggers handleUnlockPopoutClosed. If the new popup
  // doesn't exist yet at that point, the pending autofill notification is abandoned.
  existingPopoutWindowTabs.forEach((tab) => {
    if (extensionUnlockUrls.has(tab.url)) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.removeWindow(tab.windowId);
    }
  });

  await BrowserApi.tabSendMessageData(senderTab, "bgUnlockPopoutOpened", {});
}

/**
 * Closes the unlock popout window.
 */
async function closeUnlockPopout() {
  // Uses the tracked window ID when available because Safari's tabsQuery with URL patterns
  // unreliably returns extension popup tabs, causing closeSingleActionPopout to silently fail.
  // This module-level state does not survive service worker termination; the fallback below
  // covers that case (with reduced reliability on Safari).
  if (unlockPopoutWindowId != null) {
    await BrowserApi.removeWindow(unlockPopoutWindowId);
    unlockPopoutWindowId = undefined;
    return;
  }
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
 * Closes the SSO authentication result popout window.
 */
async function closeSsoAuthResultPopout() {
  await BrowserPopupUtils.closeSingleActionPopout(AuthPopoutType.ssoAuthResult);
}

/**
 * Opens a popout that facilitates two-factor authentication via WebAuthn.
 *
 * @param twoFactorAuthWebAuthnData - The data to send ot the popout via query param.
 * It includes the WebAuthn response and whether to save the 2FA remember me token or not.
 */
async function openTwoFactorAuthWebAuthnPopout(twoFactorAuthWebAuthnData: {
  data: string;
  remember: string;
}) {
  const { data, remember } = twoFactorAuthWebAuthnData;
  const params =
    `webAuthnResponse=${encodeURIComponent(data)};` + `remember=${encodeURIComponent(remember)}`;
  const twoFactorUrl = `popup/index.html#/2fa;${params}`;

  await BrowserPopupUtils.openPopout(twoFactorUrl, {
    singleActionKey: AuthPopoutType.twoFactorAuthWebAuthn,
  });
}

/**
 * Closes the two-factor authentication WebAuthn popout window.
 */
async function closeTwoFactorAuthWebAuthnPopout() {
  await BrowserPopupUtils.closeSingleActionPopout(AuthPopoutType.twoFactorAuthWebAuthn);
}

/**
 * Opens a popout that facilitates two-factor authentication via email.
 */
async function openTwoFactorAuthEmailPopout() {
  await BrowserPopupUtils.openPopout("popup/index.html#/2fa", {
    singleActionKey: AuthPopoutType.twoFactorAuthEmail,
  });
}

/**
 * Closes the two-factor authentication email popout window.
 */
async function closeTwoFactorAuthEmailPopout() {
  await BrowserPopupUtils.closeSingleActionPopout(AuthPopoutType.twoFactorAuthEmail);
}

/**
 * Opens the two-factor authentication Duo popout.
 */
async function openTwoFactorAuthDuoPopout() {
  await BrowserPopupUtils.openPopout("popup/index.html#/2fa", {
    singleActionKey: AuthPopoutType.twoFactorAuthDuo,
  });
}

/**
 * Closes the two-factor authentication Duo popout.
 */
async function closeTwoFactorAuthDuoPopout() {
  await BrowserPopupUtils.closeSingleActionPopout(AuthPopoutType.twoFactorAuthDuo);
}

export {
  AuthPopoutType,
  openUnlockPopout,
  closeUnlockPopout,
  openSsoAuthResultPopout,
  closeSsoAuthResultPopout,
  openTwoFactorAuthWebAuthnPopout,
  closeTwoFactorAuthWebAuthnPopout,
  openTwoFactorAuthEmailPopout,
  closeTwoFactorAuthEmailPopout,
  openTwoFactorAuthDuoPopout,
  closeTwoFactorAuthDuoPopout,
};
