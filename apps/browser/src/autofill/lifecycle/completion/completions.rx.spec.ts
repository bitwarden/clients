import { Subject } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { AccountEventKind } from "../enums";
import type { FrameLost } from "../monitoring/types";
import type { AccountEvent } from "../types";

import { lifecycleCompletions } from "./completions.rx";
import { CompletionScopeKind } from "./enums";
import type { CompletionScope } from "./types";

const user = "user-1" as UserId;
const otherUser = "user-2" as UserId;

const login = (userId: UserId): AccountEvent => ({ kind: AccountEventKind.Login, userId });
const logout = (userId: UserId): AccountEvent => ({ kind: AccountEventKind.Logout, userId });
const lock = (userId: UserId): AccountEvent => ({ kind: AccountEventKind.Lock, userId });
const unlock = (userId: UserId): AccountEvent => ({ kind: AccountEventKind.Unlock, userId });
const switchTo = (to: UserId, from: UserId | null = null): AccountEvent => ({
  kind: AccountEventKind.Switch,
  from,
  to,
});
const bootstrapped: AccountEvent = { kind: AccountEventKind.Bootstrapped };

const everyone: CompletionScope = { kind: CompletionScopeKind.All };

describe("lifecycleCompletions", () => {
  let accountEvents$: Subject<AccountEvent>;
  let tabRemoved$: Subject<number>;
  let frameLost$: Subject<FrameLost>;
  let completions: CompletionScope[];

  beforeEach(() => {
    accountEvents$ = new Subject();
    tabRemoved$ = new Subject();
    frameLost$ = new Subject();
    completions = [];
    lifecycleCompletions({
      accountEvents$,
      tabRemoved$,
      frameLost$,
    }).subscribe((scope) => completions.push(scope));
  });

  /** The accounts' first observation: `user` signed in and active. */
  function observeAccounts() {
    accountEvents$.next(login(user));
    accountEvents$.next(switchTo(user));
    accountEvents$.next(bootstrapped);
  }

  describe("a tab", () => {
    it("completes its lifecycle when it is removed", () => {
      tabRemoved$.next(7);

      expect(completions).toEqual([{ kind: CompletionScopeKind.Tab, tabId: 7 }]);
    });
  });

  describe("a frame", () => {
    it("completes the lifecycle of its own frame when it is lost", () => {
      frameLost$.next({ tabId: 7, frameId: 3 });

      expect(completions).toEqual([{ kind: CompletionScopeKind.Frame, tabId: 7, frameId: 3 }]);
    });

    it("keeps the absence of a frame id when the frame without an id is lost", () => {
      frameLost$.next({ tabId: 7, frameId: undefined });

      expect(completions).toEqual([
        { kind: CompletionScopeKind.Frame, tabId: 7, frameId: undefined },
      ]);
    });
  });

  describe("the active account", () => {
    it("completes every lifecycle when it locks", () => {
      observeAccounts();

      accountEvents$.next(lock(user));

      expect(completions).toEqual([everyone]);
    });

    it("completes every lifecycle when it logs out", () => {
      observeAccounts();

      accountEvents$.next(logout(user));

      expect(completions).toEqual([everyone]);
    });

    it("completes every lifecycle when the active account changes", () => {
      observeAccounts();

      accountEvents$.next(login(otherUser));
      accountEvents$.next(switchTo(otherUser, user));

      expect(completions).toEqual([everyone]);
    });

    it("completes nothing when it unlocks", () => {
      observeAccounts();

      accountEvents$.next(unlock(user));

      expect(completions).toEqual([]);
    });

    it("completes nothing when another account signs in", () => {
      observeAccounts();

      accountEvents$.next(login(otherUser));

      expect(completions).toEqual([]);
    });

    it("completes nothing when an account that is not active locks or logs out", () => {
      observeAccounts();
      accountEvents$.next(login(otherUser));

      accountEvents$.next(lock(otherUser));
      accountEvents$.next(logout(otherUser));

      expect(completions).toEqual([]);
    });

    it("states each end of a session once, so a later event that ends nothing states nothing", () => {
      observeAccounts();

      accountEvents$.next(lock(user));
      accountEvents$.next(unlock(user));
      accountEvents$.next(login(otherUser));

      expect(completions).toEqual([everyone]);
    });

    it("states a second completion when the account locks a second time", () => {
      observeAccounts();

      accountEvents$.next(lock(user));
      accountEvents$.next(unlock(user));
      accountEvents$.next(lock(user));

      expect(completions).toEqual([everyone, everyone]);
    });

    it.each([
      ["locked", lock],
      ["signed out", logout],
    ])(
      "completes every lifecycle when the active account changes to an account that is %s",
      (_, end) => {
        observeAccounts();
        accountEvents$.next(login(otherUser));
        accountEvents$.next(end(otherUser));
        expect(completions).toEqual([]);

        accountEvents$.next(switchTo(otherUser, user));

        expect(completions).toEqual([everyone]);
      },
    );

    it("completes nothing when an account locks or logs out and no switch has said which is active", () => {
      accountEvents$.next(login(user));
      accountEvents$.next(bootstrapped);

      accountEvents$.next(lock(user));
      accountEvents$.next(logout(user));

      expect(completions).toEqual([]);
    });

    it("judges a lock by the account the last switch made active", () => {
      observeAccounts();
      accountEvents$.next(login(otherUser));
      accountEvents$.next(switchTo(otherUser, user));
      completions.length = 0;

      accountEvents$.next(lock(user));
      expect(completions).toEqual([]);

      accountEvents$.next(lock(otherUser));
      expect(completions).toEqual([everyone]);
    });
  });

  describe("the first observation of the accounts", () => {
    it("completes nothing, though it reports a switch", () => {
      observeAccounts();

      expect(completions).toEqual([]);
    });

    it("completes nothing when an account it reports is locked or signed out", () => {
      accountEvents$.next(login(user));
      accountEvents$.next(switchTo(user));
      accountEvents$.next(lock(user));
      accountEvents$.next(logout(user));
      accountEvents$.next(bootstrapped);

      expect(completions).toEqual([]);
    });
  });
});
