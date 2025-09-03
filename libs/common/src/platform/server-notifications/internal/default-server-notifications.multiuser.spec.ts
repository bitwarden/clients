import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, bufferCount, firstValueFrom, Subject, ObservedValueOf } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";
import { AuthRequestAnsweringServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { AccountService } from "../../../auth/abstractions/account.service";
import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { NotificationType } from "../../../enums";
import { NotificationResponse } from "../../../models/response/notification.response";
import { UserId } from "../../../types/guid";
import { AppIdService } from "../../abstractions/app-id.service";
import { ConfigService } from "../../abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { MessagingService } from "../../abstractions/messaging.service";

import { DefaultServerNotificationsService } from "./default-server-notifications.service";
import { SignalRConnectionService } from "./signalr-connection.service";
import { WebPushConnectionService, WebPushConnector } from "./webpush-connection.service";

describe("DefaultServerNotificationsService (multi-user)", () => {
  let syncService: any;
  let appIdService: MockProxy<AppIdService>;
  let environmentConfigurationService: MockProxy<EnvironmentService>;
  let userLogoutCallback: jest.Mock<Promise<void>, [logoutReason: LogoutReason, userId: UserId]>;
  let messagingService: MockProxy<MessagingService>;
  let accountService: MockProxy<AccountService>;
  let signalRNotificationConnectionService: MockProxy<SignalRConnectionService>;
  let authService: MockProxy<AuthService>;
  let webPushNotificationConnectionService: MockProxy<WebPushConnectionService>;
  let authRequestAnsweringService: MockProxy<AuthRequestAnsweringServiceAbstraction>;
  let configService: MockProxy<ConfigService>;

  let activeUserAccount$: BehaviorSubject<ObservedValueOf<AccountService["activeAccount$"]>>;
  let userAccounts$: BehaviorSubject<ObservedValueOf<AccountService["accounts$"]>>;

  let environmentConfiguration$: BehaviorSubject<Environment>;

  let authenticationStatusByUser: Map<UserId, BehaviorSubject<AuthenticationStatus>>;
  let webPushSupportStatusByUser: Map<
    UserId,
    BehaviorSubject<
      { type: "supported"; service: WebPushConnector } | { type: "not-supported"; reason: string }
    >
  >;

  let connectionSubjectByUser: Map<UserId, Subject<any>>;
  let defaultServerNotificationsService: DefaultServerNotificationsService;

  const mockUserId1 = "user1" as UserId;
  const mockUserId2 = "user2" as UserId;

  beforeEach(() => {
    syncService = {
      fullSync: jest.fn().mockResolvedValue(undefined),
      syncUpsertCipher: jest.fn().mockResolvedValue(undefined),
      syncDeleteCipher: jest.fn().mockResolvedValue(undefined),
      syncUpsertFolder: jest.fn().mockResolvedValue(undefined),
      syncDeleteFolder: jest.fn().mockResolvedValue(undefined),
      syncUpsertSend: jest.fn().mockResolvedValue(undefined),
      syncDeleteSend: jest.fn().mockResolvedValue(undefined),
    };

    appIdService = mock<AppIdService>();
    appIdService.getAppId.mockResolvedValue("app-id");

    environmentConfigurationService = mock<EnvironmentService>();
    environmentConfiguration$ = new BehaviorSubject<Environment>({
      getNotificationsUrl: () => "http://test.example.com",
    } as Environment);
    environmentConfigurationService.environment$ = environmentConfiguration$ as any;
    // Ensure user-scoped environment lookups return the same test environment stream
    environmentConfigurationService.getEnvironment$.mockImplementation(
      (_userId: UserId) => environmentConfiguration$.asObservable() as any,
    );

    userLogoutCallback = jest.fn<Promise<void>, [LogoutReason, UserId]>();

    messagingService = mock<MessagingService>();

    accountService = mock<AccountService>();
    activeUserAccount$ = new BehaviorSubject<ObservedValueOf<AccountService["activeAccount$"]>>(
      null,
    );
    accountService.activeAccount$ = activeUserAccount$.asObservable();
    userAccounts$ = new BehaviorSubject<ObservedValueOf<AccountService["accounts$"]>>({} as any);
    accountService.accounts$ = userAccounts$.asObservable();

    signalRNotificationConnectionService = mock<SignalRConnectionService>();
    connectionSubjectByUser = new Map();
    signalRNotificationConnectionService.connect$.mockImplementation(
      (userId: UserId, _url: string) => {
        if (!connectionSubjectByUser.has(userId)) {
          connectionSubjectByUser.set(userId, new Subject<any>());
        }
        return connectionSubjectByUser.get(userId)!.asObservable();
      },
    );

    authService = mock<AuthService>();
    authenticationStatusByUser = new Map();
    authService.authStatusFor$.mockImplementation((userId: UserId) => {
      if (!authenticationStatusByUser.has(userId)) {
        authenticationStatusByUser.set(
          userId,
          new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.LoggedOut),
        );
      }
      return authenticationStatusByUser.get(userId)!.asObservable();
    });

    webPushNotificationConnectionService = mock<WebPushConnectionService>();
    webPushSupportStatusByUser = new Map();
    webPushNotificationConnectionService.supportStatus$.mockImplementation((userId: UserId) => {
      if (!webPushSupportStatusByUser.has(userId)) {
        webPushSupportStatusByUser.set(
          userId,
          new BehaviorSubject({ type: "not-supported", reason: "init" } as any),
        );
      }
      return webPushSupportStatusByUser.get(userId)!.asObservable();
    });

    authRequestAnsweringService = mock<AuthRequestAnsweringServiceAbstraction>();

    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) => {
      const flagValueByFlag: Partial<Record<FeatureFlag, boolean>> = {
        [FeatureFlag.InactiveUserServerNotification]: true,
        [FeatureFlag.PushNotificationsWhenLocked]: true,
      };
      return new BehaviorSubject(flagValueByFlag[flag] ?? false) as any;
    });

    defaultServerNotificationsService = new DefaultServerNotificationsService(
      mock<LogService>(),
      syncService,
      appIdService,
      environmentConfigurationService,
      userLogoutCallback,
      messagingService,
      accountService,
      signalRNotificationConnectionService,
      authService,
      webPushNotificationConnectionService,
      authRequestAnsweringService,
      configService,
    );
  });

  function setActiveUserAccount(userId: UserId | null) {
    if (userId == null) {
      activeUserAccount$.next(null);
    } else {
      activeUserAccount$.next({
        id: userId,
        email: "email",
        name: "Test Name",
        emailVerified: true,
      });
    }
  }

  function addUserAccount(userId: UserId) {
    const currentAccounts = (userAccounts$.getValue() as Record<string, any>) ?? {};
    userAccounts$.next({
      ...currentAccounts,
      [userId]: { email: "email", name: "Test Name", emailVerified: true },
    } as any);
  }

  function setUserUnlocked(userId: UserId) {
    if (!authenticationStatusByUser.has(userId)) {
      authenticationStatusByUser.set(
        userId,
        new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.LoggedOut),
      );
    }
    authenticationStatusByUser.get(userId)!.next(AuthenticationStatus.Unlocked);
  }

  function setWebPushConnectorForUser(userId: UserId) {
    const webPushConnector = mock<WebPushConnector>();
    const notificationSubject = new Subject<NotificationResponse>();
    webPushConnector.notifications$ = notificationSubject.asObservable();
    if (!webPushSupportStatusByUser.has(userId)) {
      webPushSupportStatusByUser.set(
        userId,
        new BehaviorSubject({ type: "supported", service: webPushConnector } as any),
      );
    } else {
      webPushSupportStatusByUser
        .get(userId)!
        .next({ type: "supported", service: webPushConnector } as any);
    }
    return { webPushConnector, notificationSubject } as const;
  }

  it("merges notification streams from multiple users", async () => {
    addUserAccount(mockUserId1);
    addUserAccount(mockUserId2);
    setUserUnlocked(mockUserId1);
    setUserUnlocked(mockUserId2);
    setActiveUserAccount(mockUserId1);

    const user1WebPush = setWebPushConnectorForUser(mockUserId1);
    const user2WebPush = setWebPushConnectorForUser(mockUserId2);

    const twoNotifications = firstValueFrom(
      defaultServerNotificationsService.notifications$.pipe(bufferCount(2)),
    );

    user1WebPush.notificationSubject.next(
      new NotificationResponse({ type: NotificationType.SyncFolderCreate }),
    );
    user2WebPush.notificationSubject.next(
      new NotificationResponse({ type: NotificationType.SyncFolderDelete }),
    );

    const notificationResults = await twoNotifications;
    expect(notificationResults.length).toBe(2);
    const [notification1, userA] = notificationResults[0];
    const [notification2, userB] = notificationResults[1];
    expect(userA === mockUserId1 || userA === mockUserId2).toBe(true);
    expect(userB === mockUserId1 || userB === mockUserId2).toBe(true);
    expect([NotificationType.SyncFolderCreate, NotificationType.SyncFolderDelete]).toContain(
      notification1.type,
    );
    expect([NotificationType.SyncFolderCreate, NotificationType.SyncFolderDelete]).toContain(
      notification2.type,
    );
  });

  it("processes allowed multi-user notifications for non-active users (AuthRequest)", async () => {
    addUserAccount(mockUserId1);
    addUserAccount(mockUserId2);
    setUserUnlocked(mockUserId1);
    setUserUnlocked(mockUserId2);
    setActiveUserAccount(mockUserId1);

    // Force SignalR path for user2
    if (!webPushSupportStatusByUser.has(mockUserId2)) {
      webPushSupportStatusByUser.set(
        mockUserId2,
        new BehaviorSubject({ type: "not-supported", reason: "test" } as any),
      );
    } else {
      webPushSupportStatusByUser
        .get(mockUserId2)!
        .next({ type: "not-supported", reason: "test" } as any);
    }

    authRequestAnsweringService.receivedPendingAuthRequest.mockResolvedValue(undefined as any);

    const subscription = defaultServerNotificationsService.startListening();

    // Emit via SignalR connect$ for user2
    connectionSubjectByUser.get(mockUserId2)!.next({
      type: "ReceiveMessage",
      message: new NotificationResponse({
        type: NotificationType.AuthRequest,
        payload: { id: "auth-id-2", userId: mockUserId2 },
      }),
    });

    // allow async queue to drain
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval", {
      notificationId: "auth-id-2",
    });
    expect(authRequestAnsweringService.receivedPendingAuthRequest).toHaveBeenCalledWith(
      mockUserId2,
      "auth-id-2",
    );

    subscription.unsubscribe();
  });

  it("does not process restricted notification types for non-active users", async () => {
    addUserAccount(mockUserId1);
    addUserAccount(mockUserId2);
    setUserUnlocked(mockUserId1);
    setUserUnlocked(mockUserId2);
    setActiveUserAccount(mockUserId1);

    const user1WebPush = setWebPushConnectorForUser(mockUserId1);
    const user2WebPush = setWebPushConnectorForUser(mockUserId2);

    const subscription = defaultServerNotificationsService.startListening();

    // Emit a folder create for non-active user (should be ignored)
    user2WebPush.notificationSubject.next(
      new NotificationResponse({ type: NotificationType.SyncFolderCreate }),
    );
    // Emit a folder create for active user (should be processed)
    user1WebPush.notificationSubject.next(
      new NotificationResponse({ type: NotificationType.SyncFolderCreate }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(syncService.syncUpsertFolder).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
  });
});
