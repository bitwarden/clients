import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener, Message } from "@bitwarden/common/platform/messaging";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { UserId } from "@bitwarden/common/types/guid";
import { InboxAccessRequestResponse, PamApiService } from "@bitwarden/pam";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function notificationOf(type: NotificationType): readonly [NotificationResponse, UserId] {
  return [{ type } as NotificationResponse, "user-1" as UserId];
}

describe("ApproverInboxBadgeService", () => {
  let pamFlag$: BehaviorSubject<boolean>;
  let notifications$: Subject<readonly [NotificationResponse, UserId]>;
  let mutations$: Subject<void>;
  let messages$: Subject<Message<Record<string, unknown>>>;
  let listInboxRequests: jest.Mock;
  let service: ApproverInboxBadgeService;
  let emitted: number[];

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

    service = TestBed.inject(ApproverInboxBadgeService);
    emitted = [];
    service.count$.subscribe((count) => emitted.push(count));
  });

  afterEach(() => {
    service.destroy();
  });

  function resolveRows(count: number) {
    listInboxRequests.mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({ id: `req-${i}` }) as InboxAccessRequestResponse),
    );
  }

  it("stays at 0 without fetching while the flag is off", async () => {
    await flushMicrotasks();

    expect(listInboxRequests).not.toHaveBeenCalled();
    expect(emitted).toEqual([0]);
  });

  it("fetches once when the flag turns on", async () => {
    resolveRows(2);
    pamFlag$.next(true);
    await flushMicrotasks();

    expect(listInboxRequests).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([0, 2]);
  });

  it("re-fetches on a RefreshApproverInbox notification", async () => {
    resolveRows(1);
    pamFlag$.next(true);
    await flushMicrotasks();

    resolveRows(3);
    notifications$.next(notificationOf(NotificationType.RefreshApproverInbox));
    await flushMicrotasks();

    expect(listInboxRequests).toHaveBeenCalledTimes(2);
    expect(emitted).toEqual([0, 1, 3]);
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

    resolveRows(1);
    mutations$.next();
    await flushMicrotasks();

    expect(listInboxRequests).toHaveBeenCalledTimes(2);
    expect(emitted).toEqual([0, 1]);
  });

  it("re-fetches when a sync completes", async () => {
    pamFlag$.next(true);
    await flushMicrotasks();

    resolveRows(4);
    messages$.next({ command: "syncCompleted" } as Message<Record<string, unknown>>);
    await flushMicrotasks();

    expect(listInboxRequests).toHaveBeenCalledTimes(2);
    expect(emitted).toEqual([0, 4]);
  });

  it("ignores unrelated messages", async () => {
    pamFlag$.next(true);
    await flushMicrotasks();
    listInboxRequests.mockClear();

    messages$.next({ command: "somethingElse" } as Message<Record<string, unknown>>);
    await flushMicrotasks();

    expect(listInboxRequests).not.toHaveBeenCalled();
  });

  it("resets to 0 without fetching when the flag turns off", async () => {
    resolveRows(2);
    pamFlag$.next(true);
    await flushMicrotasks();
    listInboxRequests.mockClear();

    pamFlag$.next(false);
    await flushMicrotasks();

    expect(listInboxRequests).not.toHaveBeenCalled();
    expect(emitted).toEqual([0, 2, 0]);
  });

  it("keeps the previous count when a fetch fails", async () => {
    resolveRows(2);
    pamFlag$.next(true);
    await flushMicrotasks();

    listInboxRequests.mockRejectedValue(new Error("network"));
    mutations$.next();
    await flushMicrotasks();

    expect(emitted).toEqual([0, 2]);
    expect(TestBed.inject(LogService).error).toHaveBeenCalled();
  });

  it("refresh() forces an immediate fetch", async () => {
    resolveRows(5);
    pamFlag$.next(true);
    await flushMicrotasks();

    resolveRows(6);
    await service.refresh();

    expect(emitted).toEqual([0, 5, 6]);
  });
});
