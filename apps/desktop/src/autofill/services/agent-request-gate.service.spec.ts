import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, ToastService } from "@bitwarden/components";

import { AgentGateRequest, AgentRequestGate } from "./agent-request-gate.service";

const account = (id: string) => ({ id: id as UserId }) as Account;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("AgentRequestGate", () => {
  let gate: AgentRequestGate;
  let status$: BehaviorSubject<AuthenticationStatus>;
  let account$: BehaviorSubject<Account | null>;
  let toastService: MockProxy<ToastService>;
  let focusWindow: jest.Mock;

  function request(overrides: Partial<AgentGateRequest<string>> = {}) {
    return {
      label: "test request",
      enabled: of(true),
      deadline: Date.now() + 1000,
      unlock: { requiredMessage: "unlockRequired", timeoutMessage: "unlockTimeout" },
      refused: "refused",
      handle: jest.fn().mockResolvedValue("handled"),
      respond: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as AgentGateRequest<string> & { handle: jest.Mock; respond: jest.Mock };
  }

  beforeEach(() => {
    status$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    account$ = new BehaviorSubject<Account | null>(account("user-1"));
    toastService = mock<ToastService>();
    focusWindow = jest.fn();
    (global as any).ipc = { platform: { focusWindow } };

    const authService = mock<AuthService>();
    authService.activeAccountStatus$ = status$;
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = account$;
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    gate = new AgentRequestGate(
      authService,
      accountService,
      toastService,
      i18nService,
      mock<LogService>(),
    );
  });

  afterEach(() => {
    gate.ngOnDestroy();
    jest.useRealTimers();
  });

  it("refuses a disabled request without touching the vault", async () => {
    status$.next(AuthenticationStatus.Locked);
    const req = request({ enabled: of(false) });

    await gate.run(req);

    expect(req.handle).not.toHaveBeenCalled();
    expect(focusWindow).not.toHaveBeenCalled();
    expect(req.respond.mock.calls).toEqual([["refused"]]);
  });

  it("waits for settings to load rather than dropping an early request", async () => {
    const enabled$ = new Subject<boolean>();
    const req = request({ enabled: enabled$ });

    const run = gate.run(req);
    await Promise.resolve();
    expect(req.respond).not.toHaveBeenCalled();

    enabled$.next(true);
    await run;
    expect(req.respond.mock.calls).toEqual([["handled"]]);
  });

  it("handles and responds once when unlocked", async () => {
    const req = request();

    await gate.run(req);

    expect(req.handle).toHaveBeenCalledWith("user-1");
    expect(req.respond.mock.calls).toEqual([["handled"]]);
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("when locked, focuses, prompts and proceeds after unlock", async () => {
    status$.next(AuthenticationStatus.Locked);
    const req = request();

    const run = gate.run(req);
    await Promise.resolve();
    expect(focusWindow).toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "info",
      message: "unlockRequired",
    });
    expect(req.handle).not.toHaveBeenCalled();

    status$.next(AuthenticationStatus.Unlocked);
    await run;
    expect(req.respond.mock.calls).toEqual([["handled"]]);
  });

  it("on unlock timeout, shows the timeout toast and answers locked", async () => {
    jest.useFakeTimers();
    status$.next(AuthenticationStatus.Locked);
    const req = request({ locked: "locked" });

    const run = gate.run(req);
    await jest.advanceTimersByTimeAsync(1000);
    await run;

    expect(toastService.showToast).toHaveBeenLastCalledWith({
      variant: "error",
      message: "unlockTimeout",
    });
    expect(req.handle).not.toHaveBeenCalled();
    expect(req.respond.mock.calls).toEqual([["locked"]]);
  });

  it("without a timeout message, times out silently and answers refused", async () => {
    jest.useFakeTimers();
    status$.next(AuthenticationStatus.Locked);
    const req = request({ unlock: { requiredMessage: "unlockRequired" } });

    const run = gate.run(req);
    await jest.advanceTimersByTimeAsync(1000);
    await run;

    expect(toastService.showToast).toHaveBeenCalledTimes(1);
    expect(req.respond.mock.calls).toEqual([["refused"]]);
  });

  it("answers every request waiting for unlock, not just the latest", async () => {
    status$.next(AuthenticationStatus.Locked);
    const first = request();
    const second = request();

    const runs = Promise.all([gate.run(first), gate.run(second)]);
    status$.next(AuthenticationStatus.Unlocked);
    await runs;

    expect(first.respond.mock.calls).toEqual([["handled"]]);
    expect(second.respond.mock.calls).toEqual([["handled"]]);
  });

  it("serializes exclusive handles; non-exclusive ones skip the queue", async () => {
    const pending = deferred<string>();
    const first = request({ handle: jest.fn().mockReturnValue(pending.promise) });
    const queued = request();
    const concurrent = request({ exclusive: false });

    const runs = Promise.all([gate.run(first), gate.run(queued), gate.run(concurrent)]);
    await new Promise((r) => setTimeout(r));
    expect(queued.handle).not.toHaveBeenCalled();
    expect(concurrent.respond.mock.calls).toEqual([["handled"]]);

    pending.resolve("handled");
    await runs;
    expect(queued.respond.mock.calls).toEqual([["handled"]]);
  });

  it("answers expired without handling a request queued past its deadline", async () => {
    jest.useFakeTimers();
    const pending = deferred<string>();
    const first = request({ handle: jest.fn().mockReturnValue(pending.promise) });
    const queued = request({ expired: "expired" });

    const runs = Promise.all([gate.run(first), gate.run(queued)]);
    await jest.advanceTimersByTimeAsync(1000);
    pending.resolve("handled");
    await runs;

    expect(queued.handle).not.toHaveBeenCalled();
    expect(queued.respond.mock.calls).toEqual([["expired"]]);
  });

  it("ignores a re-sent request while the first is in flight", async () => {
    const pending = deferred<string>();
    const first = request({ requestId: 1, handle: jest.fn().mockReturnValue(pending.promise) });
    const resent = request({ requestId: 1 });

    const runs = Promise.all([gate.run(first), gate.run(resent)]);
    pending.resolve("handled");
    await runs;
    expect(resent.handle).not.toHaveBeenCalled();
    expect(resent.respond).not.toHaveBeenCalled();
    expect(first.respond.mock.calls).toEqual([["handled"]]);

    const later = request({ requestId: 1 });
    await gate.run(later);
    expect(later.respond.mock.calls).toEqual([["handled"]]);
  });

  it("refuses once when handle throws", async () => {
    const req = request({ handle: jest.fn().mockRejectedValue(new Error("boom")) });

    await gate.run(req);

    expect(req.respond.mock.calls).toEqual([["refused"]]);
  });

  it("refuses when the account is gone after unlock", async () => {
    status$.next(AuthenticationStatus.Locked);
    const req = request();

    const run = gate.run(req);
    account$.next(null);
    status$.next(AuthenticationStatus.Unlocked);
    await run;

    expect(req.handle).not.toHaveBeenCalled();
    expect(req.respond.mock.calls).toEqual([["refused"]]);
  });

  it("does not rethrow respond errors", async () => {
    const req = request({ respond: jest.fn().mockRejectedValue(new Error("ipc gone")) });

    await expect(gate.run(req)).resolves.toBeUndefined();
  });

  it("forgets remembered keys on lock, account switch and destroy", () => {
    gate.remembered.add("k");
    status$.next(AuthenticationStatus.Locked);
    expect(gate.remembered.has("k")).toBe(false);

    gate.remembered.add("k");
    account$.next(account("user-1"));
    expect(gate.remembered.has("k")).toBe(true);
    account$.next(account("user-2"));
    expect(gate.remembered.has("k")).toBe(false);

    gate.remembered.add("k");
    gate.ngOnDestroy();
    expect(gate.remembered.has("k")).toBe(false);
  });

  it("confirm focuses the window and resolves the dialog result", async () => {
    const dialogRef = { closed: of(true) } as unknown as DialogRef<boolean>;

    await expect(gate.confirm(() => dialogRef)).resolves.toBe(true);
    expect(focusWindow).toHaveBeenCalled();
  });

  it("confirm closes the dialog at the deadline and resolves undefined", async () => {
    jest.useFakeTimers();
    const close = jest.fn();
    const dialogRef = { closed: new Subject<boolean>(), close } as unknown as DialogRef<boolean>;

    const result = gate.confirm(() => dialogRef, Date.now() + 5000);
    jest.advanceTimersByTime(4999);
    expect(close).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await expect(result).resolves.toBeUndefined();
    expect(close).toHaveBeenCalled();
  });
});
