import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener, Message } from "@bitwarden/common/platform/messaging";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { UserId } from "@bitwarden/common/types/guid";
import { AccessRequestDetailsResponse, PamApiService } from "@bitwarden/pam";

import { ApproverInboxRequestsService } from "./approver-inbox-requests.service";

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function notificationOf(type: NotificationType): readonly [NotificationResponse, UserId] {
  return [{ type } as NotificationResponse, "user-1" as UserId];
}

function rows(...ids: string[]): AccessRequestDetailsResponse[] {
  return ids.map((id) => ({ id }) as AccessRequestDetailsResponse);
}

describe("ApproverInboxRequestsService", () => {
  let pamFlag$: BehaviorSubject<boolean>;
  let notifications$: Subject<readonly [NotificationResponse, UserId]>;
  let mutations$: Subject<void>;
  let messages$: Subject<Message<Record<string, unknown>>>;
  let listInboxRequests: jest.Mock;
  let service: ApproverInboxRequestsService;
  let emitted: string[][];

  beforeEach(() => {
    pamFlag$ = new BehaviorSubject<boolean>(false);
    notifications$ = new Subject();
    mutations$ = new Subject();
    messages$ = new Subject();
    listInboxRequests = jest.fn().mockResolvedValue([]);

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => pamFlag$ } },
        { provide: PamApiService, useValue: { listInboxRequests, mutations$ } },
        { provide: ServerNotificationsService, useValue: { notifications$ } },
        { provide: MessageListener, useValue: { allMessages$: messages$ } },
        { provide: LogService, useValue: { error: jest.fn() } },
      ],
    });

    service = TestBed.inject(ApproverInboxRequestsService);
    emitted = [];
    service.requests$.subscribe((r) => emitted.push(r.map((row) => row.id)));
  });

  afterEach(() => {
    service.destroy();
  });

  it("stays empty without fetching while the flag is off", async () => {
    await flushMicrotasks();

    expect(listInboxRequests).not.toHaveBeenCalled();
    expect(emitted).toEqual([[]]);
  });

  it("fetches once when the flag turns on", async () => {
    listInboxRequests.mockResolvedValue(rows("a", "b"));
    pamFlag$.next(true);
    await flushMicrotasks();

    expect(listInboxRequests).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([[], ["a", "b"]]);
  });

  it("re-fetches on a RefreshApproverInbox notification", async () => {
    listInboxRequests.mockResolvedValue(rows("a"));
    pamFlag$.next(true);
    await flushMicrotasks();

    listInboxRequests.mockResolvedValue(rows("a", "b", "c"));
    notifications$.next(notificationOf(NotificationType.RefreshApproverInbox));
    await flushMicrotasks();

    expect(listInboxRequests).toHaveBeenCalledTimes(2);
    expect(emitted[emitted.length - 1]).toEqual(["a", "b", "c"]);
  });

  it("ignores unrelated notification types", async () => {
    pamFlag$.next(true);
    await flushMicrotasks();
    listInboxRequests.mockClear();

    notifications$.next(notificationOf(NotificationType.SyncCipherCreate));
    await flushMicrotasks();

    expect(listInboxRequests).not.toHaveBeenCalled();
  });

  it("re-fetches when a local PAM mutation completes", async () => {
    pamFlag$.next(true);
    await flushMicrotasks();

    listInboxRequests.mockResolvedValue(rows("a"));
    mutations$.next();
    await flushMicrotasks();

    expect(listInboxRequests).toHaveBeenCalledTimes(2);
    expect(emitted[emitted.length - 1]).toEqual(["a"]);
  });

  it("re-fetches when a sync completes", async () => {
    pamFlag$.next(true);
    await flushMicrotasks();

    listInboxRequests.mockResolvedValue(rows("a", "b", "c", "d"));
    messages$.next({ command: "syncCompleted" } as Message<Record<string, unknown>>);
    await flushMicrotasks();

    expect(listInboxRequests).toHaveBeenCalledTimes(2);
    expect(emitted[emitted.length - 1]).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores unrelated messages", async () => {
    pamFlag$.next(true);
    await flushMicrotasks();
    listInboxRequests.mockClear();

    messages$.next({ command: "somethingElse" } as Message<Record<string, unknown>>);
    await flushMicrotasks();

    expect(listInboxRequests).not.toHaveBeenCalled();
  });

  it("resets to empty without fetching when the flag turns off", async () => {
    listInboxRequests.mockResolvedValue(rows("a", "b"));
    pamFlag$.next(true);
    await flushMicrotasks();
    listInboxRequests.mockClear();

    pamFlag$.next(false);
    await flushMicrotasks();

    expect(listInboxRequests).not.toHaveBeenCalled();
    expect(emitted).toEqual([[], ["a", "b"], []]);
  });

  it("keeps the previous rows when a fetch fails", async () => {
    listInboxRequests.mockResolvedValue(rows("a", "b"));
    pamFlag$.next(true);
    await flushMicrotasks();

    listInboxRequests.mockRejectedValue(new Error("network"));
    mutations$.next();
    await flushMicrotasks();

    expect(emitted[emitted.length - 1]).toEqual(["a", "b"]);
    expect(TestBed.inject(LogService).error).toHaveBeenCalled();
  });

  it("refresh() forces an immediate fetch", async () => {
    listInboxRequests.mockResolvedValue(rows("a"));
    pamFlag$.next(true);
    await flushMicrotasks();

    listInboxRequests.mockResolvedValue(rows("a", "b"));
    await service.refresh();

    expect(emitted[emitted.length - 1]).toEqual(["a", "b"]);
  });

  describe("count$ (nav badge)", () => {
    let counts: number[];

    beforeEach(() => {
      counts = [];
      service.count$.subscribe((c) => counts.push(c));
    });

    it("counts only actionable requests, excluding timed-out and lapsed ones", async () => {
      listInboxRequests.mockResolvedValue([
        { id: "live", requestedNotAfter: null, expiredAt: null },
        { id: "future-window", requestedNotAfter: "2999-01-01T00:00:00Z", expiredAt: null },
        { id: "timed-out", requestedNotAfter: "2000-01-01T00:00:00Z", expiredAt: null },
        { id: "lapsed", requestedNotAfter: null, expiredAt: "2000-01-01T00:00:00Z" },
      ] as AccessRequestDetailsResponse[]);
      pamFlag$.next(true);
      await flushMicrotasks();

      expect(counts[counts.length - 1]).toBe(2);
    });

    it("does not re-emit when the actionable count is unchanged", async () => {
      listInboxRequests.mockResolvedValue(rows("a"));
      pamFlag$.next(true);
      await flushMicrotasks();

      listInboxRequests.mockResolvedValue(rows("b"));
      mutations$.next();
      await flushMicrotasks();

      // 0 (initial) then 1 — the second one-row fetch keeps the count at 1.
      expect(counts).toEqual([0, 1]);
    });
  });
});
