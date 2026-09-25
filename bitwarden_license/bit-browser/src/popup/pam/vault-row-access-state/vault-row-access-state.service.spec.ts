import { TestBed } from "@angular/core/testing";
import { firstValueFrom, Subject } from "rxjs";

import { AccessRefreshService, AccessRequestSdkService } from "@bitwarden/bit-common/pam";
import type { CipherAccessStateView } from "@bitwarden/bit-common/pam";

import { VaultRowAccessStateService } from "./vault-row-access-state.service";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("VaultRowAccessStateService", () => {
  let service: VaultRowAccessStateService;
  let accessRequestSdkService: {
    getCipherAccessState: jest.Mock<Promise<CipherAccessStateView>, [string]>;
  };
  let accessChanged: Subject<void>;

  beforeEach(() => {
    accessRequestSdkService = { getCipherAccessState: jest.fn() };
    accessChanged = new Subject<void>();

    TestBed.configureTestingModule({
      providers: [
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        { provide: AccessRefreshService, useValue: { accessChanged$: () => accessChanged } },
      ],
    });

    service = TestBed.inject(VaultRowAccessStateService);
  });

  it("reads a cipher's access state once for two subscribers", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      badgeState: "privileged",
    } as unknown as CipherAccessStateView);

    const first = await firstValueFrom(service.state$("cipher-1"));
    const second = await firstValueFrom(service.state$("cipher-1"));

    expect(first).toEqual({ badgeState: "privileged" });
    expect(second).toEqual({ badgeState: "privileged" });
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(1);
  });

  it("reads different ciphers separately", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      badgeState: "privileged",
    } as unknown as CipherAccessStateView);

    await firstValueFrom(service.state$("cipher-1"));
    await firstValueFrom(service.state$("cipher-2"));

    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(2);
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledWith("cipher-2");
  });

  it("re-reads a cipher after it is invalidated", async () => {
    accessRequestSdkService.getCipherAccessState
      .mockResolvedValueOnce({ badgeState: "privileged" } as unknown as CipherAccessStateView)
      .mockResolvedValueOnce({ badgeState: "pending" } as unknown as CipherAccessStateView);

    const values: (CipherAccessStateView | null)[] = [];
    const subscription = service.state$("cipher-1").subscribe((value) => values.push(value));
    await flushMicrotasks();

    service.invalidate("cipher-1");
    await flushMicrotasks();
    subscription.unsubscribe();

    expect(values).toEqual([{ badgeState: "privileged" }, { badgeState: "pending" }]);
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(2);
  });

  it("re-reads every cached cipher when access changes anywhere", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({} as CipherAccessStateView);
    const a = service.state$("a").subscribe();
    const b = service.state$("b").subscribe();
    await flushMicrotasks();

    accessChanged.next();
    await flushMicrotasks();

    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(4);
    a.unsubscribe();
    b.unsubscribe();
  });

  it("resolves null when the read fails", async () => {
    accessRequestSdkService.getCipherAccessState.mockRejectedValue(new Error("boom"));

    expect(await firstValueFrom(service.state$("cipher-1"))).toBeNull();
  });

  it("invalidating an unread cipher does not read it", () => {
    service.invalidate("cipher-1");

    expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
  });
});
