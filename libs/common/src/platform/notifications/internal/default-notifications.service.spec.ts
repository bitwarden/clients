import { mock } from "jest-mock-extended";
import { BehaviorSubject, bufferCount, firstValueFrom, ObservedValueOf, Subject } from "rxjs";

import { LogoutReason } from "@bitwarden/auth/common";

import { Matrix } from "../../../../spec/matrix";
import { AccountService } from "../../../auth/abstractions/account.service";
import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { NotificationType } from "../../../enums";
import { NotificationResponse } from "../../../models/response/notification.response";
import { UserId } from "../../../types/guid";
import { AppIdService } from "../../abstractions/app-id.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { MessageSender } from "../../messaging";
import { SupportStatus } from "../../misc/support-status";
import { SyncService } from "../../sync";

import { DefaultNotificationsService } from "./default-notifications.service";
import { SignalRNotification, SignalRConnectionService } from "./signalr-connection.service";
import { WebPushConnector } from "./webpush-connection.service";
import { WorkerWebPushConnectionService } from "./worker-webpush-connection.service";

describe("NotificationsService", () => {
  const syncService = mock<SyncService>();
  const appIdService = mock<AppIdService>();
  const environmentService = mock<EnvironmentService>();
  const logoutCallback = jest.fn<Promise<void>, [logoutReason: LogoutReason]>();
  const messagingService = mock<MessageSender>();
  const accountService = mock<AccountService>();
  const signalRNotificationConnectionService = mock<SignalRConnectionService>();
  const authService = mock<AuthService>();
  const webPushNotificationConnectionService = mock<WorkerWebPushConnectionService>();

  const activeAccount = new BehaviorSubject<ObservedValueOf<AccountService["activeAccount$"]>>(
    null,
  );
  accountService.activeAccount$ = activeAccount.asObservable();

  const environment = new BehaviorSubject<ObservedValueOf<EnvironmentService["environment$"]>>({
    getNotificationsUrl: () => "https://notifications.bitwarden.com",
  } as Environment);

  environmentService.environment$ = environment;

  const authStatusGetter = Matrix.autoMockMethod(
    authService.authStatusFor$,
    () => new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.LoggedOut),
  );

  const webPushSupportGetter = Matrix.autoMockMethod(
    webPushNotificationConnectionService.supportStatus$,
    () =>
      new BehaviorSubject<SupportStatus<WebPushConnector>>({
        type: "not-supported",
        reason: "test",
      }),
  );

  const signalrNotificationGetter = Matrix.autoMockMethod(
    signalRNotificationConnectionService.connect$,
    () => new Subject<SignalRNotification>(),
  );

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

  const sut = new DefaultNotificationsService(
    syncService,
    appIdService,
    environmentService,
    logoutCallback,
    messagingService,
    accountService,
    signalRNotificationConnectionService,
    authService,
    webPushNotificationConnectionService,
    mock<LogService>(),
  );

  test("observable chain reacts to inputs properly", async () => {
    // Sets up two active unlocked user, one pointing to an environment with WebPush, the other
    // falling back to using SignalR

    // We start with one active user with an unlocked account that
    emitActiveUser(mockUser1);
    emitNotificationUrl("http://test.example.com");
    authStatusGetter(mockUser1).next(AuthenticationStatus.Unlocked);
    const webPush = mock<WebPushConnector>();

    const webPushGetter = Matrix.autoMockMethod(
      webPush.connect$,
      () => new Subject<NotificationResponse>(),
    );

    // Start listening to notifications
    const notificationsPromise = firstValueFrom(sut.notifications$.pipe(bufferCount(4)));

    // Pretend web push becomes supported
    webPushSupportGetter(mockUser1).next({ type: "supported", service: webPush });

    // Emit a couple notifications through WebPush
    webPushGetter(mockUser1).next(new NotificationResponse({ type: NotificationType.LogOut }));
    webPushGetter(mockUser1).next(
      new NotificationResponse({ type: NotificationType.SyncCipherCreate }),
    );

    // Switch to having no active user
    emitActiveUser(null);

    // Switch to another user
    emitActiveUser(mockUser2);

    // User unlocks
    authStatusGetter(mockUser2).next(AuthenticationStatus.Unlocked);

    // Web push is not supported for second user
    webPushSupportGetter(mockUser2).next({ type: "not-supported", reason: "test" });

    // They should connect and receive notifications from signalR
    signalrNotificationGetter(mockUser2, "http://test.example.com").next({
      type: "ReceiveMessage",
      message: new NotificationResponse({ type: NotificationType.SyncCipherUpdate }),
    });

    // Heartbeats should be ignored.
    signalrNotificationGetter(mockUser2, "http://test.example.com").next({
      type: "Heartbeat",
    });

    // User could turn off notifications (this would generally happen while there is no active user)
    emitNotificationUrl("http://-");

    // User could turn them back on
    emitNotificationUrl("http://test.example.com");

    // SignalR emits another notification
    signalrNotificationGetter(mockUser2, "http://test.example.com").next({
      type: "ReceiveMessage",
      message: new NotificationResponse({ type: NotificationType.SyncCipherDelete }),
    });

    const notifications = await notificationsPromise;

    const expectNotification = (
      notification: readonly [NotificationResponse, UserId],
      expectedUser: UserId,
      expectedType: NotificationType,
    ) => {
      const [actualNotification, actualUser] = notification;
      expect(actualUser).toBe(expectedUser);
      expect(actualNotification.type).toBe(expectedType);
    };

    expectNotification(notifications[0], mockUser1, NotificationType.LogOut);
    expectNotification(notifications[1], mockUser1, NotificationType.SyncCipherCreate);
    expectNotification(notifications[2], mockUser2, NotificationType.SyncCipherUpdate);
    expectNotification(notifications[3], mockUser2, NotificationType.SyncCipherDelete);
  });
});
