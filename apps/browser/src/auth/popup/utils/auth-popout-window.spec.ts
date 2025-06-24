import { createChromeTabMock } from "../../../autofill/spec/autofill-mocks";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

import {
  AuthPopoutType,
  openUnlockPopout,
  closeUnlockPopout,
  openSsoAuthResultPopout,
  openTwoFactorAuthWebAuthnPopout,
  closeTwoFactorAuthWebAuthnPopout,
  closeSsoAuthResultPopout,
  openTwoFactorAuthEmailPopout,
  closeTwoFactorAuthEmailPopout,
  openTwoFactorAuthDuoPopout,
  closeTwoFactorAuthDuoPopout,
} from "./auth-popout-window";

describe("AuthPopoutWindow", () => {
  const openPopoutSpy = jest.spyOn(BrowserPopupUtils, "openPopout").mockImplementation();
  const sendMessageDataSpy = jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();
  const closeSingleActionPopoutSpy = jest
    .spyOn(BrowserPopupUtils, "closeSingleActionPopout")
    .mockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("openUnlockPopout", () => {
    let senderTab: chrome.tabs.Tab;

    beforeEach(() => {
      senderTab = { windowId: 1 } as chrome.tabs.Tab;
    });

    it("opens a single action popup that allows the user to unlock the extension and sends a `bgUnlockPopoutOpened` message", async () => {
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);

      await openUnlockPopout(senderTab);

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html", {
        singleActionKey: AuthPopoutType.unlockExtension,
        senderWindowId: 1,
      });
      expect(sendMessageDataSpy).toHaveBeenCalledWith(senderTab, "bgUnlockPopoutOpened", {
        skipNotification: false,
      });
    });

    it("sends an indication that the presenting the notification bar for unlocking the extension should be skipped", async () => {
      await openUnlockPopout(senderTab, true);

      expect(sendMessageDataSpy).toHaveBeenCalledWith(senderTab, "bgUnlockPopoutOpened", {
        skipNotification: true,
      });
    });

    it("closes any existing popup window types that are open to the unlock extension route", async () => {
      const unlockTab = createChromeTabMock({
        url: chrome.runtime.getURL("popup/index.html#/lock"),
      });
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([unlockTab]);
      jest.spyOn(BrowserApi, "removeWindow");
      const senderTab = { windowId: 1 } as chrome.tabs.Tab;

      await openUnlockPopout(senderTab);

      expect(BrowserApi.tabsQuery).toHaveBeenCalledWith({ windowType: "popup" });
      expect(BrowserApi.removeWindow).toHaveBeenCalledWith(unlockTab.windowId);
    });

    it("closes any existing popup window types that are open to the login extension route", async () => {
      const loginTab = createChromeTabMock({
        url: chrome.runtime.getURL("popup/index.html#/login"),
      });
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([loginTab]);
      jest.spyOn(BrowserApi, "removeWindow");
      const senderTab = { windowId: 1 } as chrome.tabs.Tab;

      await openUnlockPopout(senderTab);

      expect(BrowserApi.removeWindow).toHaveBeenCalledWith(loginTab.windowId);
    });
  });

  describe("closeUnlockPopout", () => {
    it("closes the unlock extension popout window", async () => {
      await closeUnlockPopout();

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(AuthPopoutType.unlockExtension);
    });
  });

  describe("openSsoAuthResultPopout", () => {
    it("opens a window that facilitates presentation of the results for SSO authentication", async () => {
      await openSsoAuthResultPopout({ code: "code", state: "state" });

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/sso?code=code&state=state", {
        singleActionKey: AuthPopoutType.ssoAuthResult,
      });
    });
  });

  describe("closeSsoAuthResultPopout", () => {
    it("closes the SSO authentication result popout window", async () => {
      await closeSsoAuthResultPopout();

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(AuthPopoutType.ssoAuthResult);
    });
  });

  describe("openTwoFactorAuthWebAuthnPopout", () => {
    it("opens a window that facilitates two factor authentication via WebAuthn", async () => {
      await openTwoFactorAuthWebAuthnPopout({ data: "data", remember: "remember" });

      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/2fa;webAuthnResponse=data;remember=remember",
        { singleActionKey: AuthPopoutType.twoFactorAuthWebAuthn },
      );
    });
  });

  describe("closeTwoFactorAuthWebAuthnPopout", () => {
    it("closes the two-factor authentication WebAuthn window", async () => {
      await closeTwoFactorAuthWebAuthnPopout();

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(AuthPopoutType.twoFactorAuthWebAuthn);
    });
  });

  describe("openTwoFactorAuthEmailPopout", () => {
    it("opens a window that facilitates two factor authentication via email", async () => {
      await openTwoFactorAuthEmailPopout();

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/2fa", {
        singleActionKey: AuthPopoutType.twoFactorAuthEmail,
      });
    });
  });

  describe("closeTwoFactorAuthEmailPopout", () => {
    it("closes the two-factor authentication email window", async () => {
      await closeTwoFactorAuthEmailPopout();

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(AuthPopoutType.twoFactorAuthEmail);
    });
  });

  describe("openTwoFactorAuthDuoPopout", () => {
    it("opens a window that facilitates two factor authentication via Duo", async () => {
      await openTwoFactorAuthDuoPopout();

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/2fa", {
        singleActionKey: AuthPopoutType.twoFactorAuthDuo,
      });
    });
  });

  describe("closeTwoFactorAuthDuoPopout", () => {
    it("closes the two-factor authentication Duo window", async () => {
      await closeTwoFactorAuthDuoPopout();

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(AuthPopoutType.twoFactorAuthDuo);
    });
  });
});
