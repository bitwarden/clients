import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { AccessEventService } from "@bitwarden/bit-common/pam/abstractions/access-event.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { awaitAsync, FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { PAM_REFRESH_LEASES } from "../lease-messages";

import { BrowserAccessRefreshService } from "./browser-access-refresh.service";

describe("BrowserAccessRefreshService", () => {
  const userId = "user-id" as UserId;

  let accountService: FakeAccountService;
  let messageSender: MockProxy<MessageSender>;
  let accessEvents$: Subject<void>;
  let service: BrowserAccessRefreshService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    messageSender = mock<MessageSender>();
    accessEvents$ = new Subject<void>();
    const accessEventService = mock<AccessEventService>();
    accessEventService.accessChanged$.mockReturnValue(accessEvents$);
    service = new BrowserAccessRefreshService(accessEventService, accountService, messageSender);
  });

  it("asks the background to refresh the active user's leases", async () => {
    service.notifyAccessChanged("cipher-id");
    await awaitAsync();

    expect(messageSender.send).toHaveBeenCalledWith(PAM_REFRESH_LEASES, { userId });
  });

  it("still ticks the cipher's readers at once", () => {
    let ticks = 0;
    const subscription = service.accessChanged$("cipher-id").subscribe(() => ticks++);

    service.notifyAccessChanged("cipher-id");
    subscription.unsubscribe();

    expect(ticks).toBe(1);
  });

  it("merges the popup's access events", () => {
    let ticks = 0;
    const subscription = service.accessChanged$("cipher-id").subscribe(() => ticks++);

    accessEvents$.next();
    subscription.unsubscribe();

    expect(ticks).toBe(1);
  });

  it("sends nothing without an active account", async () => {
    accountService.activeAccountSubject.next(null);

    service.notifyAccessChanged("cipher-id");
    await awaitAsync();

    expect(messageSender.send).not.toHaveBeenCalled();
  });
});
