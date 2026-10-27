import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, map, of, Subject, Subscription } from "rxjs";

import { AccessLeaseSdkService } from "@bitwarden/bit-common/pam/abstractions/access-lease-sdk.service";
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
import { SyncService } from "@bitwarden/common/platform/sync";
import { awaitAsync, FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import type { AccessLeaseView } from "@bitwarden/sdk-internal";

import { PAM_REFRESH_LEASES } from "../lease-messages";
import { LEASED_CIPHERS } from "../leased-cipher.state";
import { at, IN_AN_HOUR, leaseEntry, NOW, seedLeases } from "../leased-cipher.state.spec-util";

import { PamLeaseRefreshService } from "./pam-lease-refresh.service";

describe("PamLeaseRefreshService", () => {
  const userId = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as UserId;

  let stateProvider: FakeStateProvider;
  let authStatuses$: BehaviorSubject<Record<UserId, AuthenticationStatus>>;
  let configService: MockProxy<ConfigService>;
  let accessLeaseSdkService: MockProxy<AccessLeaseSdkService>;
  let apiService: MockProxy<ApiService>;
  let notifications$: Subject<readonly [NotificationResponse, UserId]>;
  let lastSync$: BehaviorSubject<Date | null>;
  let messages$: Subject<Message<Record<string, unknown>>>;
  let taskSchedulerService: MockProxy<BrowserTaskSchedulerService>;
  let leasedCiphersChanged: jest.Mock<Promise<void>, []>;
  let service: PamLeaseRefreshService;

  const lease = (cipherId: string, overrides: Partial<AccessLeaseView> = {}) =>
    ({
      id: `lease-${cipherId}`,
      cipherId,
      status: "active",
      notAfter: IN_AN_HOUR,
      ...overrides,
    }) as unknown as AccessLeaseView;
  const push = (type: NotificationType, payload?: unknown) =>
    notifications$.next([{ type, payload } as NotificationResponse, userId]);
  const stored = () => firstValueFrom(stateProvider.getUser(userId, LEASED_CIPHERS).state$);
  const storedIds = async () => Object.keys((await stored())?.leases ?? {});

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);

    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    authStatuses$ = new BehaviorSubject<Record<UserId, AuthenticationStatus>>({
      [userId]: AuthenticationStatus.Unlocked,
    });
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
    accessLeaseSdkService = mock<AccessLeaseSdkService>();
    accessLeaseSdkService.listMyLeases.mockResolvedValue([]);
    apiService = mock<ApiService>();
    apiService.getFullCipherDetails.mockImplementation(
      async (id) => ({ id, type: CipherType.Login, name: "2.encrypted" }) as CipherResponse,
    );
    notifications$ = new Subject();
    const serverNotificationsService = mock<ServerNotificationsService>();
    serverNotificationsService.notifications$ = notifications$;
    lastSync$ = new BehaviorSubject<Date | null>(new Date(0));
    const syncService = mock<SyncService>();
    syncService.lastSync$.mockReturnValue(lastSync$);
    messages$ = new Subject();
    taskSchedulerService = mock<BrowserTaskSchedulerService>();
    taskSchedulerService.setTimeout.mockReturnValue(new Subscription());
    taskSchedulerService.clearScheduledAlarm.mockResolvedValue();
    leasedCiphersChanged = jest.fn().mockResolvedValue(undefined);

    service = new PamLeaseRefreshService(
      stateProvider,
      authService,
      configService,
      organizationService,
      accessLeaseSdkService,
      apiService,
      serverNotificationsService,
      syncService,
      new MessageListener(messages$),
      taskSchedulerService,
      mock<LogService>(),
      leasedCiphersChanged,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("refresh", () => {
    it("stores a full copy for each live active lease of the user", async () => {
      accessLeaseSdkService.listMyLeases.mockResolvedValue([
        lease("live"),
        lease("lapsed", { notAfter: at(-1) }),
        lease("revoked", { status: "revoked" }),
      ]);

      await service.refresh(userId);

      const state = await stored();
      expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledWith(userId);
      expect(await storedIds()).toEqual(["live"]);
      expect(state?.leases.live).toMatchObject({ leaseId: "lease-live", notAfter: IN_AN_HOUR });
      expect(state?.leases.live.cipher).toBeInstanceOf(CipherData);
      expect(state?.refreshedAt).toBe(NOW);
      expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(1);
    });

    it("skips a cipher whose details are still partial", async () => {
      accessLeaseSdkService.listMyLeases.mockResolvedValue([lease("gated")]);
      apiService.getFullCipherDetails.mockResolvedValue({
        id: "gated",
        partialData: "{}",
      } as CipherResponse);

      await service.refresh(userId);

      expect((await stored())?.leases).toEqual({});
    });

    it("reuses a held copy and drops copies whose lease ended", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("kept"), leaseEntry("ended")]);
      accessLeaseSdkService.listMyLeases.mockResolvedValue([lease("kept")]);

      await service.refresh(userId);

      expect(await storedIds()).toEqual(["kept"]);
      expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();
    });

    it("clears copies when PAM is off for the user", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("kept")]);
      configService.userCachedFeatureFlag$.mockReturnValue(of(false));

      await service.refresh(userId);

      expect(await stored()).toBeNull();
      expect(accessLeaseSdkService.listMyLeases).not.toHaveBeenCalled();
    });

    it("writes nothing once the user has locked", async () => {
      accessLeaseSdkService.listMyLeases.mockResolvedValue([lease("live")]);
      authStatuses$.next({ [userId]: AuthenticationStatus.Locked });

      await service.refresh(userId);

      expect(await stored()).toBeNull();
    });
  });

  describe("start", () => {
    let subscription: Subscription;

    afterEach(() => subscription?.unsubscribe());

    it("refreshes at once, on an access-request push and when the popup asks", async () => {
      subscription = service.start();
      await awaitAsync();
      expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledTimes(1);

      push(NotificationType.RefreshAccessRequest);
      await awaitAsync();
      messages$.next({ command: PAM_REFRESH_LEASES.command, userId });
      await awaitAsync();
      push(NotificationType.RefreshSecurityTasks);
      messages$.next({ command: PAM_REFRESH_LEASES.command, userId: "someone-else" });
      await awaitAsync();

      expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledTimes(3);
    });

    it("refreshes after a full sync, not after every sync message", async () => {
      subscription = service.start();
      await awaitAsync();

      lastSync$.next(new Date(NOW));
      await awaitAsync();
      lastSync$.next(new Date(NOW));
      messages$.next({ command: "syncCompleted", successfully: true, userId });
      await awaitAsync();

      expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledTimes(2);
    });

    it("re-fetches a held copy when its cipher is edited and rebuilds the caches once", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("kept"), leaseEntry("other")]);
      accessLeaseSdkService.listMyLeases.mockResolvedValue([lease("kept"), lease("other")]);
      subscription = service.start();
      await awaitAsync();
      expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();
      apiService.getFullCipherDetails.mockResolvedValue({
        id: "kept",
        revisionDate: at(0),
      } as CipherResponse);

      push(NotificationType.SyncCipherUpdate, { id: "kept" });
      await awaitAsync();

      expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(1);
      expect(apiService.getFullCipherDetails).toHaveBeenCalledWith("kept");
      expect((await stored())?.leases.kept.cipher.revisionDate).toBe(at(0));
      expect(leasedCiphersChanged).toHaveBeenCalledTimes(1);
    });

    it("re-fetches a held copy when the popup asks for its cipher", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("kept")]);
      accessLeaseSdkService.listMyLeases.mockResolvedValue([lease("kept")]);
      subscription = service.start();
      await awaitAsync();
      expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();

      messages$.next({ command: PAM_REFRESH_LEASES.command, userId, cipherId: "kept" });
      await awaitAsync();

      expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(1);
      expect(apiService.getFullCipherDetails).toHaveBeenCalledWith("kept");
    });

    it("fetches a new lease when the popup asks for a cipher it holds no copy of", async () => {
      subscription = service.start();
      await awaitAsync();
      accessLeaseSdkService.listMyLeases.mockResolvedValue([lease("new")]);

      messages$.next({ command: PAM_REFRESH_LEASES.command, userId, cipherId: "new" });
      await awaitAsync();

      expect(await storedIds()).toEqual(["new"]);
    });

    it("ignores an edit push for a cipher it holds no copy of", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("kept")]);
      accessLeaseSdkService.listMyLeases.mockResolvedValue([lease("kept")]);
      subscription = service.start();
      await awaitAsync();

      push(NotificationType.SyncCipherUpdate, { id: "unleased" });
      await awaitAsync();

      expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledTimes(1);
      expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();
      expect(leasedCiphersChanged).not.toHaveBeenCalled();
    });

    it("rebuilds the caches once when a refresh drops a revoked lease", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("kept"), leaseEntry("revoked")]);
      accessLeaseSdkService.listMyLeases.mockResolvedValue([lease("kept")]);

      subscription = service.start();
      await awaitAsync();

      expect(await storedIds()).toEqual(["kept"]);
      expect(leasedCiphersChanged).toHaveBeenCalledTimes(1);
    });

    it("rebuilds the caches once when a lease lapses, and the expiry task prunes it", async () => {
      jest.useFakeTimers({ now: NOW });
      await seedLeases(stateProvider, userId, [
        leaseEntry("first", at(60_000)),
        leaseEntry("second"),
      ]);
      accessLeaseSdkService.listMyLeases.mockResolvedValue([
        lease("first", { notAfter: at(60_000) }),
        lease("second"),
      ]);
      subscription = service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(leasedCiphersChanged).not.toHaveBeenCalled();
      expect(taskSchedulerService.clearScheduledAlarm).toHaveBeenCalled();
      expect(taskSchedulerService.setTimeout).toHaveBeenCalledTimes(1);
      expect(taskSchedulerService.setTimeout).toHaveBeenCalledWith(
        ScheduledTaskNames.pamLeaseExpiry,
        60_000,
      );

      await jest.advanceTimersByTimeAsync(60_000);
      const [[, expiryTask]] = taskSchedulerService.registerTaskHandler.mock.calls;
      expiryTask();
      await jest.advanceTimersByTimeAsync(0);

      expect(await storedIds()).toEqual(["second"]);
      expect(leasedCiphersChanged).toHaveBeenCalledTimes(1);
      expect(taskSchedulerService.setTimeout).toHaveBeenLastCalledWith(
        ScheduledTaskNames.pamLeaseExpiry,
        60 * 60_000 - 60_000,
      );
    });

    it("retries a failed list once, then keeps the live copies", async () => {
      jest.useFakeTimers({ now: NOW });
      await seedLeases(stateProvider, userId, [leaseEntry("kept"), leaseEntry("lapsed", at(-1))]);
      accessLeaseSdkService.listMyLeases.mockRejectedValue(new Error("offline"));
      subscription = service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(30_000);
      expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledTimes(2);
      expect(await storedIds()).toEqual(["kept"]);

      await jest.advanceTimersByTimeAsync(5 * 60_000);
      expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledTimes(2);
    });
  });
});
