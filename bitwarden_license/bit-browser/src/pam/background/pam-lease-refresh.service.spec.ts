// Polyfills Symbol.dispose for `using ref = sdk.take()`; not reliably present in jsdom.
if (!(Symbol as any).dispose) {
  (Symbol as any).dispose = Symbol("Symbol.dispose");
}

import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, map, of, Subject, Subscription } from "rxjs";

import { BrowserTaskSchedulerService } from "@bitwarden/browser/platform/services/abstractions/browser-task-scheduler.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { NotificationType } from "@bitwarden/common/enums";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Message, MessageListener } from "@bitwarden/common/platform/messaging";
import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import type { AccessLeaseView } from "@bitwarden/sdk-internal";

import { PAM_REFRESH_LEASES } from "../lease-messages";
import { LEASED_CIPHERS, LeasedCipherEntry } from "../leased-cipher.state";

import { PamLeaseRefreshService } from "./pam-lease-refresh.service";

describe("PamLeaseRefreshService", () => {
  const userId = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as UserId;
  const now = new Date("2026-10-15T12:00:00.000Z").getTime();
  const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const inAnHour = at(60 * 60 * 1000);

  let stateProvider: FakeStateProvider;
  let authStatuses$: BehaviorSubject<Record<UserId, AuthenticationStatus>>;
  let configService: MockProxy<ConfigService>;
  let leases: { list_mine: jest.Mock };
  let apiService: MockProxy<ApiService>;
  let notifications$: Subject<readonly [NotificationResponse, UserId]>;
  let messages$: Subject<Message<Record<string, unknown>>>;
  let taskSchedulerService: MockProxy<BrowserTaskSchedulerService>;
  let logService: MockProxy<LogService>;
  let leasedCiphersChanged: jest.Mock<Promise<void>, []>;
  let service: PamLeaseRefreshService;

  const lease = (cipherId: string, overrides: Partial<AccessLeaseView> = {}) =>
    ({
      id: `lease-${cipherId}`,
      cipherId,
      status: "active",
      notAfter: inAnHour,
      ...overrides,
    }) as unknown as AccessLeaseView;
  const held = (cipherId: string, notAfter = inAnHour): LeasedCipherEntry => ({
    leaseId: `lease-${cipherId}`,
    notAfter,
    cipher: Object.assign(new CipherData(), { id: cipherId }),
  });
  const seed = (...entries: LeasedCipherEntry[]) =>
    stateProvider.setUserState(
      LEASED_CIPHERS,
      { refreshedAt: 0, leases: Object.fromEntries(entries.map((e) => [e.cipher.id, e])) },
      userId,
    );
  const syncCipherUpdate = (id: string) =>
    ({ type: NotificationType.SyncCipherUpdate, payload: { id } }) as NotificationResponse;
  const stored = () => firstValueFrom(stateProvider.getUser(userId, LEASED_CIPHERS).state$);
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(now);

    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    authStatuses$ = new BehaviorSubject({ [userId]: AuthenticationStatus.Unlocked });
    const authService = mock<AuthService>();
    authService.authStatuses$ = authStatuses$;
    authService.authStatusFor$.mockImplementation((id) =>
      authStatuses$.pipe(map((statuses) => statuses[id])),
    );
    configService = mock<ConfigService>();
    configService.userCachedFeatureFlag$.mockReturnValue(of(true));
    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(
      of([{ canAccessPrivilegedAccess: true } as Organization]),
    );
    const sdkService = new MockSdkService();
    leases = sdkService.simulate
      .userLogin(userId)
      .commercial.mockDeep()
      .pam.mockDeep()
      .leases.mockDeep();
    leases.list_mine.mockResolvedValue([]);
    apiService = mock<ApiService>();
    apiService.getFullCipherDetails.mockImplementation(
      async (id) => ({ id, type: CipherType.Login, name: "2.encrypted" }) as CipherResponse,
    );
    notifications$ = new Subject();
    const serverNotificationsService = mock<ServerNotificationsService>();
    serverNotificationsService.notifications$ = notifications$;
    messages$ = new Subject();
    taskSchedulerService = mock<BrowserTaskSchedulerService>();
    taskSchedulerService.setTimeout.mockReturnValue(new Subscription());
    taskSchedulerService.clearScheduledAlarm.mockResolvedValue();
    logService = mock<LogService>();
    leasedCiphersChanged = jest.fn().mockResolvedValue(undefined);

    service = new PamLeaseRefreshService(
      stateProvider,
      authService,
      configService,
      organizationService,
      sdkService,
      apiService,
      serverNotificationsService,
      new MessageListener(messages$),
      taskSchedulerService,
      logService,
      leasedCiphersChanged,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("refresh", () => {
    it("stores a full copy for each live active lease and schedules its expiry", async () => {
      leases.list_mine.mockResolvedValue([
        lease("live"),
        lease("lapsed", { notAfter: at(-1) }),
        lease("revoked", { status: "revoked" }),
      ]);

      await service.refresh(userId);

      const state = await stored();
      expect(Object.keys(state.leases)).toEqual(["live"]);
      expect(state.leases.live).toMatchObject({ leaseId: "lease-live", notAfter: inAnHour });
      expect(state.leases.live.cipher).toBeInstanceOf(CipherData);
      expect(state.refreshedAt).toBe(now);
      expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(1);
      expect(leasedCiphersChanged).toHaveBeenCalled();
      expect(taskSchedulerService.setTimeout).toHaveBeenCalledWith(
        ScheduledTaskNames.pamLeaseExpiry,
        60 * 60 * 1000,
      );
    });

    it("skips a cipher whose details are still partial", async () => {
      leases.list_mine.mockResolvedValue([lease("gated")]);
      apiService.getFullCipherDetails.mockResolvedValue({
        id: "gated",
        partialData: "{}",
      } as CipherResponse);

      await service.refresh(userId);

      expect((await stored()).leases).toEqual({});
      expect(leasedCiphersChanged).not.toHaveBeenCalled();
    });

    it("reuses a held copy and drops copies whose lease ended", async () => {
      await seed(held("kept"), held("ended"));
      leases.list_mine.mockResolvedValue([lease("kept")]);

      await service.refresh(userId);

      expect(Object.keys((await stored()).leases)).toEqual(["kept"]);
      expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();
      expect(leasedCiphersChanged).toHaveBeenCalled();
    });

    it("keeps live copies when listing leases fails", async () => {
      await seed(held("kept"), held("lapsed", at(-1)));
      leases.list_mine.mockRejectedValue(new Error("offline"));

      await expect(service.refresh(userId)).resolves.toBe(false);

      expect(Object.keys((await stored()).leases)).toEqual(["kept"]);
      expect(logService.error).toHaveBeenCalled();
    });

    it("clears copies when PAM is off for the user", async () => {
      await seed(held("kept"));
      configService.userCachedFeatureFlag$.mockReturnValue(of(false));

      await service.refresh(userId);

      expect(await stored()).toBeNull();
      expect(leases.list_mine).not.toHaveBeenCalled();
      expect(leasedCiphersChanged).toHaveBeenCalled();
    });

    it("writes nothing once the user has locked", async () => {
      leases.list_mine.mockResolvedValue([lease("live")]);
      authStatuses$.next({ [userId]: AuthenticationStatus.Locked });

      await service.refresh(userId);

      expect(await stored()).toBeNull();
    });
  });

  describe("start", () => {
    it("refreshes at once, on an access-request push and when the popup asks", async () => {
      const subscription = service.start();
      await flush();
      expect(leases.list_mine).toHaveBeenCalledTimes(1);

      notifications$.next([
        { type: NotificationType.RefreshAccessRequest } as NotificationResponse,
        userId,
      ]);
      await flush();
      messages$.next({ command: PAM_REFRESH_LEASES.command, userId });
      await flush();
      notifications$.next([
        { type: NotificationType.RefreshSecurityTasks } as NotificationResponse,
        userId,
      ]);
      messages$.next({ command: PAM_REFRESH_LEASES.command, userId: "someone-else" });
      await flush();
      subscription.unsubscribe();

      expect(leases.list_mine).toHaveBeenCalledTimes(3);
    });

    it("refreshes after a successful sync for the user", async () => {
      const subscription = service.start();
      await flush();

      messages$.next({ command: "syncCompleted", successfully: true, userId });
      await flush();
      messages$.next({ command: "syncCompleted", successfully: false, userId });
      messages$.next({ command: "syncCompleted", successfully: true, userId: "someone-else" });
      await flush();
      subscription.unsubscribe();

      expect(leases.list_mine).toHaveBeenCalledTimes(2);
    });

    it("re-fetches a held copy when its cipher is edited", async () => {
      await seed(held("kept"), held("other"));
      leases.list_mine.mockResolvedValue([lease("kept"), lease("other")]);
      const subscription = service.start();
      await flush();
      expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();
      apiService.getFullCipherDetails.mockResolvedValue({
        id: "kept",
        revisionDate: at(0),
      } as CipherResponse);

      notifications$.next([syncCipherUpdate("kept"), userId]);
      await flush();
      subscription.unsubscribe();

      expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(1);
      expect(apiService.getFullCipherDetails).toHaveBeenCalledWith("kept");
      expect((await stored()).leases.kept.cipher.revisionDate).toBe(at(0));
      expect(leasedCiphersChanged).toHaveBeenCalledTimes(1);
    });

    it("ignores an edit push for a cipher it holds no copy of", async () => {
      await seed(held("kept"));
      leases.list_mine.mockResolvedValue([lease("kept")]);
      const subscription = service.start();
      await flush();

      notifications$.next([syncCipherUpdate("unleased"), userId]);
      await flush();
      subscription.unsubscribe();

      expect(leases.list_mine).toHaveBeenCalledTimes(1);
      expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();
      expect(leasedCiphersChanged).not.toHaveBeenCalled();
    });

    it("rebuilds the caches the moment a lease lapses", async () => {
      jest.useFakeTimers({ now });
      await seed(held("first", at(60_000)), held("second"));
      leases.list_mine.mockResolvedValue([
        lease("first", { notAfter: at(60_000) }),
        lease("second"),
      ]);
      const subscription = service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(leasedCiphersChanged).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(60_000);
      subscription.unsubscribe();

      expect(leasedCiphersChanged).toHaveBeenCalledTimes(1);
    });

    it("retries once after listing leases fails", async () => {
      jest.useFakeTimers({ now });
      leases.list_mine.mockRejectedValue(new Error("offline"));
      const subscription = service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(leases.list_mine).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(30_000);
      expect(leases.list_mine).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(5 * 60_000);
      subscription.unsubscribe();
      expect(leases.list_mine).toHaveBeenCalledTimes(2);
    });
  });

  describe("expiry task", () => {
    it("prunes lapsed copies and reschedules for the next one", async () => {
      await seed(held("lapsed", at(-1)), held("live"));
      const [[taskName, handler]] = taskSchedulerService.registerTaskHandler.mock.calls;
      expect(taskName).toBe(ScheduledTaskNames.pamLeaseExpiry);

      handler();
      await flush();

      expect(Object.keys((await stored()).leases)).toEqual(["live"]);
      expect(leasedCiphersChanged).not.toHaveBeenCalled();
      expect(taskSchedulerService.setTimeout).toHaveBeenCalledWith(
        ScheduledTaskNames.pamLeaseExpiry,
        60 * 60 * 1000,
      );
    });
  });
});
