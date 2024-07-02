import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, Subject, map } from "rxjs";

import { ObservableTracker } from "../../../spec";
import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { NotificationResponse } from "../../models/response/notification.response";
import { UserId } from "../../types/guid";
import { AppIdService } from "../abstractions/app-id.service";
import { Environment, EnvironmentService } from "../abstractions/environment.service";
import { LogService } from "../abstractions/log.service";
import { MessageSender } from "../messaging";
import { SyncService } from "../sync";

import { ConnectionBuilder } from "./connection.builder";
import { DefaultNotificationsService } from "./default-notifications.service";

describe("NotificationsService", () => {
  let logService: MockProxy<LogService>;
  let syncService: MockProxy<SyncService>;
  let appIdService: MockProxy<AppIdService>;
  let environmentService: MockProxy<EnvironmentService>;
  let logoutCallback: jest.Mock<Promise<void>, [unknown]>;
  let authService: MockProxy<AuthService>;
  let messageSender: MockProxy<MessageSender>;
  let accountService: MockProxy<AccountService>;
  let connectionBuilder: MockProxy<ConnectionBuilder>;

  let activeUserSubject: BehaviorSubject<string | null>;
  let notificationsUrlSubject: BehaviorSubject<string>;
  let authStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let connectionSubject: Subject<NotificationResponse>;

  let sut: DefaultNotificationsService;

  beforeEach(() => {
    logService = mock();
    syncService = mock();
    appIdService = mock();
    environmentService = mock();
    logoutCallback = jest.fn();
    authService = mock();
    messageSender = mock();
    accountService = mock();
    connectionBuilder = mock();

    activeUserSubject = new BehaviorSubject<string | null>(null);

    accountService.activeAccount$ = activeUserSubject.pipe(
      map((user) =>
        user != null
          ? {
              id: user as UserId,
              email: "test@example.com",
              emailVerified: true,
              name: "Test Name",
            }
          : null,
      ),
    );

    notificationsUrlSubject = new BehaviorSubject<string>("https://notifications.example.com");

    environmentService.environment$ = notificationsUrlSubject.pipe(
      map(
        (notificationsUrl) =>
          ({
            getNotificationsUrl() {
              return notificationsUrl;
            },
          }) as unknown as Environment, // Only notifications url is needed so no need to implement the rest
      ),
    );

    authStatusSubject = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.LoggedOut);

    authService.authStatusFor$.mockImplementation((userId) => {
      if (userId !== activeUserSubject.value) {
        throw new Error("Invalid usage");
      }

      return authStatusSubject;
    });

    connectionSubject = new Subject<NotificationResponse>();

    connectionBuilder.build.mockImplementation((url, activeUser) => {
      if (url !== notificationsUrlSubject.value || activeUser !== activeUserSubject.value) {
        throw new Error("Invalid usage");
      }

      return connectionSubject.asObservable();
    });

    sut = new DefaultNotificationsService(
      logService,
      syncService,
      appIdService,
      environmentService,
      logoutCallback,
      authService,
      messageSender,
      accountService,
      connectionBuilder,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("start", () => {
    type SetupOptions = {
      activeAccount: string | null;
      notificationsUrl: string;
      authStatus: AuthenticationStatus;
    };

    function update(options: Partial<SetupOptions>) {
      if ("activeAccount" in options) {
        activeUserSubject.next(options.activeAccount);
      }

      if ("notificationsUrl" in options) {
        notificationsUrlSubject.next(options.notificationsUrl);
      }

      if ("authStatus" in options) {
        authStatusSubject.next(options.authStatus);
      }
    }

    function expectSubscribers<T>(subject: Subject<T>, expectedSubscribers: number) {
      expect(subject["observers"]).toHaveLength(expectedSubscribers);
    }

    it("tracks all downstream observables correctly", async () => {
      // Start with an initial account that is logged out
      update({
        activeAccount: "test1",
        authStatus: AuthenticationStatus.LoggedOut,
      });

      const tracker = new ObservableTracker(sut.startInternal());

      // This should be subscribed to yet since the user is logged out
      expectSubscribers(connectionSubject, 0);
      expect(tracker.emissions).toHaveLength(0);

      // The user unlocks
      update({
        authStatus: AuthenticationStatus.Unlocked,
      });

      expectSubscribers(connectionSubject, 1);
      connectionSubject.next(new NotificationResponse({}));
      connectionSubject.next(new NotificationResponse({}));

      await tracker.pauseUntilReceived(2, 10);

      // This should turn off notifications listening, changing the notifications
      // url is something that should only happen during the unlock process of a user
      // but either way we are aware of url updates so test it.
      update({
        notificationsUrl: "https://-",
      });

      expectSubscribers(connectionSubject, 0);

      // The user sets their url to an actual url again
      update({
        notificationsUrl: "https://notifications.example.com",
      });

      expectSubscribers(connectionSubject, 1);

      // The user locks their account
      update({
        authStatus: AuthenticationStatus.Locked,
      });

      expectSubscribers(connectionSubject, 0);

      // The user unlocks their account
      update({
        authStatus: AuthenticationStatus.Unlocked,
      });

      expectSubscribers(connectionSubject, 1);

      // The users computer goes idle
      sut.disconnectFromInactivity();

      expectSubscribers(connectionSubject, 0);

      // Switch to a new, already unlocked user
      update({
        activeAccount: "test2",
        authStatus: AuthenticationStatus.Unlocked,
      });

      expectSubscribers(connectionSubject, 1);

      // Switch to having no account active
      update({
        activeAccount: null,
      });

      expectSubscribers(connectionSubject, 0);
    });

    it("doesn't complete if connection builders has an error", async () => {
      update({
        activeAccount: "test1",
        authStatus: AuthenticationStatus.Unlocked,
      });

      const tracker = new ObservableTracker(sut.startInternal());

      connectionSubject.next(new NotificationResponse({}));
      connectionSubject.next(new NotificationResponse({}));

      await tracker.pauseUntilReceived(2, 10);

      connectionSubject.error(new Error("TestError"));

      expect(logService.warning).toHaveBeenCalledTimes(1);

      // Any emission on the further up chain should reconnect
      connectionSubject = new Subject<NotificationResponse>();
      update({
        authStatus: AuthenticationStatus.Unlocked,
      });

      connectionSubject.next(new NotificationResponse({}));

      await tracker.pauseUntilReceived(3, 10);
    });
  });
});
