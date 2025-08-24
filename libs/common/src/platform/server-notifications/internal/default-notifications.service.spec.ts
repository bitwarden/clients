import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, bufferCount, firstValueFrom, ObservedValueOf, of, Subject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";

import { awaitAsync } from "../../../../spec";
import { Matrix } from "../../../../spec/matrix";
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
import { MessageSender } from "../../messaging";
import { SupportStatus } from "../../misc/support-status";
import { SyncService } from "../../sync";

import {
  DefaultServerNotificationsService,
  DISABLED_NOTIFICATIONS_URL,
} from "./default-server-notifications.service";
import { SignalRConnectionService, SignalRNotification } from "./signalr-connection.service";
import { WebPushConnectionService, WebPushConnector } from "./webpush-connection.service";
import { WorkerWebPushConnectionService } from "./worker-webpush-connection.service";

describe("NotificationsService", () => {
  let syncService: MockProxy<SyncService>;
  let appIdService: MockProxy<AppIdService>;
  let environmentService: MockProxy<EnvironmentService>;
  let logoutCallback: jest.Mock<Promise<void>, [logoutReason: LogoutReason]>;
  let messagingService: MockProxy<MessageSender>;
  let accountService: MockProxy<AccountService>;
  let signalRNotificationConnectionService: MockProxy<SignalRConnectionService>;
  let authService: MockProxy<AuthService>;
  let webPushNotificationConnectionService: MockProxy<WebPushConnectionService>;
  let configService: MockProxy<ConfigService>;

  let activeAccount: BehaviorSubject<ObservedValueOf<AccountService["activeAccount$"]>>;

  let environment: BehaviorSubject<ObservedValueOf<EnvironmentService["environment$"]>>;

  let authStatusGetter: (userId: UserId) => BehaviorSubject<AuthenticationStatus>;

  let webPushSupportGetter: (userId: UserId) => BehaviorSubject<SupportStatus<WebPushConnector>>;

  let signalrNotificationGetter: (
    userId: UserId,
    notificationsUrl: string,
  ) => Subject<SignalRNotification>;

  let sut: DefaultServerNotificationsService;

  beforeEach(() => {
    syncService = mock<SyncService>();
    appIdService = mock<AppIdService>();
    environmentService = mock<EnvironmentService>();
    logoutCallback = jest.fn<Promise<void>, [logoutReason: LogoutReason]>();
    messagingService = mock<MessageSender>();
    accountService = mock<AccountService>();
    signalRNotificationConnectionService = mock<SignalRConnectionService>();
    authService = mock<AuthService>();
    webPushNotificationConnectionService = mock<WorkerWebPushConnectionService>();
    configService = mock<ConfigService>();

    configService.getFeatureFlag$.mockReturnValue(of(true));

    activeAccount = new BehaviorSubject<ObservedValueOf<AccountService["activeAccount$"]>>(null);
    accountService.activeAccount$ = activeAccount.asObservable();

    environment = new BehaviorSubject<ObservedValueOf<EnvironmentService["environment$"]>>({
      getNotificationsUrl: () => "https://notifications.bitwarden.com",
    } as Environment);

    environmentService.environment$ = environment;

    authStatusGetter = Matrix.autoMockMethod(
      authService.authStatusFor$,
      () => new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.LoggedOut),
    );

    webPushSupportGetter = Matrix.autoMockMethod(
      webPushNotificationConnectionService.supportStatus$,
      () =>
        new BehaviorSubject<SupportStatus<WebPushConnector>>({
          type: "not-supported",
          reason: "test",
        }),
    );

    signalrNotificationGetter = Matrix.autoMockMethod(
      signalRNotificationConnectionService.connect$,
      () => new Subject<SignalRNotification>(),
    );

    sut = new DefaultServerNotificationsService(
      mock<LogService>(),
      syncService,
      appIdService,
      environmentService,
      logoutCallback,
      messagingService,
      accountService,
      signalRNotificationConnectionService,
      authService,
      webPushNotificationConnectionService,
      configService,
    );
  });

  const mockUser1 = "user1" as UserId;
  const mockUser2 = "user2" as UserId;

  function emitActiveUser(userId: UserId) {
    if (userId == null) {
      activeAccount.next(null);
    } else {
      activeAccount.next({ id: userId, email: "email", name: "Test Name", emailVerified: true });
    }
  }

  function emitNotificationUrl(url: string) {
    environment.next({
      getNotificationsUrl: () => url,
    } as Environment);
  }

  const expectNotification = (
    notification: readonly [NotificationResponse, UserId],
    expectedUser: UserId,
    expectedType: NotificationType,
  ) => {
    const [actualNotification, actualUser] = notification;
    expect(actualUser).toBe(expectedUser);
    expect(actualNotification.type).toBe(expectedType);
  };

  it("emits server notifications through WebPush when supported", async () => {
    const notificationsPromise = firstValueFrom(sut.notifications$.pipe(bufferCount(2)));

    emitActiveUser(mockUser1);
    emitNotificationUrl("http://test.example.com");
    authStatusGetter(mockUser1).next(AuthenticationStatus.Unlocked);

    const webPush = mock<WebPushConnector>();
    const webPushSubject = new Subject<NotificationResponse>();
    webPush.notifications$ = webPushSubject;

    webPushSupportGetter(mockUser1).next({ type: "supported", service: webPush });
    webPushSubject.next(new NotificationResponse({ type: NotificationType.SyncFolderCreate }));
    webPushSubject.next(new NotificationResponse({ type: NotificationType.SyncFolderDelete }));

    const notifications = await notificationsPromise;
    expectNotification(notifications[0], mockUser1, NotificationType.SyncFolderCreate);
    expectNotification(notifications[1], mockUser1, NotificationType.SyncFolderDelete);
  });

  it("switches to SignalR when web push is not supported.", async () => {
    const notificationsPromise = firstValueFrom(sut.notifications$.pipe(bufferCount(2)));

    emitActiveUser(mockUser1);
    emitNotificationUrl("http://test.example.com");
    authStatusGetter(mockUser1).next(AuthenticationStatus.Unlocked);

    const webPush = mock<WebPushConnector>();
    const webPushSubject = new Subject<NotificationResponse>();
    webPush.notifications$ = webPushSubject;

    webPushSupportGetter(mockUser1).next({ type: "supported", service: webPush });
    webPushSubject.next(new NotificationResponse({ type: NotificationType.SyncFolderCreate }));

    emitActiveUser(mockUser2);
    authStatusGetter(mockUser2).next(AuthenticationStatus.Unlocked);
    // Second user does not support web push
    webPushSupportGetter(mockUser2).next({ type: "not-supported", reason: "test" });

    signalrNotificationGetter(mockUser2, "http://test.example.com").next({
      type: "ReceiveMessage",
      message: new NotificationResponse({ type: NotificationType.SyncCipherUpdate }),
    });

    const notifications = await notificationsPromise;
    expectNotification(notifications[0], mockUser1, NotificationType.SyncFolderCreate);
    expectNotification(notifications[1], mockUser2, NotificationType.SyncCipherUpdate);
  });

  it("switches to WebPush when it becomes supported.", async () => {
    const notificationsPromise = firstValueFrom(sut.notifications$.pipe(bufferCount(2)));

    emitActiveUser(mockUser1);
    emitNotificationUrl("http://test.example.com");
    authStatusGetter(mockUser1).next(AuthenticationStatus.Unlocked);
    webPushSupportGetter(mockUser1).next({ type: "not-supported", reason: "test" });

    signalrNotificationGetter(mockUser1, "http://test.example.com").next({
      type: "ReceiveMessage",
      message: new NotificationResponse({ type: NotificationType.AuthRequest }),
    });

    const webPush = mock<WebPushConnector>();
    const webPushSubject = new Subject<NotificationResponse>();
    webPush.notifications$ = webPushSubject;

    webPushSupportGetter(mockUser1).next({ type: "supported", service: webPush });
    webPushSubject.next(new NotificationResponse({ type: NotificationType.SyncLoginDelete }));

    const notifications = await notificationsPromise;
    expectNotification(notifications[0], mockUser1, NotificationType.AuthRequest);
    expectNotification(notifications[1], mockUser1, NotificationType.SyncLoginDelete);
  });

  it("does not emit SignalR heartbeats", async () => {
    const notificationsPromise = firstValueFrom(sut.notifications$.pipe(bufferCount(1)));

    emitActiveUser(mockUser1);
    emitNotificationUrl("http://test.example.com");
    authStatusGetter(mockUser1).next(AuthenticationStatus.Unlocked);
    webPushSupportGetter(mockUser1).next({ type: "not-supported", reason: "test" });

    signalrNotificationGetter(mockUser1, "http://test.example.com").next({ type: "Heartbeat" });
    signalrNotificationGetter(mockUser1, "http://test.example.com").next({
      type: "ReceiveMessage",
      message: new NotificationResponse({ type: NotificationType.AuthRequestResponse }),
    });

    const notifications = await notificationsPromise;
    expectNotification(notifications[0], mockUser1, NotificationType.AuthRequestResponse);
  });

  it.each([
    // Temporarily rolling back server notifications being connected while locked
    // { initialStatus: AuthenticationStatus.Locked, updatedStatus: AuthenticationStatus.Unlocked },
    // { initialStatus: AuthenticationStatus.Unlocked, updatedStatus: AuthenticationStatus.Locked },
    // { initialStatus: AuthenticationStatus.Locked, updatedStatus: AuthenticationStatus.Locked },
    { initialStatus: AuthenticationStatus.Unlocked, updatedStatus: AuthenticationStatus.Unlocked },
  ])(
    "does not re-connect when the user transitions from $initialStatus to $updatedStatus when feature flag is enabled",
    async ({ initialStatus, updatedStatus }) => {
      emitActiveUser(mockUser1);
      emitNotificationUrl("http://test.example.com");
      authStatusGetter(mockUser1).next(initialStatus);
      webPushSupportGetter(mockUser1).next({ type: "not-supported", reason: "test" });

      const notificationsSubscriptions = sut.notifications$.subscribe();
      await awaitAsync(1);

      authStatusGetter(mockUser1).next(updatedStatus);
      await awaitAsync(1);

      expect(signalRNotificationConnectionService.connect$).toHaveBeenCalledTimes(1);
      expect(signalRNotificationConnectionService.connect$).toHaveBeenCalledWith(
        mockUser1,
        "http://test.example.com",
      );
      notificationsSubscriptions.unsubscribe();
    },
  );

  it.each([
    // Temporarily disabling server notifications connecting while in a locked state
    // AuthenticationStatus.Locked,
    AuthenticationStatus.Unlocked,
  ])(
    "does not re-connect when the user transitions from $initialStatus to $updatedStatus when feature flag is disabled",
    async ({ initialStatus, updatedStatus }) => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      emitActiveUser(mockUser1);
      emitNotificationUrl("http://test.example.com");
      authStatusGetter(mockUser1).next(initialStatus);
      webPushSupportGetter(mockUser1).next({ type: "not-supported", reason: "test" });

      const notificationsSubscriptions = sut.notifications$.subscribe();
      await awaitAsync(1);

      authStatusGetter(mockUser1).next(updatedStatus);
      await awaitAsync(1);

      expect(signalRNotificationConnectionService.connect$).toHaveBeenCalledTimes(1);
      expect(signalRNotificationConnectionService.connect$).toHaveBeenCalledWith(
        mockUser1,
        "http://test.example.com",
      );
      notificationsSubscriptions.unsubscribe();
    },
  );

  it.each([AuthenticationStatus.Locked, AuthenticationStatus.Unlocked])(
    "connects when a user transitions from logged out to %s when feature flag is enabled",
    async (newStatus: AuthenticationStatus) => {
      emitActiveUser(mockUser1);
      emitNotificationUrl("http://test.example.com");
      authStatusGetter(mockUser1).next(AuthenticationStatus.LoggedOut);
      webPushSupportGetter(mockUser1).next({ type: "not-supported", reason: "test" });

      const notificationsSubscriptions = sut.notifications$.subscribe();
      await awaitAsync(1);

      authStatusGetter(mockUser1).next(newStatus);
      await awaitAsync(1);

      expect(signalRNotificationConnectionService.connect$).toHaveBeenCalledTimes(1);
      expect(signalRNotificationConnectionService.connect$).toHaveBeenCalledWith(
        mockUser1,
        "http://test.example.com",
      );
      notificationsSubscriptions.unsubscribe();
    },
  );

  it("does not connect to any notification stream when server notifications are disabled through special url", () => {
    const subscription = sut.notifications$.subscribe();
    emitActiveUser(mockUser1);
    emitNotificationUrl(DISABLED_NOTIFICATIONS_URL);

    expect(signalRNotificationConnectionService.connect$).not.toHaveBeenCalled();
    expect(webPushNotificationConnectionService.supportStatus$).not.toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("does not connect to any notification stream when there is no active user", () => {
    const subscription = sut.notifications$.subscribe();
    emitActiveUser(null);

    expect(signalRNotificationConnectionService.connect$).not.toHaveBeenCalled();
    expect(webPushNotificationConnectionService.supportStatus$).not.toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("does not reconnect if the same notification url is emitted", async () => {
    const subscription = sut.notifications$.subscribe();

    emitActiveUser(mockUser1);
    emitNotificationUrl("http://test.example.com");
    authStatusGetter(mockUser1).next(AuthenticationStatus.Unlocked);

    await awaitAsync(1);

    expect(webPushNotificationConnectionService.supportStatus$).toHaveBeenCalledTimes(1);
    emitNotificationUrl("http://test.example.com");

    await awaitAsync(1);

    expect(webPushNotificationConnectionService.supportStatus$).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });
});
