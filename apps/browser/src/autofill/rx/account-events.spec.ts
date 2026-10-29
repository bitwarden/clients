import { TestScheduler } from "rxjs/testing";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import { AccountEvent, accountEvents$, AccountEventKind } from "./account-events";

const A = "user-a" as UserId;
const B = "user-b" as UserId;
const { LoggedOut, Locked, Unlocked } = AuthenticationStatus;

const accounts: Record<string, Account | null> = {
  a: { id: A } as Account,
  b: { id: B } as Account,
  n: null,
};

// a legend for the expected events
const events: Record<string, AccountEvent> = {
  i: { kind: AccountEventKind.Login, userId: A },
  j: { kind: AccountEventKind.Login, userId: B },
  u: { kind: AccountEventKind.Unlock, userId: A },
  l: { kind: AccountEventKind.Lock, userId: A },
  m: { kind: AccountEventKind.Lock, userId: B },
  o: { kind: AccountEventKind.Logout, userId: A },
  p: { kind: AccountEventKind.Logout, userId: B },
  s: { kind: AccountEventKind.Switch, from: null, to: A },
  t: { kind: AccountEventKind.Switch, from: A, to: B },
  b: { kind: AccountEventKind.Bootstrapped },
};

describe("accountEvents$", () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it.each([
    ["unlocked", Unlocked],
    ["locked", Locked],
  ])(
    "starts from an active %s account as a login, a switch, then bootstrapped",
    (_name, status) => {
      scheduler.run(({ cold, expectObservable }) => {
        const event$ = accountEvents$(cold("a", accounts), cold("s", { s: { [A]: status } }));

        expectObservable(event$).toBe("(isb)", events);
      });
    },
  );

  it("starts from no active account as bootstrapped alone", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(cold("n", accounts), cold("s", { s: {} }));

      expectObservable(event$).toBe("b", events);
    });
  });

  it("reports every signed-in account at the start, before the switch", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(
        cold("a", accounts),
        cold("s", { s: { [A]: Unlocked, [B]: Locked } }),
      );

      expectObservable(event$).toBe("(ijsb)", events);
    });
  });

  it("reports lock, unlock and logout", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(
        cold("a", accounts),
        cold("x 9ms y 9ms x 9ms z", {
          x: { [A]: Unlocked },
          y: { [A]: Locked },
          z: { [A]: LoggedOut },
        }),
      );

      expectObservable(event$).toBe("(isb) 5ms l 9ms u 9ms o", events);
    });
  });

  it("reports changes to accounts that are not active", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(
        cold("a", accounts),
        cold("x 9ms y", {
          x: { [A]: Unlocked, [B]: Unlocked },
          y: { [A]: Unlocked, [B]: Locked },
        }),
      );

      expectObservable(event$).toBe("(ijsb) 4ms m", events);
    });
  });

  it("switches to a signed-in account", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(
        cold("a 9ms b", accounts),
        cold("x", { x: { [A]: Unlocked, [B]: Locked } }),
      );

      expectObservable(event$).toBe("(ijsb) 4ms t", events);
    });
  });

  it("holds a switch to a signed-out account until it logs in, then logs in and switches", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(
        cold("a 9ms b", accounts),
        cold("x 19ms y", { x: { [A]: Unlocked }, y: { [A]: Unlocked, [B]: Unlocked } }),
      );

      expectObservable(event$).toBe("(isb) 15ms (jt)", events);
    });
  });

  it("does not switch to no account", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // both sources change at frame 10; the logout comes from the statuses alone
      const event$ = accountEvents$(
        cold("a 9ms n", accounts),
        cold("x 9ms y", { x: { [A]: Unlocked }, y: { [A]: LoggedOut } }),
      );

      expectObservable(event$).toBe("(isb) 5ms o", events);
    });
  });

  it("reports an active account signing out before another becomes active as logout, then switch", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // the statuses update first, then the active account
      const event$ = accountEvents$(
        cold("a 19ms b", accounts),
        cold("x 9ms y", {
          x: { [A]: Unlocked, [B]: Unlocked },
          y: { [A]: LoggedOut, [B]: Unlocked },
        }),
      );

      expectObservable(event$).toBe("(ijsb) 4ms o 9ms t", events);
    });
  });

  it("logs in again without a switch when the active account signs back in", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(
        cold("a", accounts),
        cold("x 9ms y 9ms x", { x: { [A]: Unlocked }, y: { [A]: LoggedOut } }),
      );

      expectObservable(event$).toBe("(isb) 5ms o 9ms i", events);
    });
  });

  it("reports another account becoming active before the active one signs out as switch, then logout", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // the active account updates first, then the statuses
      const event$ = accountEvents$(
        cold("a 9ms b", accounts),
        cold("x 19ms y", {
          x: { [A]: Unlocked, [B]: Unlocked },
          y: { [A]: LoggedOut, [B]: Unlocked },
        }),
      );

      expectObservable(event$).toBe("(ijsb) 4ms t 9ms o", events);
    });
  });

  it("orders one observation as logins, then the switch, then the other changes", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // the switch to B is held until B's login, which arrives with A's lock
      const event$ = accountEvents$(
        cold("a 9ms b", accounts),
        cold("x 19ms y", { x: { [A]: Unlocked }, y: { [A]: Locked, [B]: Unlocked } }),
      );

      expectObservable(event$).toBe("(isb) 15ms (jtl)", events);
    });
  });

  it("holds the first switch until a signed-out active account logs in", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(
        cold("a", accounts),
        cold("x 9ms y", { x: {}, y: { [A]: Unlocked } }),
      );

      expectObservable(event$).toBe("b 9ms (is)", events);
    });
  });

  it("reports an account that is not active logging in and out", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const event$ = accountEvents$(
        cold("a", accounts),
        cold("x 9ms y 9ms x", { x: { [A]: Unlocked }, y: { [A]: Unlocked, [B]: Unlocked } }),
      );

      expectObservable(event$).toBe("(isb) 5ms j 9ms p", events);
    });
  });
});
