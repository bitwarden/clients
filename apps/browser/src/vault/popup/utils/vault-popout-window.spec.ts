import { mock } from "jest-mock-extended";

import { CipherType } from "@bitwarden/common/vault/enums";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

import {
  openViewVaultItemPopout,
  closeAddEditVaultItemPopout,
  closeFido2Popout,
  openAddEditVaultItemPopout,
  openFido2Popout,
  openVaultItemPasswordRepromptPopout,
  VaultPopoutType,
  closeViewVaultItemPopout,
} from "./vault-popout-window";

describe("VaultPopoutWindow", () => {
  const openPopoutSpy = jest
    .spyOn(BrowserPopupUtils, "openPopout")
    .mockResolvedValue(mock<chrome.windows.Window>({ id: 10 }));
  const closeSingleActionPopoutSpy = jest
    .spyOn(BrowserPopupUtils, "closeSingleActionPopout")
    .mockImplementation();

  beforeEach(() => {
    jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);
    jest.spyOn(BrowserApi, "updateWindowProperties").mockResolvedValue();
    global.chrome = {
      ...global.chrome,
      runtime: {
        ...global.chrome?.runtime,
        sendMessage: jest.fn().mockResolvedValue(undefined),
        getURL: jest.fn((path) => `chrome-extension://extension-id/${path}`),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("openViewVaultItemPopout", () => {
    it("opens a popout window that contains a sender tab id query param reference", async () => {
      const senderTab = { id: 1, windowId: 2 } as chrome.tabs.Tab;

      await openViewVaultItemPopout(senderTab, {
        cipherId: "cipherId",
        action: "action",
      });

      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/view-cipher?cipherId=cipherId&senderTabId=1&action=action",
        {
          singleActionKey: `${VaultPopoutType.viewVaultItem}_cipherId`,
          senderWindowId: 2,
          forceCloseExistingWindows: undefined,
        },
      );
    });
  });

  describe("closeViewVaultItemPopout", () => {
    it("closes the view vault item popout window", async () => {
      await closeViewVaultItemPopout("cipherId");

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(`cipherId`, 0);
    });
  });

  describe("openVaultItemPasswordRepromptPopout", () => {
    it("opens a popout window that facilitates re-prompting for the password of a vault item", async () => {
      const senderTab = { windowId: 1 } as chrome.tabs.Tab;

      await openVaultItemPasswordRepromptPopout(senderTab, {
        cipherId: "cipherId",
        action: "action",
      });

      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/view-cipher?cipherId=cipherId&action=action",
        {
          singleActionKey: `${VaultPopoutType.viewVaultItem}_cipherId`,
          senderWindowId: 1,
          forceCloseExistingWindows: true,
        },
      );
    });
  });

  describe("openAddEditVaultItemPopout", () => {
    it("opens a popout window that facilitates adding a vault item", async () => {
      await openAddEditVaultItemPopout(
        mock<chrome.tabs.Tab>({ windowId: 1, url: "https://jest-testing-website.com" }),
      );

      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/edit-cipher?uri=https://jest-testing-website.com",
        {
          singleActionKey: VaultPopoutType.addEditVaultItem,
          senderWindowId: 1,
        },
      );
    });

    it("opens a popout window that facilitates adding a specific type of vault item", async () => {
      await openAddEditVaultItemPopout(
        mock<chrome.tabs.Tab>({ windowId: 1, url: "https://jest-testing-website.com" }),
        {
          cipherType: CipherType.Identity,
        },
      );

      expect(openPopoutSpy).toHaveBeenCalledWith(
        `popup/index.html#/edit-cipher?type=${CipherType.Identity}&uri=https://jest-testing-website.com`,
        {
          singleActionKey: `${VaultPopoutType.addEditVaultItem}_${CipherType.Identity}`,
          senderWindowId: 1,
        },
      );
    });

    it("opens a popout window that facilitates editing a vault item", async () => {
      await openAddEditVaultItemPopout(
        mock<chrome.tabs.Tab>({ windowId: 1, url: "https://jest-testing-website.com" }),
        {
          cipherId: "cipherId",
        },
      );

      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/edit-cipher?cipherId=cipherId&uri=https://jest-testing-website.com",
        {
          singleActionKey: `${VaultPopoutType.addEditVaultItem}_cipherId`,
          senderWindowId: 1,
        },
      );
    });

    it("sends a message to refresh data when the popup is already open", async () => {
      const existingPopupTab = {
        id: 123,
        windowId: 456,
        url: `chrome-extension://extension-id/popup/index.html#/edit-cipher?singleActionPopout=${VaultPopoutType.addEditVaultItem}_${CipherType.Login}`,
      } as chrome.tabs.Tab;

      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([existingPopupTab]);
      const sendMessageSpy = jest.spyOn(chrome.runtime, "sendMessage");
      const updateWindowSpy = jest.spyOn(BrowserApi, "updateWindowProperties");

      await openAddEditVaultItemPopout(
        mock<chrome.tabs.Tab>({ windowId: 1, url: "https://jest-testing-website.com" }),
        {
          cipherType: CipherType.Login,
        },
      );

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(sendMessageSpy).toHaveBeenCalledWith({
        command: "reloadAddEditCipherData",
        data: { cipherId: undefined, cipherType: CipherType.Login },
      });
      expect(updateWindowSpy).toHaveBeenCalledWith(456, { focused: true });
    });
  });

  describe("closeAddEditVaultItemPopout", () => {
    it("closes the add/edit vault item popout window", async () => {
      await closeAddEditVaultItemPopout();

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(VaultPopoutType.addEditVaultItem, 0);
    });

    it("closes the add/edit vault item popout window after a delay", async () => {
      await closeAddEditVaultItemPopout(1000);

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(
        VaultPopoutType.addEditVaultItem,
        1000,
      );
    });
  });

  describe("openFido2Popout", () => {
    it("opens a popout window that facilitates FIDO2 authentication workflows", async () => {
      const senderTab = mock<chrome.tabs.Tab>({
        windowId: 1,
        url: "https://jest-testing.com",
        id: 2,
      });

      const returnedWindowId = await openFido2Popout(senderTab, {
        sessionId: "sessionId",
        fallbackSupported: true,
      });

      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/fido2?sessionId=sessionId&fallbackSupported=true&senderTabId=2&senderUrl=https%3A%2F%2Fjest-testing.com",
        {
          singleActionKey: `${VaultPopoutType.fido2Popout}_sessionId`,
          senderWindowId: 1,
          forceCloseExistingWindows: true,
          windowOptions: { height: 570 },
        },
      );
      expect(returnedWindowId).toEqual(10);
    });
  });

  describe("closeFido2Popout", () => {
    it("closes the fido2 popout window", async () => {
      const sessionId = "sessionId";

      await closeFido2Popout(sessionId);

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(
        `${VaultPopoutType.fido2Popout}_${sessionId}`,
      );
    });
  });
});
