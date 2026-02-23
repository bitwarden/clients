import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";
import { TaskService, SecurityTask } from "@bitwarden/common/vault/tasks";

import { BrowserApi } from "../../platform/browser/browser-api";
import { NotificationType } from "../enums/notification-type.enum";
import { Fido2Background } from "../fido2/background/abstractions/fido2.background";
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
  const enableAddedLoginPromptMock$ = new BehaviorSubject(true);
  const userNotificationSettingsService = mock<UserNotificationSettingsServiceAbstraction>();
  userNotificationSettingsService.enableChangedPasswordPrompt$ = enableChangedPasswordPromptMock$;
  userNotificationSettingsService.enableAddedLoginPrompt$ = enableAddedLoginPromptMock$;

  const domainSettingsService = mock<DomainSettingsService>();
  const environmentService = mock<EnvironmentService>();
  const logService = mock<LogService>();
  const selectedThemeMock$ = new BehaviorSubject(ThemeTypes.Light);
  const themeStateService = mock<ThemeStateService>();
  themeStateService.selectedTheme$ = selectedThemeMock$;
  const configService = mock<ConfigService>();
  const accountService = mock<AccountService>();
  const organizationService = mock<OrganizationService>();
  const fido2Background = mock<Fido2Background>();
  fido2Background.isCredentialRequestInProgress.mockReturnValue(false);

  const userId = "testId" as UserId;
  const activeAccountSubject = new BehaviorSubject({
    id: userId,
    ...mockAccountInfoWith({
      email: "test@example.com",
      name: "Test User",
    }),
  });

  beforeEach(() => {
    activeAccountStatusMock$ = new BehaviorSubject(
      AuthenticationStatus.Locked as AuthenticationStatus,
    );
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
      fido2Background,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("convertAddLoginQueueMessageToCipherView", () => {
    it("returns a cipher view when passed an `AddLoginQueueMessage`", () => {
      const message: AddLoginQueueMessage = {
        type: "add",
        data: {
          username: "test",
          password: "password",
          uri: "https://example.com",
        },
        domain: "",
        tab: createChromeTabMock(),
        expires: new Date(),
        wasVaultLocked: false,
        launchTimestamp: 0,
      };
      const cipherView = notificationBackground["convertAddLoginQueueMessageToCipherView"](message);

      expect(cipherView.name).toEqual("example.com");
      expect(cipherView.login).toEqual({
        fido2Credentials: [],
        password: message.data.password,
        uris: [
          {
            _uri: message.data.uri,
          },
        ],
        username: message.data.username,
      });
    });

    it("returns a cipher view assigned to an existing folder id", () => {
      const folderId = "folder-id";
      const message: AddLoginQueueMessage = {
        type: "add",
        data: {
          username: "test",
          password: "password",
          uri: "https://example.com",
        },
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

    it("removes 'www.' prefix from hostname when generating cipher name", () => {
      const message: AddLoginQueueMessage = {
        type: "add",
        data: {
          username: "test",
          password: "password",
          uri: "https://www.example.com",
        },
        domain: "www.example.com",
        tab: createChromeTabMock(),
        expires: new Date(),
        wasVaultLocked: false,
        launchTimestamp: 0,
      };
      const cipherView = notificationBackground["convertAddLoginQueueMessageToCipherView"](message);

      expect(cipherView.name).toEqual("example.com");
    });

    it("uses domain as fallback when hostname cannot be extracted from uri", () => {
      const message: AddLoginQueueMessage = {
        type: "add",
        data: {
          username: "test",
          password: "password",
          uri: "",
        },
        domain: "fallback-domain.com",
        tab: createChromeTabMock(),
        expires: new Date(),
        wasVaultLocked: false,
        launchTimestamp: 0,
      };
      const cipherView = notificationBackground["convertAddLoginQueueMessageToCipherView"](message);

      expect(cipherView.name).toEqual("fallback-domain.com");
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
        newPassword: "",
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
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);

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
          true, // will yield an unlock followed by a new password notification
        );
      });

      it("adds the login to the queue if the user has an unlocked account and the login is new", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          username: "",
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
        username: "",
        uri: "",
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
          newPassword: "",
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
          true, // will yield an unlock followed by an update password notification
        );
      });

      it("doesn't add a password if there is no current or new password", async () => {
        const data: ModifyLoginCipherFormData = {
          ...mockModifyLoginCipherFormData,
          uri: "https://example.com",
          password: "",
          newPassword: "",
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
          password: "",
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
          password: "",
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

    describe("triggerCipherNotification message handler", () => {
      let tab: chrome.tabs.Tab;
      let sender: chrome.runtime.MessageSender;
      let getEnableChangedPasswordPromptSpy: jest.SpyInstance;
      let getEnableAddedLoginPromptSpy: jest.SpyInstance;
      let pushChangePasswordToQueueSpy: jest.SpyInstance;
      let pushAddLoginToQueueSpy: jest.SpyInstance;
      let getAllDecryptedForUrlSpy: jest.SpyInstance;
      const mockFormattedURI = "archive.org";
      const mockFormURI = "https://www.archive.org";
      const expectSkippedCheckingNotification = () => {
        expect(getAllDecryptedForUrlSpy).not.toHaveBeenCalled();
        expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
      };

      beforeEach(() => {
        tab = createChromeTabMock();
        sender = mock<chrome.runtime.MessageSender>({ tab });
        getEnableAddedLoginPromptSpy = jest.spyOn(
          notificationBackground as any,
          "getEnableAddedLoginPrompt",
        );
        getEnableChangedPasswordPromptSpy = jest.spyOn(
          notificationBackground as any,
          "getEnableChangedPasswordPrompt",
        );
        pushChangePasswordToQueueSpy = jest.spyOn(
          notificationBackground as any,
          "pushChangePasswordToQueue",
        );
        pushAddLoginToQueueSpy = jest.spyOn(notificationBackground as any, "pushAddLoginToQueue");
        getAllDecryptedForUrlSpy = jest.spyOn(cipherService, "getAllDecryptedForUrl");
      });

      afterEach(() => {
        getEnableAddedLoginPromptSpy.mockRestore();
        getEnableChangedPasswordPromptSpy.mockRestore();
        pushChangePasswordToQueueSpy.mockRestore();
        pushAddLoginToQueueSpy.mockRestore();
        getAllDecryptedForUrlSpy.mockRestore();
      });

      it("skips checking if a notification should trigger if no fields were filled", async () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "",
          password: "",
          uri: mockFormURI,
          username: "",
        };

        const storedCiphersForURL = [
          mock<CipherView>({
            id: "cipher-id-1",
            login: { password: "I<3VogonPoetry", username: "ADent" },
          }),
        ];

        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

        await notificationBackground.triggerCipherNotification(formEntryData, tab);

        expectSkippedCheckingNotification();
      });

      it("skips checking if a notification should trigger if the passed url is not valid", async () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "Bab3lPhs5h",
          password: "I<3VogonPoetry",
          uri: "",
          username: "ADent",
        };

        const storedCiphersForURL = [
          mock<CipherView>({
            id: "cipher-id-1",
            login: { password: "I<3VogonPoetry", username: "ADent" },
          }),
        ];

        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

        await notificationBackground.triggerCipherNotification(formEntryData, tab);

        expectSkippedCheckingNotification();
      });

      it("skips checking if a notification should trigger if a fido2 credential request is in progress for the tab", async () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "",
          password: "",
          uri: mockFormURI,
          username: "ADent",
        };

        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        fido2Background.isCredentialRequestInProgress.mockReturnValueOnce(true);

        await notificationBackground.triggerCipherNotification(formEntryData, tab);

        expectSkippedCheckingNotification();
      });

      it("skips checking if a notification should trigger if the user has disabled both the new login and update password notification", async () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "Bab3lPhs5h",
          password: "I<3VogonPoetry",
          uri: mockFormURI,
          username: "ADent",
        };

        const storedCiphersForURL = [
          mock<CipherView>({ login: { username: "ADent", password: "I<3VogonPoetry" } }),
        ];

        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);
        getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

        await notificationBackground.triggerCipherNotification(formEntryData, tab);

        expectSkippedCheckingNotification();
      });

      it("skips checking if a notification should trigger if the user is logged out", async () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "Bab3lPhs5h",
          password: "I<3VogonPoetry",
          uri: mockFormURI,
          username: "ADent",
        };

        const storedCiphersForURL = [
          mock<CipherView>({ login: { username: "ADent", password: "I<3VogonPoetry" } }),
        ];

        activeAccountStatusMock$.next(AuthenticationStatus.LoggedOut);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

        await notificationBackground.triggerCipherNotification(formEntryData, tab);

        expectSkippedCheckingNotification();
      });

      it("skips checking if a notification should trigger if there is no active account", async () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "Bab3lPhs5h",
          password: "I<3VogonPoetry",
          uri: mockFormURI,
          username: "ADent",
        };

        const storedCiphersForURL = [
          mock<CipherView>({ login: { username: "ADent", password: "I<3VogonPoetry" } }),
        ];

        accountService.activeAccount$ = new BehaviorSubject(null);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

        await notificationBackground.triggerCipherNotification(formEntryData, tab);

        expectSkippedCheckingNotification();
      });

      it("skips checking if a notification should trigger if the values for the `password` and `newPassword` fields match (no change)", async () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "Beeblebrox4Prez",
          password: "Beeblebrox4Prez",
          uri: mockFormURI,
          username: "ADent",
        };

        const storedCiphersForURL = [
          mock<CipherView>({ login: { username: "ADent", password: "I<3VogonPoetry" } }),
        ];

        getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

        await notificationBackground.triggerCipherNotification(formEntryData, tab);

        expectSkippedCheckingNotification();
      });

      it("skips checking if a notification should trigger if the vault is locked and there is no value for the `newPassword` field", async () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "",
          password: "Beeblebrox4Prez",
          uri: mockFormURI,
          username: "ADent",
        };

        const storedCiphersForURL = [
          mock<CipherView>({ login: { username: "ADent", password: "I<3VogonPoetry" } }),
        ];

        activeAccountStatusMock$.next(AuthenticationStatus.Locked);
        getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

        await notificationBackground.triggerCipherNotification(formEntryData, tab);

        expectSkippedCheckingNotification();
      });

      describe("when `username` and `password` and `newPassword` fields are filled, ", () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "Edro2x",
          password: "UShallKnotPassword",
          uri: mockFormURI,
          username: "gandalfG",
        };

        it("and the user vault is locked, trigger an unlock notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "Edro2x", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Locked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(getAllDecryptedForUrlSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();

          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            null,
            mockFormattedURI,
            formEntryData.newPassword,
            tab,
            true, // will yield an unlock prompt followed by an update password prompt
          );
        });

        it("and cipher update candidates match `newPassword` only, trigger a new cipher notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "Edro2x", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
            mockFormattedURI,
            {
              password: formEntryData.newPassword,
              url: formEntryData.uri,
              username: formEntryData.username,
            },
            sender.tab,
          );
        });

        it("and cipher update candidates match `newPassword` only, do not trigger a new cipher notification if the new cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "Edro2x", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match `password` only, trigger an update cipher notification with those candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "UShallKnotPassword", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "UShallKnotPassword", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-1", "cipher-id-2"],
            mockFormattedURI,
            formEntryData.newPassword,
            sender.tab,
          );
        });

        it("and cipher update candidates match `password` only, do not trigger an update cipher notification if the update notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "UShallKnotPassword", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "UShallKnotPassword", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match `password` only, as well as `newPassword` only, trigger a new cipher notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "UShallKnotPassword", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "Edro2x", username: "TBombadil" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "UShallKnotPassword", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-4",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
            mockFormattedURI,
            {
              password: formEntryData.newPassword,
              url: formEntryData.uri,
              username: formEntryData.username,
            },
            sender.tab,
          );
        });

        it("and cipher update candidates match `username` only, trigger an update cipher notification with those candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "EdroEdro", username: "gandalfG" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-2"],
            mockFormattedURI,
            formEntryData.newPassword,
            sender.tab,
          );
        });

        it("and cipher update candidates match `username` only, do not trigger an update cipher notification if the update notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "EdroEdro", username: "gandalfG" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match `username` only, as well as `password` or `newPassword` only, trigger an update cipher notification with the candidates `username`", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "UShallKnotPassword", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "Edro2x", username: "BBaggins" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "EdroEdro", username: "gandalfG" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-3"],
            mockFormattedURI,
            formEntryData.newPassword,
            sender.tab,
          );
        });

        it("and cipher update candidates match `username` and `newPassword`, do not trigger an update (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "sting123", username: "BBaggins" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "Edro2x", username: "gandalfG" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match `username` and `newPassword` as well as any other combination of `username`, `password`, and/or `newPassword`, do not trigger an update (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "sting123", username: "BBaggins" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "Edro2x", username: "gandalfG" },
            }),
            mock<CipherView>({
              id: "cipher-id-4",
              login: { password: "UShallKnotPassword", username: "gandalfG" },
            }),
            mock<CipherView>({
              id: "cipher-id-5",
              login: { password: "Edro2x", username: "FBaggins" },
            }),
            mock<CipherView>({
              id: "cipher-id-6",
              login: { password: "UShallKnotPassword", username: "TBombadil" },
            }),
            mock<CipherView>({
              id: "cipher-id-7",
              login: { password: "ShyerH1re", username: "gandalfG" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match `username` and `password`, trigger an update cipher notification with those candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "UShallKnotPassword", username: "gandalfG" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-1"],
            mockFormattedURI,
            formEntryData.newPassword,
            sender.tab,
          );
        });

        it("and cipher update candidates match `username` and `password`, do not trigger an update cipher notification if the update notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "UShallKnotPassword", username: "gandalfG" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match `username` AND `password` as well as any OTHER combination of `username`, `password`, and/or `newPassword` (excluding `username` AND `newPassword`), trigger an update cipher notification with the candidates matching `username` AND `password`", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "UShallKnotPassword", username: "TBombadil" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "Edro2x", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "UShallKnotPassword", username: "gandalfG" },
            }),
            mock<CipherView>({
              id: "cipher-id-4",
              login: { password: "flyUPh00lz", username: "gandalfG" },
            }),
            mock<CipherView>({
              id: "cipher-id-5",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-6",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-3"],
            mockFormattedURI,
            formEntryData.newPassword,
            sender.tab,
          );
        });

        it("and no cipher update candidates match `username`, `password`, nor `newPassword`, trigger a new cipher notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "EdroEdro", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
            mockFormattedURI,
            {
              password: formEntryData.newPassword,
              url: formEntryData.uri,
              username: formEntryData.username,
            },
            sender.tab,
          );
        });

        it("and no cipher update candidates match `username`, `password`, nor `newPassword`, do not trigger a new cipher notification if the new cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { password: "galadriel4Eva", username: "gandalfW" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { password: "EdroEdro", username: "shadowfax" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { password: "sting123", username: "BBaggins" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });
      });

      describe("when `username` and `newPassword` fields are filled, ", () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "2ndBreakf4st",
          password: "",
          uri: mockFormURI,
          username: "BBaggins",
        };

        it("and the user vault is locked, trigger an unlock notification", async () => {
          activeAccountStatusMock$.next(AuthenticationStatus.Locked);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(getAllDecryptedForUrlSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();

          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            null,
            mockFormattedURI,
            formEntryData.newPassword,
            tab,
            true, // will yield an unlock followed by an update password notification
          );
        });

        it("and cipher update candidates match only `newPassword`, do not trigger a notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "Frodo", password: "oldPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Pippin", password: "2ndBreakf4st" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match only `username`, trigger an update cipher notification with those candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "BBaggins", password: "oldPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Frodo", password: "differentPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "Pippin", password: "2ndBreakf4st" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-1"],
            mockFormattedURI,
            formEntryData.newPassword,
            sender.tab,
          );
        });

        it("and at least one cipher update candidate matches both `username` and `newPassword`, do not trigger an update (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "BBaggins", password: "oldPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BBaggins", password: "2ndBreakf4st" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "Frodo", password: "differentPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and no cipher update candidates match `username` nor `newPassword`, trigger a new cipher notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "Frodo", password: "oldPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Pippin", password: "differentPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
            mockFormattedURI,
            {
              password: formEntryData.newPassword,
              url: formEntryData.uri,
              username: formEntryData.username,
            },
            sender.tab,
          );
        });

        it("and no cipher update candidates match `username` nor `newPassword`, do not trigger a new cipher notification if the new cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "Frodo", password: "oldPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Pippin", password: "differentPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);
          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });
      });

      describe("when only `username` field is filled, ", () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "",
          password: "",
          uri: mockFormURI,
          username: "BBaggins",
        };

        it("and the user vault is locked, do not trigger a notification", async () => {
          activeAccountStatusMock$.next(AuthenticationStatus.Locked);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expectSkippedCheckingNotification();
        });

        it("and at least one cipher update candidate matches `username`, do not trigger a notification (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "BBaggins", password: "password1" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Frodo", password: "password2" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and no cipher update candidates match `username`, trigger a new cipher notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "Frodo", password: "password1" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Pippin", password: "password2" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
            mockFormattedURI,
            {
              password: "",
              url: formEntryData.uri,
              username: formEntryData.username,
            },
            sender.tab,
          );
        });

        it("and no cipher update candidates match `username`, do not trigger a new cipher notification if the new cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "Frodo", password: "password1" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Pippin", password: "password2" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });
      });

      describe("when `password` and `newPassword` fields are filled, ", () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "4WzrdIzN0tLa7e",
          password: "UShallKnotPassword",
          username: "",
          uri: mockFormURI,
        };

        it("and the user vault is locked, trigger an unlock notification", async () => {
          activeAccountStatusMock$.next(AuthenticationStatus.Locked);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(getAllDecryptedForUrlSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();

          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            null,
            mockFormattedURI,
            formEntryData.newPassword,
            tab,
            true, // will yield an unlock followed by an update password notification
          );
        });

        it("and cipher update candidates only match `newPassword`, do not trigger a notification (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "GaldalfG", password: "4WzrdIzN0tLa7e" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "GaldalfW", password: "4WzrdIzN0tLa7e" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates only match `password`, trigger an update cipher notification with those candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "Frodo", password: "PutAR1ngOnIt" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Pippin", password: "UShallKnotPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "Merry", password: "UShallKnotPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-2", "cipher-id-3"],
            mockFormattedURI,
            formEntryData.newPassword,
            sender.tab,
          );
        });

        it("and cipher update candidates only match `password`, do not trigger an update cipher notification if the update cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "Frodo", password: "PutAR1ngOnIt" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "Pippin", password: "UShallKnotPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "Merry", password: "UShallKnotPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and no cipher update candidates match `password` or `newPassword`, trigger a new cipher notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "Frodo", password: "PutAR1ngOnIt" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "PTook", password: "11sies" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
            mockFormattedURI,
            {
              password: formEntryData.newPassword,
              url: formEntryData.uri,
              username: formEntryData.username,
            },
            sender.tab,
          );
        });
      });

      describe("when only `password` field is filled, ", () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "",
          password: "UShallKnotPassword",
          uri: mockFormURI,
          username: "",
        };

        it("and the user vault is locked, do not trigger an unlock notification", async () => {
          activeAccountStatusMock$.next(AuthenticationStatus.Locked);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expectSkippedCheckingNotification();
        });

        it("and cipher update candidates only match `password`, do not trigger a notification (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "UShallKnotPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BBaggins", password: "UShallKnotPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and no cipher update candidates match `password`, trigger an update cipher notification with ALL cipher update candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "PutAR1ngOnIt" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BBaggins", password: "MahPr3c10us" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "PTook", password: "f00lOfAT00k" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-1", "cipher-id-2", "cipher-id-3"],
            mockFormattedURI,
            formEntryData.password,
            sender.tab,
          );
        });

        it("and no cipher update candidates match `password`, do not trigger an update cipher notification if the update cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "PutAR1ngOnIt" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BBaggins", password: "MahPr3c10us" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "PTook", password: "f00lOfAT00k" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });
      });

      describe("when `username` and `password` fields are filled, ", () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "",
          password: "ShyerH1re",
          uri: mockFormURI,
          username: "BBaggins",
        };

        it("and cipher update candidates only match `password`, trigger an update cipher notification with those candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "ShyerH1re" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "PTook", password: "ShyerH1re" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "FrodoB", password: "UShallKnotPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-1", "cipher-id-2"],
            mockFormattedURI,
            formEntryData.password,
            sender.tab,
          );
        });

        it("and cipher update candidates only match `password`, do not trigger an update cipher notification if the update cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "ShyerH1re" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "PTook", password: "ShyerH1re" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "FrodoB", password: "UShallKnotPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates only match `username`, trigger an update cipher notification with those candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "BBaggins", password: "W0nWr1ng" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BBaggins", password: "UShallKnotPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "BilboB", password: "UShallKnotPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-1", "cipher-id-2"],
            mockFormattedURI,
            formEntryData.password,
            sender.tab,
          );
        });

        it("and cipher update candidates only match `username`, do not trigger an update cipher notification if the update cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "BBaggins", password: "W0nWr1ng" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BBaggins", password: "UShallKnotPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "BilboB", password: "UShallKnotPassword" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match `username` and `password`, do not trigger a notification (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "BBaggins", password: "ShyerH1re" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "FBaggins", password: "W0nWr1ng" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "BBaggins", password: "ShyerH1re" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and cipher update candidates match `username` AND `password` and additionally `username` OR `password`, do not trigger a notification (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "BBaggins", password: "UShallKnotPassword" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BBaggins", password: "ShyerH1re" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "FBaggins", password: "W0nWr1ng" },
            }),
            mock<CipherView>({
              id: "cipher-id-4",
              login: { username: "TBombadil", password: "ShyerH1re" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and no cipher update candidates match `username` or `password`, trigger a new cipher notification", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "W0nWr1ng" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BilboB", password: "PutAR1ngOnIt" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).toHaveBeenCalledWith(
            mockFormattedURI,
            {
              password: formEntryData.password,
              url: formEntryData.uri,
              username: formEntryData.username,
            },
            sender.tab,
          );
        });

        it("and no cipher update candidates match `username` or `password`, do not trigger a new cipher notification if the new cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "W0nWr1ng" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "BilboB", password: "PutAR1ngOnIt" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableAddedLoginPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });
      });

      describe("when only `newPassword` field is filled, ", () => {
        const formEntryData: ModifyLoginCipherFormData = {
          newPassword: "ShyerH1re",
          password: "",
          uri: mockFormURI,
          username: "",
        };

        it("and the user vault is locked, trigger an unlock notification", async () => {
          activeAccountStatusMock$.next(AuthenticationStatus.Locked);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(getAllDecryptedForUrlSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();

          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            null,
            mockFormattedURI,
            formEntryData.newPassword,
            tab,
            true, // will yield an unlock followed by an update password notification
          );
        });

        it("and cipher update candidates only match `newPassword`, do not trigger a notification (nothing to change)", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "ShyerH1re" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "PTook", password: "ShyerH1re" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });

        it("and no cipher update candidates match `newPassword`, trigger an update cipher notification with ALL cipher update candidates", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "W0nWr1ng" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "PTook", password: "PutAR1ngOnIt" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "SamwiseG", password: "P0t4toes" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
          expect(pushChangePasswordToQueueSpy).toHaveBeenCalledWith(
            ["cipher-id-1", "cipher-id-2", "cipher-id-3"],
            mockFormattedURI,
            formEntryData.newPassword,
            sender.tab,
          );
        });

        it("and no cipher update candidates match `newPassword`, do not trigger an update cipher notification if the update cipher notification setting is disabled", async () => {
          const storedCiphersForURL = [
            mock<CipherView>({
              id: "cipher-id-1",
              login: { username: "FBaggins", password: "W0nWr1ng" },
            }),
            mock<CipherView>({
              id: "cipher-id-2",
              login: { username: "PTook", password: "PutAR1ngOnIt" },
            }),
            mock<CipherView>({
              id: "cipher-id-3",
              login: { username: "SamwiseG", password: "P0t4toes" },
            }),
          ];

          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          getAllDecryptedForUrlSpy.mockResolvedValueOnce(storedCiphersForURL);
          getEnableChangedPasswordPromptSpy.mockReturnValueOnce(false);

          await notificationBackground.triggerCipherNotification(formEntryData, tab);

          expect(pushChangePasswordToQueueSpy).not.toHaveBeenCalled();
          expect(pushAddLoginToQueueSpy).not.toHaveBeenCalled();
        });
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
            data: {
              username: "test",
              password: "updated-password",
              uri: "https://example.com",
            },
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
            queueMessage.data.password,
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
            data: {
              username: "test",
              password: "password",
              uri: "https://example.com",
            },
            wasVaultLocked: false,
            launchTimestamp: Date.now(),
            expires: new Date(Date.now() + 10000),
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
            data: {
              username: "test",
              password: "password",
              uri: "https://example.com",
            },
            wasVaultLocked: false,
            launchTimestamp: Date.now(),
            expires: new Date(Date.now() + 10000),
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
          createWithServerSpy.mockResolvedValueOnce(cipherView);

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(convertAddLoginQueueMessageToCipherViewSpy).toHaveBeenCalledWith(
            queueMessage,
            null,
          );
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
            data: {
              username: "test",
              password: "password",
              uri: "https://example.com",
            },
            wasVaultLocked: false,
            launchTimestamp: Date.now(),
            expires: new Date(Date.now() + 10000),
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

    describe("handleUnlockPopoutClosed", () => {
      let onRemovedListeners: Array<(tabId: number, removeInfo: chrome.tabs.OnRemovedInfo) => void>;
      let tabsQuerySpy: jest.SpyInstance;

      beforeEach(() => {
        onRemovedListeners = [];
        chrome.tabs.onRemoved.addListener = jest.fn((listener) => {
          onRemovedListeners.push(listener);
        });
        chrome.runtime.getURL = jest.fn().mockReturnValue("chrome-extension://id/popup/index.html");
        notificationBackground.init();
      });

      const triggerTabRemoved = async (tabId: number) => {
        onRemovedListeners[0](tabId, mock<chrome.tabs.OnRemovedInfo>());
        await flushPromises();
      };

      it("sends abandon message when unlock popout is closed and vault is locked", async () => {
        activeAccountStatusMock$.next(AuthenticationStatus.Locked);
        tabsQuerySpy = jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);

        await triggerTabRemoved(1);

        expect(tabsQuerySpy).toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("abandonAutofillPendingNotifications");
      });

      it("uses tracked tabId for fast lookup when available", async () => {
        activeAccountStatusMock$.next(AuthenticationStatus.Locked);
        tabsQuerySpy = jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([
          {
            id: 123,
            url: "chrome-extension://id/popup/index.html?singleActionPopout=auth_unlockExtension",
          } as chrome.tabs.Tab,
        ]);

        await triggerTabRemoved(999);
        tabsQuerySpy.mockClear();
        messagingService.send.mockClear();

        await triggerTabRemoved(123);

        expect(tabsQuerySpy).not.toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("abandonAutofillPendingNotifications");
      });

      it("returns early when vault is unlocked", async () => {
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        tabsQuerySpy = jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);

        await triggerTabRemoved(1);

        expect(tabsQuerySpy).not.toHaveBeenCalled();
        expect(messagingService.send).not.toHaveBeenCalled();
      });
    });
  });
});
