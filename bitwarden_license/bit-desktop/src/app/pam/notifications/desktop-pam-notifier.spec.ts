import { BehaviorSubject, Subject, Subscription } from "rxjs";

import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessLeaseView,
  AccessRequestSdkService,
  AccessRequestStatus,
  AccessRequestView,
  ApprovalSdkService,
  emptyPamSnapshot,
  PamNotificationSink,
  PamNotificationSnapshot,
} from "@bitwarden/bit-pam";
import { ApprovalPrivilegeService } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DesktopPamNotifier } from "./desktop-pam-notifier";
import { PamNotificationStateService } from "./pam-notification-state.service";

const USER = "user-1" as UserId;
const NOW = new Date("2026-06-10T12:00:00.000Z");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function request(
  id: string,
  init: { status?: AccessRequestStatus; requesterId?: string } = {},
): AccessRequestView {
  return {
    id,
    requesterId: init.requesterId ?? USER,
    status: init.status ?? "pending",
    leaseNotAfter: new Date(NOW.getTime() + HOUR).toISOString(),
  } as unknown as AccessRequestView;
}

function lease(id: string, endsInMs: number): AccessLeaseView {
  return {
    id,
    status: "active",
    notAfter: new Date(NOW.getTime() + endsInMs).toISOString(),
  } as unknown as AccessLeaseView;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
}

describe("DesktopPamNotifier", () => {
  let activeAccount$: BehaviorSubject<{ id: UserId } | null>;
  let flag$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<{ usePam: boolean }[]>;
  let authStatus$: BehaviorSubject<AuthenticationStatus>;
  let canApprove$: BehaviorSubject<boolean>;
  let accessChanged$: Subject<void>;
  let approverInboxChanged$: Subject<void>;
  let enabled$: BehaviorSubject<boolean>;
  let persisted: PamNotificationSnapshot | null;
  let setSnapshot: jest.Mock;
  let sink: { notify: jest.Mock };
  let logError: jest.Mock;
  let isWindowVisible: jest.Mock;
  let hasFocus: jest.SpyInstance;

  let inbox: AccessRequestView[];
  let mine: AccessRequestView[];
  let leases: AccessLeaseView[];
  let listInbox: jest.Mock;
  let listMine: jest.Mock;
  let listLeases: jest.Mock;

  let subscription: Subscription | undefined;

  function start(): void {
    const notifier = new DesktopPamNotifier(
      { activeAccount$ } as unknown as AccountService,
      { authStatusFor$: () => authStatus$ } as unknown as AuthService,
      { getFeatureFlag$: () => flag$ } as unknown as ConfigService,
      { organizations$: () => organizations$ } as unknown as OrganizationService,
      {
        accessChanged$: () => accessChanged$,
        approverInboxChanged$: () => approverInboxChanged$,
      } as unknown as AccessEventService,
      { listMyAccessRequests: listMine } as unknown as AccessRequestSdkService,
      { listMyLeases: listLeases } as unknown as AccessLeaseSdkService,
      { listInbox } as unknown as ApprovalSdkService,
      { canApprove$ } as unknown as ApprovalPrivilegeService,
      {
        enabled$,
        snapshot$: () => new BehaviorSubject(persisted),
        setSnapshot,
      } as unknown as PamNotificationStateService,
      sink as unknown as PamNotificationSink,
      { error: logError } as unknown as LogService,
    );
    subscription = notifier.start();
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    activeAccount$ = new BehaviorSubject<{ id: UserId } | null>({ id: USER });
    flag$ = new BehaviorSubject(true);
    organizations$ = new BehaviorSubject<{ usePam: boolean }[]>([{ usePam: true }]);
    authStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    canApprove$ = new BehaviorSubject(true);
    accessChanged$ = new Subject<void>();
    approverInboxChanged$ = new Subject<void>();
    enabled$ = new BehaviorSubject(true);
    persisted = null;
    window.sessionStorage.clear();
    setSnapshot = jest.fn().mockResolvedValue(undefined);
    sink = { notify: jest.fn().mockResolvedValue(undefined) };
    logError = jest.fn();
    isWindowVisible = jest.fn().mockResolvedValue(false);
    hasFocus = jest.spyOn(document, "hasFocus").mockReturnValue(false);
    (global as any).ipc = { platform: { isWindowVisible } };

    inbox = [];
    mine = [];
    leases = [];
    listInbox = jest.fn(async () => inbox);
    listMine = jest.fn(async () => mine);
    listLeases = jest.fn(async () => leases);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
    hasFocus.mockRestore();
    jest.useRealTimers();
    delete (global as any).ipc;
  });

  /** Starts, then unlocks so the first read is a seed, as after a real login. */
  async function startSeeded(): Promise<void> {
    authStatus$.next(AuthenticationStatus.Locked);
    start();
    await flush();
    authStatus$.next(AuthenticationStatus.Unlocked);
    await flush();
  }

  describe("seeding", () => {
    it("only seeds on the first read after unlock", async () => {
      inbox = [request("i1", { requesterId: "other" })];
      mine = [request("r1", { status: "approved" })];

      await startSeeded();

      expect(listInbox).toHaveBeenCalledTimes(1);
      expect(sink.notify).not.toHaveBeenCalled();
      expect(setSnapshot).toHaveBeenCalledWith(USER, {
        inbox: ["i1"],
        requests: { r1: "approved" },
        leases: {},
      });
    });

    it("seeds again after a lock and unlock, so nothing from the gap is announced", async () => {
      await startSeeded();
      authStatus$.next(AuthenticationStatus.Locked);
      await flush();
      inbox = [request("i1", { requesterId: "other" })];

      authStatus$.next(AuthenticationStatus.Unlocked);
      await flush();

      expect(sink.notify).not.toHaveBeenCalled();
    });

    it("resumes from the stored snapshot when a reloaded renderer starts already unlocked", async () => {
      window.sessionStorage.setItem(`pamNotifierSeeded:${USER}`, "1");
      persisted = { ...emptyPamSnapshot(), requests: { r1: "pending" } };
      mine = [request("r1", { status: "approved" })];

      start();
      await flush();

      expect(sink.notify).toHaveBeenCalledWith([{ kind: "requestApproved", id: "r1" }]);
    });

    it("seeds a cold start instead of announcing what changed while the app was closed", async () => {
      persisted = { ...emptyPamSnapshot(), requests: { r1: "pending" } };
      mine = [request("r1", { status: "approved" })];

      start();
      await flush();

      expect(sink.notify).not.toHaveBeenCalled();
    });

    it("seeds a renderer that starts unlocked with nothing stored", async () => {
      inbox = [request("i1", { requesterId: "other" })];

      start();
      await flush();

      expect(sink.notify).not.toHaveBeenCalled();
      expect(setSnapshot).toHaveBeenCalled();
    });
  });

  describe("on a push", () => {
    it("announces a new approval request on an inbox tick", async () => {
      await startSeeded();
      inbox = [request("i1", { requesterId: "other" })];

      approverInboxChanged$.next();
      await flush();

      expect(sink.notify).toHaveBeenCalledWith([{ kind: "approvalRequested", id: "i1" }]);
    });

    it("announces a decision on the user's own request on a requester tick", async () => {
      mine = [request("r1")];
      await startSeeded();
      mine = [request("r1", { status: "denied" })];

      accessChanged$.next();
      await flush();

      expect(sink.notify).toHaveBeenCalledWith([{ kind: "requestDenied", id: "r1" }]);
    });

    it("does not announce the user's own request showing up in their inbox", async () => {
      await startSeeded();
      inbox = [request("i1", { requesterId: USER })];

      approverInboxChanged$.next();
      await flush();

      expect(sink.notify).not.toHaveBeenCalled();
    });

    it("sends several events together in one call", async () => {
      mine = [request("r1"), request("r2")];
      await startSeeded();
      mine = [request("r1", { status: "approved" }), request("r2", { status: "approved" })];
      inbox = [request("i1", { requesterId: "other" })];

      accessChanged$.next();
      await flush();

      expect(sink.notify).toHaveBeenCalledTimes(1);
      expect(sink.notify.mock.calls[0][0]).toHaveLength(3);
    });

    it("does not announce the same change twice", async () => {
      await startSeeded();
      inbox = [request("i1", { requesterId: "other" })];

      approverInboxChanged$.next();
      await flush();
      approverInboxChanged$.next();
      await flush();

      expect(sink.notify).toHaveBeenCalledTimes(1);
    });

    it("runs overlapping reads one at a time", async () => {
      await startSeeded();
      const releases: (() => void)[] = [];
      let running = 0;
      let maxRunning = 0;
      listMine.mockImplementation(async () => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await new Promise<void>((resolve) => releases.push(resolve));
        running -= 1;
        return [];
      });

      accessChanged$.next();
      accessChanged$.next();
      await flush();
      expect(releases).toHaveLength(1);
      releases[0]();
      await flush();
      expect(releases).toHaveLength(2);
      releases[1]();
      await flush();

      expect(maxRunning).toBe(1);
    });

    it("keeps the rest of the snapshot when one list fails to read", async () => {
      leases = [lease("l1", 2 * HOUR)];
      await startSeeded();
      leases = [];
      listLeases.mockRejectedValue(new Error("down"));

      accessChanged$.next();
      await flush();

      expect(logError).toHaveBeenCalled();
      expect(sink.notify).not.toHaveBeenCalled();
      expect(setSnapshot).toHaveBeenLastCalledWith(
        USER,
        expect.objectContaining({ leases: { l1: "live" } }),
      );
    });

    it("does not read the inbox for a user who cannot approve", async () => {
      canApprove$.next(false);

      await startSeeded();

      expect(listInbox).not.toHaveBeenCalled();
      expect(listMine).toHaveBeenCalled();
    });
  });

  describe("a gain of approver privilege", () => {
    it("does not announce the existing inbox as new", async () => {
      canApprove$.next(false);
      inbox = [request("i1", { requesterId: "other" })];
      await startSeeded();

      canApprove$.next(true);
      accessChanged$.next();
      await flush();

      expect(sink.notify).not.toHaveBeenCalled();
    });
  });

  describe("leases", () => {
    it("retries the lease read after a failure so the lapse timer is not lost", async () => {
      leases = [lease("l1", 10 * MIN)];
      await startSeeded();
      listLeases.mockRejectedValueOnce(new Error("down"));
      accessChanged$.next();
      await flush();

      await jest.advanceTimersByTimeAsync(5 * MIN + 2000);
      await flush();

      expect(sink.notify).toHaveBeenCalledWith([{ kind: "leaseEndingSoon", id: "l1" }]);
    });

    it("stays silent while VFO1 is off", async () => {
      flag$.next(false);

      await startSeeded();

      expect(listMine).not.toHaveBeenCalled();
    });

    it("reads again at the ending-soon moment and announces it", async () => {
      leases = [lease("l1", 10 * MIN)];
      await startSeeded();
      expect(sink.notify).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(5 * MIN + 2000);
      await flush();

      expect(sink.notify).toHaveBeenCalledWith([{ kind: "leaseEndingSoon", id: "l1" }]);
    });

    it("then announces the end without another push", async () => {
      leases = [lease("l1", 6 * MIN)];
      await startSeeded();
      await jest.advanceTimersByTimeAsync(2 * MIN);
      await flush();
      sink.notify.mockClear();
      leases = [];

      await jest.advanceTimersByTimeAsync(4 * MIN + 2000);
      await flush();

      expect(sink.notify).toHaveBeenCalledWith([{ kind: "leaseEnded", id: "l1" }]);
    });

    it("stops the timer when the user locks", async () => {
      leases = [lease("l1", 10 * MIN)];
      await startSeeded();
      listLeases.mockClear();

      authStatus$.next(AuthenticationStatus.Locked);
      await flush();
      await jest.advanceTimersByTimeAsync(HOUR);

      expect(listLeases).not.toHaveBeenCalled();
    });
  });

  describe("gating", () => {
    async function seededWithChange(): Promise<void> {
      await startSeeded();
      inbox = [request("i1", { requesterId: "other" })];
      approverInboxChanged$.next();
      await flush();
    }

    it("reads nothing while the feature flag is off", async () => {
      flag$.next(false);

      await startSeeded();
      approverInboxChanged$.next();
      await flush();

      expect(listMine).not.toHaveBeenCalled();
      expect(setSnapshot).not.toHaveBeenCalled();
    });

    it("reads nothing when no organization uses PAM", async () => {
      organizations$.next([{ usePam: false }]);

      await startSeeded();

      expect(listMine).not.toHaveBeenCalled();
    });

    it("reads nothing while locked", async () => {
      authStatus$.next(AuthenticationStatus.Locked);
      start();
      await flush();
      accessChanged$.next();
      await flush();

      expect(listMine).not.toHaveBeenCalled();
    });

    it("reads nothing when logged out", async () => {
      activeAccount$.next(null);
      start();
      await flush();

      expect(listMine).not.toHaveBeenCalled();
    });

    it("withholds the notification when the toggle is off but keeps the snapshot current", async () => {
      enabled$.next(false);
      await seededWithChange();
      expect(sink.notify).not.toHaveBeenCalled();

      enabled$.next(true);
      approverInboxChanged$.next();
      await flush();

      expect(sink.notify).not.toHaveBeenCalled();
    });

    it("withholds the notification while the window is visible and focused", async () => {
      isWindowVisible.mockResolvedValue(true);
      hasFocus.mockReturnValue(true);

      await seededWithChange();

      expect(sink.notify).not.toHaveBeenCalled();
    });

    it("notifies when the window is visible but not focused", async () => {
      isWindowVisible.mockResolvedValue(true);
      hasFocus.mockReturnValue(false);

      await seededWithChange();

      expect(sink.notify).toHaveBeenCalledTimes(1);
    });

    it("notifies when the window is hidden even if the page reports focus", async () => {
      isWindowVisible.mockResolvedValue(false);
      hasFocus.mockReturnValue(true);

      await seededWithChange();

      expect(sink.notify).toHaveBeenCalledTimes(1);
    });
  });

  it("logs and keeps watching when a read throws unexpectedly", async () => {
    await startSeeded();
    setSnapshot.mockRejectedValueOnce(new Error("disk"));
    accessChanged$.next();
    await flush();

    inbox = [request("i1", { requesterId: "other" })];
    approverInboxChanged$.next();
    await flush();

    expect(logError).toHaveBeenCalled();
    expect(sink.notify).toHaveBeenCalledTimes(1);
  });
});
