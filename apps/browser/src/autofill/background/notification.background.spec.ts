import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/services/policy/policy.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { UserNotificationSettingsService } from "@bitwarden/common/autofill/services/user-notification-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SelfHostedEnvironment } from "@bitwarden/common/platform/services/default-environment.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";

import { BrowserApi } from "../../platform/browser/browser-api";
import { NotificationQueueMessageType } from "../enums/notification-queue-message-type.enum";
import { FormData } from "../services/abstractions/autofill.service";
import AutofillService from "../services/autofill.service";
import { createAutofillPageDetailsMock, createChromeTabMock } from "../spec/autofill-mocks";
import { flushPromises, sendMockExtensionMessage } from "../spec/testing-utils";

import {
  AddChangePasswordQueueMessage,
  AddLoginQueueMessage,
  AddUnlockVaultQueueMessage,
  LockedVaultPendingNotificationsData,
  NotificationBackgroundExtensionMessage,
} from "./abstractions/notification.background";
import NotificationBackground from "./notification.background";

jest.mock("rxjs", () => {
  const rxjs = jest.requireActual("rxjs");
  const { firstValueFrom } = rxjs;
  return {
    ...rxjs,
    firstValueFrom: jest.fn(firstValueFrom),
  };
});

describe("NotificationBackground", () => {
  let notificationBackground: NotificationBackground;
  const autofillService = mock<AutofillService>();
  const cipherService = mock<CipherService>();
  const authService = mock<AuthService>();
  const policyService = mock<PolicyService>();
  const folderService = mock<FolderService>();
  const userNotificationSettingsService = mock<UserNotificationSettingsService>();
  const domainSettingsService = mock<DomainSettingsService>();
  const environmentService = mock<EnvironmentService>();
  const logService = mock<LogService>();
  const themeStateService = mock<ThemeStateService>();
  const configService = mock<ConfigService>();

  beforeEach(() => {
    notificationBackground = new NotificationBackground(
      autofillService,
      cipherService,
      authService,
      policyService,
      folderService,
      userNotificationSettingsService,
      domainSettingsService,
      environmentService,
      logService,
      themeStateService,
      configService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("convertAddLoginQueueMessageToCipherView", () => {
    it("returns a cipher view when passed an `AddLoginQueueMessage`", () => {
      const message: AddLoginQueueMessage = {
        type: "add",
        username: "test",
        password: "password",
        uri: "https://example.com",
        domain: "",
        tab: createChromeTabMock(),
        expires: new Date(),
        wasVaultLocked: false,
      };
      const cipherView = notificationBackground["convertAddLoginQueueMessageToCipherView"](message);

      expect(cipherView.name).toEqual("example.com");
      expect(cipherView.login).toEqual({
        autofillOnPageLoad: null,
        fido2Credentials: null,
        password: message.password,
        passwordRevisionDate: null,
        totp: null,
        uris: [
          {
            _canLaunch: null,
            _domain: null,
            _host: null,
            _hostname: null,
            _uri: message.uri,
            match: null,
          },
        ],
        username: message.username,
      });
    });

    it("returns a cipher view assigned to an existing folder id", () => {
      const folderId = "folder-id";
      const message: AddLoginQueueMessage = {
        type: "add",
        username: "test",
        password: "password",
        uri: "https://example.com",
        domain: "example.com",
        tab: createChromeTabMock(),
        expires: new Date(),
        wasVaultLocked: false,
      };
      const cipherView = notificationBackground["convertAddLoginQueueMessageToCipherView"](
        message,
        folderId,
      );

      expect(cipherView.folderId).toEqual(folderId);
    });
  });

  describe("notification bar extension message handlers", () => {
    beforeEach(async () => {
      await notificationBackground.init();
    });

    it("ignores messages whose command does not match the expected handlers", () => {
      const message: NotificationBackgroundExtensionMessage = { command: "unknown" };
      jest.spyOn(notificationBackground as any, "handleSaveCipherMessage");

      sendMockExtensionMessage(message);

      expect(notificationBackground["handleSaveCipherMessage"]).not.toHaveBeenCalled();
    });

    describe("unlockCompleted message handler", () => {
      it("sends a `closeNotificationBar` message if the retryCommand is for `autofill_login", async () => {
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        const message: NotificationBackgroundExtensionMessage = {
          command: "unlockCompleted",
          data: {
            commandToRetry: { message: { command: "autofill_login" } },
          } as LockedVaultPendingNotificationsData,
        };
        jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(BrowserApi.tabSendMessageData).toHaveBeenCalledWith(
          sender.tab,
          "closeNotificationBar",
        );
      });

      it("triggers a retryHandler if the message target is `notification.background` and a handler exists", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "unlockCompleted",
          data: {
            commandToRetry: { message: { command: "bgSaveCipher" } },
            target: "notification.background",
          } as LockedVaultPendingNotificationsData,
        };
        jest.spyOn(notificationBackground as any, "handleSaveCipherMessage").mockImplementation();

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(notificationBackground["handleSaveCipherMessage"]).toHaveBeenCalledWith(
          message.data.commandToRetry.message,
          message.data.commandToRetry.sender,
        );
      });
    });

    describe("bgGetFolderData message handler", () => {
      it("returns a list of folders", async () => {
        const folderView = mock<FolderView>({ id: "folder-id" });
        const folderViews = [folderView];
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgGetFolderData",
        };
        jest.spyOn(notificationBackground as any, "getFolderData");
        (firstValueFrom as jest.Mock).mockResolvedValueOnce(folderViews);

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(notificationBackground["getFolderData"]).toHaveBeenCalled();
        expect(firstValueFrom).toHaveBeenCalled();
      });
    });

    describe("bgCloseNotificationBar message handler", () => {
      it("sends a `closeNotificationBar` message to the sender tab", async () => {
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgCloseNotificationBar",
        };
        jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(BrowserApi.tabSendMessageData).toHaveBeenCalledWith(
          sender.tab,
          "closeNotificationBar",
        );
      });
    });

    describe("bgAdjustNotificationBar message handler", () => {
      it("sends a `adjustNotificationBar` message to the sender tab", async () => {
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgAdjustNotificationBar",
          data: { height: 100 },
        };
        jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(BrowserApi.tabSendMessageData).toHaveBeenCalledWith(
          sender.tab,
          "adjustNotificationBar",
          message.data,
        );
      });
    });

    describe("bgAddLogin message handler", () => {
      let tab: chrome.tabs.Tab;
      let sender: chrome.runtime.MessageSender;
      let getAuthStatusSpy: jest.SpyInstance;
      let getEnableAddedLoginPromptSpy: jest.SpyInstance;
      let getEnableChangedPasswordPromptSpy: jest.SpyInstance;
      let pushAddLoginToQueueSpy: jest.SpyInstance;
      let pushChangePasswordToQueueSpy: jest.SpyInstance;
      let getAllDecryptedForUrlSpy: jest.SpyInstance;

      beforeEach(() => {
        tab = createChromeTabMock();
        sender = mock<chrome.runtime.MessageSender>({ tab });
        getAuthStatusSpy = jest.spyOn(authService, "getAuthStatus");
        getEnableAddedLoginPromptSpy = jest.spyOn(
          notificationBackground as any,
          "getEnableAddedLoginPrompt",
        );
        getEnableChangedPasswordPromptSpy = jest.spyOn(
          notificationBackground as any,
          "getEnableChangedPasswordPrompt",
        );
        pushAddLoginToQueueSpy = jest.spyOn(notificationBackground as any, "pushAddLoginToQueue");
        pushChangePasswordToQueueSpy = jest.spyOn(
          notificationBackground as any,
          "pushChangePasswordToQueue",
        );
        getAllDecryptedForUrlSpy = jest.spyOn(cipherService, "getAllDecryptedForUrl");
      });

      it("skips attempting to add the login if the user is logged out", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgAddLogin",
          login: { username: "test", password: "password", url: "https://example.com" },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.LoggedOut);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getEnableAddedLoginPromptSpy).not.toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to add the login if the login data does not contain a valid url", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgAddLogin",
          login: { username: "test", password: "password", url: "" },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Locked);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getEnableAddedLoginPromptSpy).not.toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to add the login if the user with a locked vault has disabled the login notification", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgAddLogin",
          login: { username: "test", password: "password", url: "https://example.com" },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Locked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getEnableAddedLoginPromptSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).not.toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to add the login if the user with an unlocked vault has disabled the login notification", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgAddLogin",
          login: { username: "test", password: "password", url: "https://example.com" },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getEnableAddedLoginPromptSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to change the password for an existing login if the user has disabled changing the password notification", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgAddLogin",
          login: { username: "test", password: "password", url: "https://example.com" },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(true);
        getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "test", password: "oldPassword" } }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getEnableAddedLoginPromptSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(getEnableChangedPasswordPromptSpy).toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to change the password for an existing login if the password has not changed", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgAddLogin",
          login: { username: "test", password: "password", url: "https://example.com" },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(true);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "test", password: "password" } }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getEnableAddedLoginPromptSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("adds the login to the queue if the user has a locked account", async () => {
        const login = { username: "test", password: "password", url: "https://example.com" };
        const message: NotificationBackgroundExtensionMessage = { command: "bgAddLogin", login };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Locked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(true);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith("example.com", login, sender.tab, true);
      });

      it("adds the login to the queue if the user has an unlocked account and the login is new", async () => {
        const login = {
          username: undefined,
          password: "password",
          url: "https://example.com",
        } as any;
        const message: NotificationBackgroundExtensionMessage = { command: "bgAddLogin", login };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(true);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "anotherTestUsername", password: "password" } }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith("example.com", login, sender.tab);
      });

      it("adds a change password message to the queue if the user has changed an existing cipher's password", async () => {
        const login = { username: "tEsT", password: "password", url: "https://example.com" };
        const message: NotificationBackgroundExtensionMessage = { command: "bgAddLogin", login };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getEnableAddedLoginPromptSpy.mockResolvedValueOnce(true);
        getEnableChangedPasswordPromptSpy.mockResolvedValueOnce(true);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id",
            login: { username: "test", password: "oldPassword" },
          }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          "cipher-id",
          "example.com",
          login.password,
          sender.tab,
        );
      });
    });

    describe("bgChangedPassword message handler", () => {
      let tab: chrome.tabs.Tab;
      let sender: chrome.runtime.MessageSender;
      let getAuthStatusSpy: jest.SpyInstance;
      let pushChangePasswordToQueueSpy: jest.SpyInstance;
      let getAllDecryptedForUrlSpy: jest.SpyInstance;

      beforeEach(() => {
        tab = createChromeTabMock();
        sender = mock<chrome.runtime.MessageSender>({ tab });
        getAuthStatusSpy = jest.spyOn(authService, "getAuthStatus");
        pushChangePasswordToQueueSpy = jest.spyOn(
          notificationBackground as any,
          "pushChangePasswordToQueue",
        );
        getAllDecryptedForUrlSpy = jest.spyOn(cipherService, "getAllDecryptedForUrl");
      });

      it("skips attempting to add the change password message to the queue if the passed url is not valid", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgChangedPassword",
          data: { newPassword: "newPassword", currentPassword: "currentPassword", url: "" },
        };

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("adds a change password message to the queue if the user does not have an unlocked account", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgChangedPassword",
          data: {
            newPassword: "newPassword",
            currentPassword: "currentPassword",
            url: "https://example.com",
          },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Locked);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          null,
          "example.com",
          message.data.newPassword,
          sender.tab,
          true,
        );
      });

      it("skips adding a change password message to the queue if the multiple ciphers exist for the passed URL and the current password is not found within the list of ciphers", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgChangedPassword",
          data: {
            newPassword: "newPassword",
            currentPassword: "currentPassword",
            url: "https://example.com",
          },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "test", password: "password" } }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips adding a change password message if more than one existing cipher is found with a matching password ", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgChangedPassword",
          data: {
            newPassword: "newPassword",
            currentPassword: "currentPassword",
            url: "https://example.com",
          },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "test", password: "password" } }),
          mock<CipherView>({ login: { username: "test2", password: "password" } }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("adds a change password message to the queue if a single cipher matches the passed current password", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgChangedPassword",
          data: {
            newPassword: "newPassword",
            currentPassword: "currentPassword",
            url: "https://example.com",
          },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id",
            login: { username: "test", password: "currentPassword" },
          }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          "cipher-id",
          "example.com",
          message.data.newPassword,
          sender.tab,
        );
      });

      it("skips adding a change password message if no current password is passed in the message and more than one cipher is found for a url", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgChangedPassword",
          data: {
            newPassword: "newPassword",
            url: "https://example.com",
          },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "test", password: "password" } }),
          mock<CipherView>({ login: { username: "test2", password: "password" } }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("adds a change password message to the queue if no current password is passed with the message, but a single cipher is matched for the uri", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgChangedPassword",
          data: {
            newPassword: "newPassword",
            url: "https://example.com",
          },
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id",
            login: { username: "test", password: "password" },
          }),
        ]);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          "cipher-id",
          "example.com",
          message.data.newPassword,
          sender.tab,
        );
      });
    });

    describe("bgRemoveTabFromNotificationQueue message handler", () => {
      it("splices a notification queue item based on the passed tab", async () => {
        const tab = createChromeTabMock({ id: 2 });
        const sender = mock<chrome.runtime.MessageSender>({ tab });
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgRemoveTabFromNotificationQueue",
        };
        const removeTabFromNotificationQueueSpy = jest.spyOn(
          notificationBackground as any,
          "removeTabFromNotificationQueue",
        );
        const firstQueueMessage = mock<AddLoginQueueMessage>({
          tab: createChromeTabMock({ id: 1 }),
        });
        const secondQueueMessage = mock<AddLoginQueueMessage>({ tab });
        const thirdQueueMessage = mock<AddLoginQueueMessage>({
          tab: createChromeTabMock({ id: 3 }),
        });
        notificationBackground["notificationQueue"] = [
          firstQueueMessage,
          secondQueueMessage,
          thirdQueueMessage,
        ];

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(removeTabFromNotificationQueueSpy).toHaveBeenCalledWith(tab);
        expect(notificationBackground["notificationQueue"]).toEqual([
          firstQueueMessage,
          thirdQueueMessage,
        ]);
      });
    });

    describe("bgSaveCipher message handler", () => {
      let getAuthStatusSpy: jest.SpyInstance;
      let tabSendMessageDataSpy: jest.SpyInstance;
      let openUnlockPopoutSpy: jest.SpyInstance;

      beforeEach(() => {
        getAuthStatusSpy = jest.spyOn(authService, "getAuthStatus");
        tabSendMessageDataSpy = jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();
        openUnlockPopoutSpy = jest
          .spyOn(notificationBackground as any, "openUnlockPopout")
          .mockImplementation();
      });

      it("skips saving the cipher and opens an unlock popout if the extension is not unlocked", async () => {
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgSaveCipher",
          edit: false,
          folder: "folder-id",
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Locked);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
          sender.tab,
          "addToLockedVaultPendingNotifications",
          {
            commandToRetry: { message, sender },
            target: "notification.background",
          },
        );
        expect(openUnlockPopoutSpy).toHaveBeenCalledWith(sender.tab);
      });

      describe("saveOrUpdateCredentials", () => {
        let getDecryptedCipherByIdSpy: jest.SpyInstance;
        let getAllDecryptedForUrlSpy: jest.SpyInstance;
        let updatePasswordSpy: jest.SpyInstance;
        let convertAddLoginQueueMessageToCipherViewSpy: jest.SpyInstance;
        let tabSendMessageSpy: jest.SpyInstance;
        let editItemSpy: jest.SpyInstance;
        let setAddEditCipherInfoSpy: jest.SpyInstance;
        let openAddEditVaultItemPopoutSpy: jest.SpyInstance;
        let createWithServerSpy: jest.SpyInstance;
        let updateWithServerSpy: jest.SpyInstance;
        let folderExistsSpy: jest.SpyInstance;
        let cipherEncryptSpy: jest.SpyInstance;

        beforeEach(() => {
          getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Unlocked);
          getDecryptedCipherByIdSpy = jest.spyOn(
            notificationBackground as any,
            "getDecryptedCipherById",
          );
          getAllDecryptedForUrlSpy = jest.spyOn(cipherService, "getAllDecryptedForUrl");
          updatePasswordSpy = jest.spyOn(notificationBackground as any, "updatePassword");
          convertAddLoginQueueMessageToCipherViewSpy = jest.spyOn(
            notificationBackground as any,
            "convertAddLoginQueueMessageToCipherView",
          );
          tabSendMessageSpy = jest.spyOn(BrowserApi, "tabSendMessage").mockImplementation();
          editItemSpy = jest.spyOn(notificationBackground as any, "editItem");
          setAddEditCipherInfoSpy = jest.spyOn(cipherService, "setAddEditCipherInfo");
          openAddEditVaultItemPopoutSpy = jest.spyOn(
            notificationBackground as any,
            "openAddEditVaultItemPopout",
          );
          createWithServerSpy = jest.spyOn(cipherService, "createWithServer");
          updateWithServerSpy = jest.spyOn(cipherService, "updateWithServer");
          folderExistsSpy = jest.spyOn(notificationBackground as any, "folderExists");
          cipherEncryptSpy = jest.spyOn(cipherService, "encrypt");
        });

        it("skips saving the cipher if the notification queue does not have a tab that is related to the sender", async () => {
          const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 2 } });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          notificationBackground["notificationQueue"] = [
            mock<AddLoginQueueMessage>({
              tab: createChromeTabMock({ id: 1 }),
            }),
          ];

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(updatePasswordSpy).not.toHaveBeenCalled();
          expect(editItemSpy).not.toHaveBeenCalled();
          expect(createWithServerSpy).not.toHaveBeenCalled();
        });

        it("skips saving the cipher if the notification queue does not contain an AddLogin or ChangePassword type", async () => {
          const tab = createChromeTabMock({ id: 1 });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          notificationBackground["notificationQueue"] = [
            mock<AddUnlockVaultQueueMessage>({
              tab,
              type: NotificationQueueMessageType.UnlockVault,
            }),
          ];

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(updatePasswordSpy).not.toHaveBeenCalled();
          expect(editItemSpy).not.toHaveBeenCalled();
          expect(createWithServerSpy).not.toHaveBeenCalled();
        });

        it("skips saving the cipher if the notification queue message has a different domain than the passed tab", () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          notificationBackground["notificationQueue"] = [
            mock<AddLoginQueueMessage>({
              type: NotificationQueueMessageType.AddLogin,
              tab,
              domain: "another.com",
            }),
          ];

          sendMockExtensionMessage(message, sender);
          expect(updatePasswordSpy).not.toHaveBeenCalled();
          expect(editItemSpy).not.toHaveBeenCalled();
          expect(createWithServerSpy).not.toHaveBeenCalled();
        });

        it("updates the password if the notification message type is for ChangePassword", async () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          const queueMessage = mock<AddChangePasswordQueueMessage>({
            type: NotificationQueueMessageType.ChangePassword,
            tab,
            domain: "example.com",
            newPassword: "newPassword",
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>();
          getDecryptedCipherByIdSpy.mockResolvedValueOnce(cipherView);

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(editItemSpy).not.toHaveBeenCalled();
          expect(createWithServerSpy).not.toHaveBeenCalled();
          expect(updatePasswordSpy).toHaveBeenCalledWith(
            cipherView,
            queueMessage.newPassword,
            message.edit,
            sender.tab,
          );
          expect(updateWithServerSpy).toHaveBeenCalled();
          expect(tabSendMessageSpy).toHaveBeenCalledWith(sender.tab, {
            command: "saveCipherAttemptCompleted",
          });
        });

        it("updates the cipher password if the queue message was locked and an existing cipher has the same username as the message", async () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          const queueMessage = mock<AddLoginQueueMessage>({
            type: NotificationQueueMessageType.AddLogin,
            tab,
            domain: "example.com",
            username: "test",
            password: "updated-password",
            wasVaultLocked: true,
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({
            login: { username: "test", password: "old-password" },
          });
          getAllDecryptedForUrlSpy.mockResolvedValueOnce([cipherView]);

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(updatePasswordSpy).toHaveBeenCalledWith(
            cipherView,
            queueMessage.password,
            message.edit,
            sender.tab,
          );
          expect(editItemSpy).not.toHaveBeenCalled();
          expect(createWithServerSpy).not.toHaveBeenCalled();
        });

        it("opens an editItem window and closes the notification bar if the edit value is within the passed message when attempting to update an existing cipher", async () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: true,
            folder: "folder-id",
          };
          const queueMessage = mock<AddChangePasswordQueueMessage>({
            type: NotificationQueueMessageType.ChangePassword,
            tab,
            domain: "example.com",
            newPassword: "newPassword",
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>();
          getDecryptedCipherByIdSpy.mockResolvedValueOnce(cipherView);
          setAddEditCipherInfoSpy.mockResolvedValue(undefined);
          openAddEditVaultItemPopoutSpy.mockResolvedValue(undefined);

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(updatePasswordSpy).toHaveBeenCalledWith(
            cipherView,
            queueMessage.newPassword,
            message.edit,
            sender.tab,
          );
          expect(editItemSpy).toHaveBeenCalled();
          expect(updateWithServerSpy).not.toHaveBeenCalled();
          expect(tabSendMessageSpy).toHaveBeenCalledWith(sender.tab, {
            command: "closeNotificationBar",
          });
          expect(tabSendMessageSpy).toHaveBeenCalledWith(sender.tab, {
            command: "editedCipher",
          });
          expect(setAddEditCipherInfoSpy).toHaveBeenCalledWith({
            cipher: cipherView,
            collectionIds: cipherView.collectionIds,
          });
          expect(openAddEditVaultItemPopoutSpy).toHaveBeenCalledWith(sender.tab, {
            cipherId: cipherView.id,
          });
        });

        it("opens an editItem window and closes the notification bar if the edit value is within the passed message when attempting to save the cipher", async () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: true,
            folder: "folder-id",
          };
          const queueMessage = mock<AddLoginQueueMessage>({
            type: NotificationQueueMessageType.AddLogin,
            tab,
            domain: "example.com",
            username: "test",
            password: "password",
            wasVaultLocked: false,
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({
            login: { username: "test", password: "password" },
          });
          folderExistsSpy.mockResolvedValueOnce(true);
          convertAddLoginQueueMessageToCipherViewSpy.mockReturnValueOnce(cipherView);
          editItemSpy.mockResolvedValueOnce(undefined);

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(updatePasswordSpy).not.toHaveBeenCalled();
          expect(convertAddLoginQueueMessageToCipherViewSpy).toHaveBeenCalledWith(
            queueMessage,
            message.folder,
          );
          expect(editItemSpy).toHaveBeenCalledWith(cipherView, sender.tab);
          expect(tabSendMessageSpy).toHaveBeenCalledWith(sender.tab, {
            command: "closeNotificationBar",
          });
          expect(createWithServerSpy).not.toHaveBeenCalled();
        });

        it("creates the cipher within the server and sends an `saveCipherAttemptCompleted` and `addedCipher` message to the sender tab", async () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          const queueMessage = mock<AddLoginQueueMessage>({
            type: NotificationQueueMessageType.AddLogin,
            tab,
            domain: "example.com",
            username: "test",
            password: "password",
            wasVaultLocked: false,
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({
            login: { username: "test", password: "password" },
          });
          folderExistsSpy.mockResolvedValueOnce(false);
          convertAddLoginQueueMessageToCipherViewSpy.mockReturnValueOnce(cipherView);
          editItemSpy.mockResolvedValueOnce(undefined);

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(convertAddLoginQueueMessageToCipherViewSpy).toHaveBeenCalledWith(
            queueMessage,
            null,
          );
          expect(cipherEncryptSpy).toHaveBeenCalledWith(cipherView);
          expect(createWithServerSpy).toHaveBeenCalled();
          expect(tabSendMessageSpy).toHaveBeenCalledWith(sender.tab, {
            command: "saveCipherAttemptCompleted",
          });
          expect(tabSendMessageSpy).toHaveBeenCalledWith(sender.tab, { command: "addedCipher" });
        });

        it("sends an error message within the `saveCipherAttemptCompleted` message if the cipher cannot be saved to the server", async () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          const queueMessage = mock<AddLoginQueueMessage>({
            type: NotificationQueueMessageType.AddLogin,
            tab,
            domain: "example.com",
            username: "test",
            password: "password",
            wasVaultLocked: false,
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({
            login: { username: "test", password: "password" },
          });
          folderExistsSpy.mockResolvedValueOnce(true);
          convertAddLoginQueueMessageToCipherViewSpy.mockReturnValueOnce(cipherView);
          editItemSpy.mockResolvedValueOnce(undefined);
          const errorMessage = "fetch error";
          createWithServerSpy.mockImplementation(() => {
            throw new Error(errorMessage);
          });

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(cipherEncryptSpy).toHaveBeenCalledWith(cipherView);
          expect(createWithServerSpy).toThrow(errorMessage);
          expect(tabSendMessageSpy).not.toHaveBeenCalledWith(sender.tab, {
            command: "addedCipher",
          });
          expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
            sender.tab,
            "saveCipherAttemptCompleted",
            {
              error: errorMessage,
            },
          );
        });

        it("sends an error message within the `saveCipherAttemptCompleted` message if the cipher cannot be updated within the server", async () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          const queueMessage = mock<AddChangePasswordQueueMessage>({
            type: NotificationQueueMessageType.ChangePassword,
            tab,
            domain: "example.com",
            newPassword: "newPassword",
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>();
          getDecryptedCipherByIdSpy.mockResolvedValueOnce(cipherView);
          const errorMessage = "fetch error";
          updateWithServerSpy.mockImplementation(() => {
            throw new Error(errorMessage);
          });

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(updateWithServerSpy).toThrow(errorMessage);
          expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
            sender.tab,
            "saveCipherAttemptCompleted",
            {
              error: errorMessage,
            },
          );
        });
      });
    });

    describe("bgNeverSave message handler", () => {
      let tabSendMessageDataSpy: jest.SpyInstance;

      beforeEach(() => {
        tabSendMessageDataSpy = jest.spyOn(BrowserApi, "tabSendMessageData");
      });

      it("skips saving the domain as a never value if the passed tab does not exist within the notification queue", async () => {
        const tab = createChromeTabMock({ id: 2 });
        const sender = mock<chrome.runtime.MessageSender>({ tab });
        const message: NotificationBackgroundExtensionMessage = { command: "bgNeverSave" };
        notificationBackground["notificationQueue"] = [
          mock<AddLoginQueueMessage>({
            tab: createChromeTabMock({ id: 1 }),
          }),
          mock<AddLoginQueueMessage>({
            tab: createChromeTabMock({ id: 3 }),
          }),
        ];

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(tabSendMessageDataSpy).not.toHaveBeenCalled();
      });

      it("skips saving the domain as a never value if the tab does not contain an addLogin message within the NotificationQueue", async () => {
        const tab = createChromeTabMock({ id: 2 });
        const sender = mock<chrome.runtime.MessageSender>({ tab });
        const message: NotificationBackgroundExtensionMessage = { command: "bgNeverSave" };
        notificationBackground["notificationQueue"] = [
          mock<AddUnlockVaultQueueMessage>({ type: NotificationQueueMessageType.UnlockVault, tab }),
        ];

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(tabSendMessageDataSpy).not.toHaveBeenCalled();
      });

      it("skips saving the domain as a never value if the tab url does not match the queue message domain", async () => {
        const tab = createChromeTabMock({ id: 2, url: "https://example.com" });
        const sender = mock<chrome.runtime.MessageSender>({ tab });
        const message: NotificationBackgroundExtensionMessage = { command: "bgNeverSave" };
        notificationBackground["notificationQueue"] = [
          mock<AddLoginQueueMessage>({
            type: NotificationQueueMessageType.AddLogin,
            tab,
            domain: "another.com",
          }),
        ];

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(tabSendMessageDataSpy).not.toHaveBeenCalled();
      });

      it("saves the tabs domain as a never value and closes the notification bar", async () => {
        const tab = createChromeTabMock({ id: 2, url: "https://example.com" });
        const sender = mock<chrome.runtime.MessageSender>({ tab });
        const message: NotificationBackgroundExtensionMessage = { command: "bgNeverSave" };
        const firstNotification = mock<AddLoginQueueMessage>({
          type: NotificationQueueMessageType.AddLogin,
          tab,
          domain: "example.com",
        });
        const secondNotification = mock<AddLoginQueueMessage>({
          type: NotificationQueueMessageType.AddLogin,
          tab: createChromeTabMock({ id: 3 }),
          domain: "another.com",
        });
        notificationBackground["notificationQueue"] = [firstNotification, secondNotification];
        jest.spyOn(cipherService, "saveNeverDomain").mockImplementation();
        jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(tabSendMessageDataSpy).toHaveBeenCalledWith(tab, "closeNotificationBar");
        expect(cipherService.saveNeverDomain).toHaveBeenCalledWith("example.com");
        expect(notificationBackground["notificationQueue"]).toEqual([secondNotification]);
      });
    });

    describe("collectPageDetailsResponse", () => {
      let tabSendMessageDataSpy: jest.SpyInstance;

      beforeEach(() => {
        tabSendMessageDataSpy = jest.spyOn(BrowserApi, "tabSendMessageData");
      });

      it("skips sending the `notificationBarPageDetails` message if the message sender is not `notificationBar`", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "collectPageDetailsResponse",
          sender: "not-notificationBar",
        };

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(tabSendMessageDataSpy).not.toHaveBeenCalled();
      });

      it("sends a `notificationBarPageDetails` message with the forms with password fields", async () => {
        const tab = createChromeTabMock();
        const message: NotificationBackgroundExtensionMessage = {
          command: "collectPageDetailsResponse",
          sender: "notificationBar",
          details: createAutofillPageDetailsMock(),
          tab,
        };
        const formData = [mock<FormData>()];
        jest.spyOn(autofillService, "getFormsWithPasswordFields").mockReturnValueOnce(formData);

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
          message.tab,
          "notificationBarPageDetails",
          {
            details: message.details,
            forms: formData,
          },
        );
      });
    });

    describe("bgUnlockPopoutOpened message handler", () => {
      let getAuthStatusSpy: jest.SpyInstance;
      let pushUnlockVaultToQueueSpy: jest.SpyInstance;

      beforeEach(() => {
        getAuthStatusSpy = jest.spyOn(authService, "getAuthStatus");
        pushUnlockVaultToQueueSpy = jest.spyOn(
          notificationBackground as any,
          "pushUnlockVaultToQueue",
        );
      });

      it("skips pushing the unlock vault message to the queue if the message indicates that the notification should be skipped", async () => {
        const tabMock = createChromeTabMock();
        const sender = mock<chrome.runtime.MessageSender>({ tab: tabMock });
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgUnlockPopoutOpened",
          data: { skipNotification: true },
        };

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).not.toHaveBeenCalled();
        expect(pushUnlockVaultToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips pushing the unlock vault message to the queue if the auth status is not `Locked`", async () => {
        const tabMock = createChromeTabMock();
        const sender = mock<chrome.runtime.MessageSender>({ tab: tabMock });
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgUnlockPopoutOpened",
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.LoggedOut);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(getAuthStatusSpy).toHaveBeenCalled();
        expect(pushUnlockVaultToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips pushing the unlock vault message to the queue if the notification queue already has an item", async () => {
        const tabMock = createChromeTabMock();
        const sender = mock<chrome.runtime.MessageSender>({ tab: tabMock });
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgUnlockPopoutOpened",
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Locked);
        notificationBackground["notificationQueue"] = [mock<AddLoginQueueMessage>()];

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(pushUnlockVaultToQueueSpy).not.toHaveBeenCalled();
      });

      it("sends an unlock vault message to the queue if the user has a locked vault", async () => {
        const tabMock = createChromeTabMock({ url: "https://example.com" });
        const sender = mock<chrome.runtime.MessageSender>({ tab: tabMock });
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgUnlockPopoutOpened",
        };
        getAuthStatusSpy.mockResolvedValueOnce(AuthenticationStatus.Locked);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(pushUnlockVaultToQueueSpy).toHaveBeenCalledWith("example.com", sender.tab);
      });
    });

    describe("checkNotificationQueue", () => {
      let doNotificationQueueCheckSpy: jest.SpyInstance;
      let getTabFromCurrentWindowSpy: jest.SpyInstance;

      beforeEach(() => {
        doNotificationQueueCheckSpy = jest.spyOn(
          notificationBackground as any,
          "doNotificationQueueCheck",
        );
        getTabFromCurrentWindowSpy = jest.spyOn(BrowserApi, "getTabFromCurrentWindow");
      });

      it("skips checking the notification queue if the queue does not contain any items", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "checkNotificationQueue",
        };
        notificationBackground["notificationQueue"] = [];

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(doNotificationQueueCheckSpy).not.toHaveBeenCalled();
      });

      it("checks the notification queue for the sender tab", async () => {
        const tab = createChromeTabMock();
        const sender = mock<chrome.runtime.MessageSender>({ tab });
        const message: NotificationBackgroundExtensionMessage = {
          command: "checkNotificationQueue",
        };
        notificationBackground["notificationQueue"] = [
          mock<AddLoginQueueMessage>({ tab }),
          mock<AddLoginQueueMessage>({ tab: createChromeTabMock({ id: 2 }) }),
        ];

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(doNotificationQueueCheckSpy).toHaveBeenCalledWith(tab);
      });

      it("checks the notification queue for the current tab if the sender does not send a tab", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "checkNotificationQueue",
        };
        const currenTab = createChromeTabMock({ id: 2 });
        notificationBackground["notificationQueue"] = [
          mock<AddLoginQueueMessage>({ tab: currenTab }),
        ];
        getTabFromCurrentWindowSpy.mockResolvedValueOnce(currenTab);

        sendMockExtensionMessage(message, mock<chrome.runtime.MessageSender>({ tab: null }));
        await flushPromises();

        expect(getTabFromCurrentWindowSpy).toHaveBeenCalledWith();
        expect(doNotificationQueueCheckSpy).toHaveBeenCalledWith(currenTab);
      });
    });

    describe("bgReopenUnlockPopout message handler", () => {
      it("opens the unlock popout window", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "bgReopenUnlockPopout",
        };
        const openUnlockWindowSpy = jest.spyOn(notificationBackground as any, "openUnlockPopout");

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(openUnlockWindowSpy).toHaveBeenCalled();
      });
    });

    describe("getWebVaultUrlForNotification", () => {
      it("returns the web vault url", async () => {
        const message: NotificationBackgroundExtensionMessage = {
          command: "getWebVaultUrlForNotification",
        };
        const env = new SelfHostedEnvironment({ webVault: "https://example.com" });

        Object.defineProperty(environmentService, "environment$", {
          configurable: true,
          get: () => null,
        });

        const environmentServiceSpy = jest
          .spyOn(environmentService as any, "environment$", "get")
          .mockReturnValue(new BehaviorSubject(env).asObservable());

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(environmentServiceSpy).toHaveBeenCalled();
      });
    });
  });
});
