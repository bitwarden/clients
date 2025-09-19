import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { UserNotificationSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/user-notification-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { SelfHostedEnvironment } from "@bitwarden/common/platform/services/default-environment.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";
import { TaskService, SecurityTask } from "@bitwarden/common/vault/tasks";

import { BrowserApi } from "../../platform/browser/browser-api";
import { NotificationType } from "../enums/notification-type.enum";
import { FormData } from "../services/abstractions/autofill.service";
import AutofillService from "../services/autofill.service";
import { createAutofillPageDetailsMock, createChromeTabMock } from "../spec/autofill-mocks";
import { flushPromises, sendMockExtensionMessage } from "../spec/testing-utils";

import {
  AddChangePasswordNotificationQueueMessage,
  AddLoginQueueMessage,
  AddUnlockVaultQueueMessage,
  LockedVaultPendingNotificationsData,
  NotificationBackgroundExtensionMessage,
} from "./abstractions/notification.background";
import { ModifyLoginCipherFormData } from "./abstractions/overlay-notifications.background";
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
  const messagingService = mock<MessagingService>();
  const taskService = mock<TaskService>();
  let notificationBackground: NotificationBackground;
  const autofillService = mock<AutofillService>();
  const cipherService = mock<CipherService>();
  const collectionService = mock<CollectionService>();
  let activeAccountStatusMock$: BehaviorSubject<AuthenticationStatus>;
  let authService: MockProxy<AuthService>;
  const policyAppliesToUser$ = new BehaviorSubject<boolean>(true);
  const policyService = mock<PolicyService>({
    policyAppliesToUser$: jest.fn().mockReturnValue(policyAppliesToUser$),
  });
  const folderService = mock<FolderService>();
  const enableChangedPasswordPromptMock$ = new BehaviorSubject(true);
  const userNotificationSettingsService = mock<UserNotificationSettingsServiceAbstraction>();
  userNotificationSettingsService.enableChangedPasswordPrompt$ = enableChangedPasswordPromptMock$;

  const domainSettingsService = mock<DomainSettingsService>();
  const environmentService = mock<EnvironmentService>();
  const logService = mock<LogService>();
  const selectedThemeMock$ = new BehaviorSubject(ThemeTypes.Light);
  const themeStateService = mock<ThemeStateService>();
  themeStateService.selectedTheme$ = selectedThemeMock$;
  const configService = mock<ConfigService>();
  const accountService = mock<AccountService>();
  const organizationService = mock<OrganizationService>();

  const userId = "testId" as UserId;
  const activeAccountSubject = new BehaviorSubject<{ id: UserId } & AccountInfo>({
    id: userId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  });

  beforeEach(() => {
    activeAccountStatusMock$ = new BehaviorSubject(AuthenticationStatus.Locked);
    authService = mock<AuthService>();
    authService.activeAccountStatus$ = activeAccountStatusMock$;
    accountService.activeAccount$ = activeAccountSubject;
    notificationBackground = new NotificationBackground(
      accountService,
      authService,
      autofillService,
      cipherService,
      collectionService,
      configService,
      domainSettingsService,
      environmentService,
      folderService,
      logService,
      organizationService,
      policyService,
      themeStateService,
      userNotificationSettingsService,
      taskService,
      messagingService,
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
        launchTimestamp: 0,
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
        launchTimestamp: 0,
      };
      const cipherView = notificationBackground["convertAddLoginQueueMessageToCipherView"](
        message,
        folderId,
      );

      expect(cipherView.folderId).toEqual(folderId);
    });
  });

  describe("notification bar extension message handlers and triggers", () => {
    beforeEach(() => {
      notificationBackground.init();
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
            commandToRetry: { message: { command: ExtensionCommand.AutofillLogin } },
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
          message.data?.commandToRetry?.message,
          message.data?.commandToRetry?.sender,
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
          { fadeOutNotification: false },
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

    describe("bgTriggerAddLoginNotification message handler", () => {
      let tab: chrome.tabs.Tab;
      let sender: chrome.runtime.MessageSender;
      let getEnableAddedLoginPromptSpy: jest.SpyInstance;
      let pushAddLoginToQueueSpy: jest.SpyInstance;
      let pushChangePasswordToQueueSpy: jest.SpyInstance;
      let getAllDecryptedForUrlSpy: jest.SpyInstance;
      const mockModifyLoginCipherFormData: ModifyLoginCipherFormData = {
        username: "test",
        password: "password",
        uri: "https://example.com",
        newPassword: null,
      };
      beforeEach(() => {
        tab = createChromeTabMock();
        sender = mock<chrome.runtime.MessageSender>({ tab });
        getEnableAddedLoginPromptSpy = jest.spyOn(
          notificationBackground as any,
          "getEnableAddedLoginPrompt",
        );

        pushAddLoginToQueueSpy = jest.spyOn(notificationBackground as any, "pushAddLoginToQueue");
        pushChangePasswordToQueueSpy = jest.spyOn(
          notificationBackground as any,
          "pushChangePasswordToQueue",
        );
        getAllDecryptedForUrlSpy = jest.spyOn(cipherService, "getAllDecryptedForUrl");
      });

      it("skips attempting to add the login if the user is logged out", async () => {
        const data: ModifyLoginCipherFormData = mockModifyLoginCipherFormData;
        activeAccountStatusMock$.next(AuthenticationStatus.LoggedOut);

        await notificationBackground.triggerAddLoginNotification(data, tab);

        expect(getEnableAddedLoginPromptSpy).not.toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to add the login if the login data does not contain a valid url", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "",
        };
        activeAccountStatusMock$.next(AuthenticationStatus.Locked);

        await notificationBackground.triggerAddLoginNotification(data, tab);

        expect(getEnableAddedLoginPromptSpy).not.toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to add the login if the user with a locked vault has disabled the login notification", async () => {
        const data: ModifyLoginCipherFormData = mockModifyLoginCipherFormData;
        activeAccountStatusMock$.next(AuthenticationStatus.Locked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);

        await notificationBackground.triggerAddLoginNotification(data, tab);

        expect(getEnableAddedLoginPromptSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).not.toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to add the login if the user with an unlocked vault has disabled the login notification", async () => {
        const data: ModifyLoginCipherFormData = mockModifyLoginCipherFormData;
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([]);

        await notificationBackground.triggerAddLoginNotification(data, tab);

        expect(getEnableAddedLoginPromptSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to change the password for an existing login if the password has not changed", async () => {
        const data: ModifyLoginCipherFormData = mockModifyLoginCipherFormData;
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(true);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "test", password: "password" } }),
        ]);

        await notificationBackground.triggerAddLoginNotification(data, tab);

        expect(getEnableAddedLoginPromptSpy).toHaveBeenCalled();
        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("adds the login to the queue if the user has a locked account", async () => {
        const data: ModifyLoginCipherFormData = mockModifyLoginCipherFormData;
        activeAccountStatusMock$.next(AuthenticationStatus.Locked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(true);

        await notificationBackground.triggerAddLoginNotification(data, tab);

        expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
          "example.com",
          {
            url: data.uri,
            username: data.username,
            password: data.password,
          },
          sender.tab,
          true,
        );
      });

      it("adds the login to the queue if the user has an unlocked account and the login is new", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          username: null,
        };

        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(true);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "anotherTestUsername", password: "password" } }),
        ]);

        await notificationBackground.triggerAddLoginNotification(data, tab);

        expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
          "example.com",
          {
            url: data.uri,
            username: data.username,
            password: data.password,
          },
          sender.tab,
        );
      });
    });

    describe("bgTriggerChangedPasswordNotification message handler", () => {
      let tab: chrome.tabs.Tab;
      let sender: chrome.runtime.MessageSender;
      let getEnableChangedPasswordPromptSpy: jest.SpyInstance;
      let pushChangePasswordToQueueSpy: jest.SpyInstance;
      let getAllDecryptedForUrlSpy: jest.SpyInstance;
      const mockModifyLoginCipherFormData: ModifyLoginCipherFormData = {
        username: null,
        uri: null,
        password: "currentPassword",
        newPassword: "newPassword",
      };

      beforeEach(() => {
        tab = createChromeTabMock();
        sender = mock<chrome.runtime.MessageSender>({ tab });
        getEnableChangedPasswordPromptSpy = jest.spyOn(
          notificationBackground as any,
          "getEnableChangedPasswordPrompt",
        );

        pushChangePasswordToQueueSpy = jest.spyOn(
          notificationBackground as any,
          "pushChangePasswordToQueue",
        );
        getAllDecryptedForUrlSpy = jest.spyOn(cipherService, "getAllDecryptedForUrl");
      });

      afterEach(() => {
        getEnableChangedPasswordPromptSpy.mockRestore();
        pushChangePasswordToQueueSpy.mockRestore();
        getAllDecryptedForUrlSpy.mockRestore();
      });

      it("skips attempting to change the password for an existing login if the user has disabled changing the password notification", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
        };
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "test", password: "oldPassword" } }),
        ]);

        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to add the change password message to the queue if the user is logged out", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
        };

        activeAccountStatusMock$.next(AuthenticationStatus.LoggedOut);

        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("skips attempting to add the change password message to the queue if the passed url is not valid", async () => {
        const data: ModifyLoginCipherFormData = mockModifyLoginCipherFormData;

        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("only only includes ciphers in notification data matching a username if username was present in the modify form data", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
          username: "userName",
        };

        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id-1",
            login: { username: "test", password: "currentPassword" },
          }),
          mock<CipherView>({
            id: "cipher-id-2",
            login: { username: "username", password: "currentPassword" },
          }),
          mock<CipherView>({
            id: "cipher-id-3",
            login: { username: "uSeRnAmE", password: "currentPassword" },
          }),
        ]);

        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          ["cipher-id-2", "cipher-id-3"],
          "example.com",
          data?.newPassword,
          sender.tab,
        );
      });

      it("adds a change password message to the queue with current password, if there is a current password, but no new password", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
          password: "newPasswordUpdatedElsewhere",
          newPassword: null,
        };
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id-1",
            login: { password: "currentPassword" },
          }),
        ]);
        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          ["cipher-id-1"],
          "example.com",
          data?.password,
          sender.tab,
        );
      });

      it("adds a change password message to the queue with new password, if new password is provided", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
          password: "password2",
          newPassword: "password3",
        };
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id-1",
            login: { password: "password1" },
          }),
          mock<CipherView>({
            id: "cipher-id-4",
            login: { password: "password4" },
          }),
        ]);
        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          ["cipher-id-1", "cipher-id-4"],
          "example.com",
          data?.newPassword,
          sender.tab,
        );
      });

      it("adds a change password message to the queue if the user has a locked account", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
        };

        activeAccountStatusMock$.next(AuthenticationStatus.Locked);

        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          null,
          "example.com",
          data?.newPassword,
          sender.tab,
          true,
        );
      });

      it("doesn't add a password if there is no current or new password", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
          password: null,
          newPassword: null,
        };
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({ login: { username: "test", password: "password" } }),
        ]);
        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(getAllDecryptedForUrlSpy).toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      });

      it("adds a change password message to the queue if a single cipher matches the passed current password", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
        };
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id",
            login: { username: "test", password: "currentPassword" },
          }),
        ]);

        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          ["cipher-id"],
          "example.com",
          data?.newPassword,
          sender.tab,
        );
      });

      it("adds a change password message with all matching ciphers if no current password is passed and more than one cipher is found for a url", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
          password: null,
        };
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id-1",
            login: { username: "test", password: "password" },
          }),
          mock<CipherView>({
            id: "cipher-id-2",
            login: { username: "test2", password: "password" },
          }),
        ]);

        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          ["cipher-id-1", "cipher-id-2"],
          "example.com",
          data?.newPassword,
          sender.tab,
        );
      });

      it("adds a change password message to the queue if no current password is passed with the message, but a single cipher is matched for the uri", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
          password: null,
        };
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce([
          mock<CipherView>({
            id: "cipher-id",
            login: { username: "test", password: "password" },
          }),
        ]);

        await notificationBackground.triggerChangedPasswordNotification(data, tab);

        expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
          ["cipher-id"],
          "example.com",
          data?.newPassword,
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
      let tabSendMessageDataSpy: jest.SpyInstance;
      let openUnlockPopoutSpy: jest.SpyInstance;

      beforeEach(() => {
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
        activeAccountStatusMock$.next(AuthenticationStatus.Locked);

        sendMockExtensionMessage(message, sender);
        await flushPromises();

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
          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
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

          accountService.activeAccount$ = activeAccountSubject;
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
              type: NotificationType.UnlockVault,
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
              type: NotificationType.AddLogin,
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
          const queueMessage = mock<AddChangePasswordNotificationQueueMessage>({
            type: NotificationType.ChangePassword,
            tab,
            domain: "example.com",
            data: { newPassword: "newPassword" },
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({
            id: "testId",
            name: "testItemName",
            login: { username: "testUser" },
            reprompt: CipherRepromptType.None,
          });
          getDecryptedCipherByIdSpy.mockResolvedValueOnce(cipherView);
          taskService.tasksEnabled$.mockImplementation(() => of(false));

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(editItemSpy).not.toHaveBeenCalled();
          expect(createWithServerSpy).not.toHaveBeenCalled();
          expect(updatePasswordSpy).toHaveBeenCalledWith(
            cipherView,
            queueMessage.data.newPassword,
            message.edit,
            sender.tab,
            "testId",
            false,
          );
          expect(updateWithServerSpy).toHaveBeenCalled();
          expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
            sender.tab,
            "saveCipherAttemptCompleted",
            {
              itemName: "testItemName",
              cipherId: cipherView.id,
              task: undefined,
            },
          );
        });

        it("prompts the user for master password entry if the notification message type is for ChangePassword and the cipher reprompt is enabled", async () => {
          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          const queueMessage = mock<AddChangePasswordNotificationQueueMessage>({
            type: NotificationType.ChangePassword,
            tab,
            domain: "example.com",
            data: { newPassword: "newPassword" },
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({
            id: "testId",
            name: "testItemName",
            login: { username: "testUser" },
            reprompt: CipherRepromptType.Password,
          });
          getDecryptedCipherByIdSpy.mockResolvedValueOnce(cipherView);
          taskService.tasksEnabled$.mockImplementation(() => of(false));
          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(editItemSpy).not.toHaveBeenCalled();
          expect(autofillService.isPasswordRepromptRequired).toHaveBeenCalled();
          expect(createWithServerSpy).not.toHaveBeenCalled();
          expect(updatePasswordSpy).toHaveBeenCalledWith(
            cipherView,
            queueMessage.data.newPassword,
            message.edit,
            sender.tab,
            "testId",
            false,
          );
          expect(updateWithServerSpy).not.toHaveBeenCalled();
          expect(tabSendMessageDataSpy).not.toHaveBeenCalledWith(
            sender.tab,
            "saveCipherAttemptCompleted",
            {
              itemName: "testItemName",
              cipherId: cipherView.id,
              task: undefined,
            },
          );
        });

        it("completes password update notification with a security task notice if any are present for the cipher, and dismisses tasks for the updated cipher", async () => {
          const mockCipherId = "testId";
          const mockOrgId = "testOrgId";
          const mockSecurityTask = {
            id: "testTaskId",
            organizationId: mockOrgId,
            cipherId: mockCipherId,
            type: 0,
            status: 0,
            creationDate: new Date(),
            revisionDate: new Date(),
          } as SecurityTask;
          const mockSecurityTask2 = {
            ...mockSecurityTask,
            id: "testTaskId2",
            cipherId: "testId2",
          } as SecurityTask;
          taskService.tasksEnabled$.mockImplementation(() => of(true));
          taskService.pendingTasks$.mockImplementation(() =>
            of([mockSecurityTask, mockSecurityTask2]),
          );
          jest.spyOn(notificationBackground as any, "getOrgData").mockResolvedValueOnce([
            {
              id: mockOrgId,
              name: "Org Name, LLC",
              productTierType: 3,
            },
          ]);

          const tab = createChromeTabMock({ id: 1, url: "https://example.com" });
          const sender = mock<chrome.runtime.MessageSender>({ tab });
          const message: NotificationBackgroundExtensionMessage = {
            command: "bgSaveCipher",
            edit: false,
            folder: "folder-id",
          };
          const queueMessage = mock<AddChangePasswordNotificationQueueMessage>({
            type: NotificationType.ChangePassword,
            tab,
            domain: "example.com",
            data: { newPassword: "newPassword" },
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({
            id: mockCipherId,
            organizationId: mockOrgId,
            name: "Test Item",
            reprompt: CipherRepromptType.None,
          });
          getDecryptedCipherByIdSpy.mockResolvedValueOnce(cipherView);

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(editItemSpy).not.toHaveBeenCalled();
          expect(createWithServerSpy).not.toHaveBeenCalled();
          expect(updatePasswordSpy).toHaveBeenCalledWith(
            cipherView,
            queueMessage.data.newPassword,
            message.edit,
            sender.tab,
            mockCipherId,
            false,
          );
          expect(updateWithServerSpy).toHaveBeenCalled();
          expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
            sender.tab,
            "saveCipherAttemptCompleted",
            {
              cipherId: "testId",
              itemName: "Test Item",
              task: {
                orgName: "Org Name, LLC",
                remainingTasksCount: 1,
              },
            },
          );
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
            type: NotificationType.AddLogin,
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
            "testId",
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
          const queueMessage = mock<AddChangePasswordNotificationQueueMessage>({
            type: NotificationType.ChangePassword,
            tab,
            domain: "example.com",
            data: { newPassword: "newPassword" },
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
            queueMessage.data.newPassword,
            message.edit,
            sender.tab,
            "testId",
            false,
          );
          expect(editItemSpy).toHaveBeenCalled();
          expect(updateWithServerSpy).not.toHaveBeenCalled();
          expect(tabSendMessageSpy).toHaveBeenCalledWith(sender.tab, {
            command: "closeNotificationBar",
          });
          expect(tabSendMessageSpy).toHaveBeenCalledWith(sender.tab, {
            command: "editedCipher",
          });
          expect(setAddEditCipherInfoSpy).toHaveBeenCalledWith(
            {
              cipher: cipherView,
              collectionIds: cipherView.collectionIds,
            },
            "testId",
          );
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
            type: NotificationType.AddLogin,
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
          expect(editItemSpy).toHaveBeenCalledWith(cipherView, "testId", sender.tab);
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
            type: NotificationType.AddLogin,
            tab,
            domain: "example.com",
            username: "test",
            password: "password",
            wasVaultLocked: false,
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({
            id: "testId",
            name: "testName",
            login: { username: "test", password: "password" },
          });
          folderExistsSpy.mockResolvedValueOnce(false);
          convertAddLoginQueueMessageToCipherViewSpy.mockReturnValueOnce(cipherView);
          editItemSpy.mockResolvedValueOnce(undefined);
          cipherEncryptSpy.mockResolvedValueOnce({
            cipher: {
              ...cipherView,
              id: "testId",
            },
            encryptedFor: userId,
          });

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(convertAddLoginQueueMessageToCipherViewSpy).toHaveBeenCalledWith(
            queueMessage,
            null,
          );
          expect(cipherEncryptSpy).toHaveBeenCalledWith(cipherView, "testId");
          expect(createWithServerSpy).toHaveBeenCalled();
          expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
            sender.tab,
            "saveCipherAttemptCompleted",
            {
              cipherId: cipherView.id,
              itemName: cipherView.name,
            },
          );
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
            type: NotificationType.AddLogin,
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
          cipherEncryptSpy.mockResolvedValueOnce({
            cipher: {
              ...cipherView,
              id: "testId",
            },
            encryptedFor: userId,
          });
          const errorMessage = "fetch error";
          createWithServerSpy.mockImplementation(() => {
            throw new Error(errorMessage);
          });

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(cipherEncryptSpy).toHaveBeenCalledWith(cipherView, "testId");
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
          const queueMessage = mock<AddChangePasswordNotificationQueueMessage>({
            type: NotificationType.ChangePassword,
            tab,
            domain: "example.com",
            data: { newPassword: "newPassword" },
          });
          notificationBackground["notificationQueue"] = [queueMessage];
          const cipherView = mock<CipherView>({ reprompt: CipherRepromptType.None });
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
          mock<AddUnlockVaultQueueMessage>({ type: NotificationType.UnlockVault, tab }),
        ];

        sendMockExtensionMessage(message, sender);
        await flushPromises();

        expect(tabSendMessageDataSpy).not.toHaveBeenCalled();
      });

      it("skips saving the domain as a never value if the tab url does not match the queue message domain", async () => {
        const tab = createChromeTabMock({ id: 2, url: "https://example.com" });
        const message: NotificationBackgroundExtensionMessage = { command: "bgNeverSave" };
        const secondaryTab = createChromeTabMock({ id: 3, url: "https://another.com" });
        const sender = mock<chrome.runtime.MessageSender>({ tab: secondaryTab });
        notificationBackground["notificationQueue"] = [
          mock<AddLoginQueueMessage>({
            type: NotificationType.AddLogin,
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
          type: NotificationType.AddLogin,
          tab,
          domain: "example.com",
        });
        const secondNotification = mock<AddLoginQueueMessage>({
          type: NotificationType.AddLogin,
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
