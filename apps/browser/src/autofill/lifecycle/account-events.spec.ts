import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import { reduceAccounts } from "./account-events";
import { AccountEventKind } from "./enums";

const { LoggedOut, Locked, Unlocked } = AuthenticationStatus;

const alice = "alice" as UserId;
const bob = "bob" as UserId;

describe("reduceAccounts", () => {
  describe("the first observation", () => {
    it("reports a login for each signed-in account, a switch to the active one, then bootstrapped", () => {
      const { events } = reduceAccounts(undefined, alice, { [alice]: Unlocked, [bob]: Locked });

      expect(events).toEqual([
        { kind: AccountEventKind.Login, userId: alice },
        { kind: AccountEventKind.Login, userId: bob },
        { kind: AccountEventKind.Switch, from: null, to: alice },
        { kind: AccountEventKind.Bootstrapped },
      ]);
    });

    it("reports only bootstrapped when nobody is signed in", () => {
      const { events, active } = reduceAccounts(undefined, null, {});

      expect(events).toEqual([{ kind: AccountEventKind.Bootstrapped }]);
      expect(active).toBeNull();
    });

    it("reports no login for an account that is logged out", () => {
      const { events } = reduceAccounts(undefined, null, { [alice]: LoggedOut });

      expect(events).toEqual([{ kind: AccountEventKind.Bootstrapped }]);
    });
  });

  describe("an observation after the first", () => {
    const before = reduceAccounts(undefined, alice, { [alice]: Unlocked });

    it("reports nothing when nothing changed", () => {
      const { events } = reduceAccounts(before, alice, { [alice]: Unlocked });

      expect(events).toEqual([]);
    });

    it("reports a lock, and then an unlock", () => {
      const locked = reduceAccounts(before, alice, { [alice]: Locked });
      const unlocked = reduceAccounts(locked, alice, { [alice]: Unlocked });

      expect(locked.events).toEqual([{ kind: AccountEventKind.Lock, userId: alice }]);
      expect(unlocked.events).toEqual([{ kind: AccountEventKind.Unlock, userId: alice }]);
    });

    it("reports a logout", () => {
      const { events } = reduceAccounts(before, alice, { [alice]: LoggedOut });

      expect(events).toEqual([{ kind: AccountEventKind.Logout, userId: alice }]);
    });

    it("reports a logout for an account that is no longer listed", () => {
      const { events } = reduceAccounts(before, alice, {});

      expect(events).toEqual([{ kind: AccountEventKind.Logout, userId: alice }]);
    });

    it("reports a login for an account that signs in", () => {
      const { events } = reduceAccounts(before, alice, { [alice]: Unlocked, [bob]: Locked });

      expect(events).toEqual([{ kind: AccountEventKind.Login, userId: bob }]);
    });

    it("reports a switch to another signed-in account", () => {
      const both = reduceAccounts(before, alice, { [alice]: Unlocked, [bob]: Unlocked });

      const { events } = reduceAccounts(both, bob, { [alice]: Unlocked, [bob]: Unlocked });

      expect(events).toEqual([{ kind: AccountEventKind.Switch, from: alice, to: bob }]);
    });

    it("reports a login, then the switch to it, then other changes", () => {
      const { events } = reduceAccounts(before, bob, { [alice]: Locked, [bob]: Unlocked });

      expect(events).toEqual([
        { kind: AccountEventKind.Login, userId: bob },
        { kind: AccountEventKind.Switch, from: alice, to: bob },
        { kind: AccountEventKind.Lock, userId: alice },
      ]);
    });

    it("waits for the login of an active account that is signed out", () => {
      const waiting = reduceAccounts(before, bob, { [alice]: Unlocked, [bob]: LoggedOut });
      const loggedIn = reduceAccounts(waiting, bob, { [alice]: Unlocked, [bob]: Unlocked });

      expect(waiting.events).toEqual([]);
      expect(waiting.active).toBe(alice);
      expect(loggedIn.events).toEqual([
        { kind: AccountEventKind.Login, userId: bob },
        { kind: AccountEventKind.Switch, from: alice, to: bob },
      ]);
    });

    it("reports nothing, and keeps the active account, when no account is active", () => {
      const { events, active } = reduceAccounts(before, null, { [alice]: Unlocked });

      expect(events).toEqual([]);
      expect(active).toBe(alice);
    });

    it("does not report bootstrapped again", () => {
      const { events } = reduceAccounts(before, alice, { [alice]: Locked });

      expect(events).not.toContainEqual({ kind: AccountEventKind.Bootstrapped });
    });

    it("carries the statuses it was given", () => {
      const statuses = { [alice]: Locked };

      expect(reduceAccounts(before, alice, statuses).statuses).toBe(statuses);
    });
  });
});
