import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Observable, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import {
  FakeAccountService,
  makeStaticByteArray,
  mockAccountServiceWith,
  trackEmissions,
  mockAccountInfoWith,
} from "../../../spec";
import { ApiService } from "../../abstractions/api.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { TokenService } from "../abstractions/token.service";
import { AuthenticationStatus } from "../enums/authentication-status";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let sut: AuthService;

  let accountService: FakeAccountService;
  let messagingService: MockProxy<MessagingService>;
  let keyService: MockProxy<KeyService>;
  let apiService: MockProxy<ApiService>;
  let stateService: MockProxy<StateService>;
  let tokenService: MockProxy<TokenService>;

  const userId = Utils.newGuid() as UserId;
  const userKey = new SymmetricCryptoKey(makeStaticByteArray(32) as Uint8Array) as UserKey;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    messagingService = mock();
    keyService = mock();
    apiService = mock();
    stateService = mock();
    tokenService = mock();

    sut = new AuthService(
      accountService,
      messagingService,
      keyService,
      apiService,
      stateService,
      tokenService,
    );
  });

  describe("activeAccountStatus$", () => {
    const accountInfo = {
      status: AuthenticationStatus.Unlocked,
      id: userId,
      ...mockAccountInfoWith({
        email: "email",
        name: "name",
      }),
    };

    beforeEach(() => {
      accountService.activeAccountSubject.next(accountInfo);
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));
    });

    it("emits LoggedOut when there is no active account", async () => {
      accountService.activeAccountSubject.next(undefined);

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits LoggedOut when there is no access token", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits LoggedOut when there is no access token but has a user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits Locked when there is an access token and no user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(AuthenticationStatus.Locked);
    });

    it("emits Unlocked when there is an access token and user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(AuthenticationStatus.Unlocked);
    });

    it("follows the current active user", async () => {
      const accountInfo2 = {
        status: AuthenticationStatus.Unlocked,
        id: Utils.newGuid() as UserId,
        ...mockAccountInfoWith({
          email: "email2",
          name: "name2",
        }),
      };

      const emissions = trackEmissions(sut.activeAccountStatus$);

      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));
      accountService.activeAccountSubject.next(accountInfo2);

      expect(emissions).toEqual([AuthenticationStatus.Locked, AuthenticationStatus.Unlocked]);
    });
  });

  describe("authStatuses$", () => {
    it("requests auth status for all known users", async () => {
      const userId2 = Utils.newGuid() as UserId;

      await accountService.addAccount(
        userId2,
        mockAccountInfoWith({
          email: "email2",
          name: "name2",
        }),
      );

      const mockFn = jest.fn().mockReturnValue(of(AuthenticationStatus.Locked));
      sut.authStatusFor$ = mockFn;

      await expect(firstValueFrom(await sut.authStatuses$)).resolves.toEqual({
        [userId]: AuthenticationStatus.Locked,
        [userId2]: AuthenticationStatus.Locked,
      });
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith(userId);
      expect(mockFn).toHaveBeenCalledWith(userId2);
    });
  });

  describe("authStatusFor$", () => {
    beforeEach(() => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));
    });

    it.each([null, undefined, "not a userId"])(
      "emits LoggedOut when userId is invalid (%s)",
      async () => {
        expect(await firstValueFrom(sut.authStatusFor$(null))).toEqual(
          AuthenticationStatus.LoggedOut,
        );
      },
    );

    it("emits LoggedOut when there is no access token", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits Locked when there is an access token and no user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(AuthenticationStatus.Locked);
    });

    it("emits Unlocked when there is an access token and user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.Unlocked,
      );
    });
  });

  // Regression: https://github.com/bitwarden/clients/issues/20548
  // authStatusFor$ used to be a method that built a fresh
  // shareReplay({ refCount: false }) on every call. Because that ReplaySubject never
  // unsubscribes from the long-lived state subjects, every getAuthStatus() /
  // authStatusFor$() call (e.g. every `bw serve` /status request) leaked an observer
  // graph. It is now memoized per userId via perUserCache$.
  describe("authStatusFor$ memoization (regression: #20548)", () => {
    beforeEach(() => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));
    });

    it("returns the same cached observable instance for repeated calls with the same userId", () => {
      expect(sut.authStatusFor$(userId)).toBe(sut.authStatusFor$(userId));
    });

    it("builds an independent, single-subscription stream per distinct userId", async () => {
      const userId2 = Utils.newGuid() as UserId;
      const subscriptionsPerUser: Record<string, number> = {};
      tokenService.hasAccessToken$.mockImplementation(
        (id: UserId) =>
          new Observable<boolean>((subscriber) => {
            subscriptionsPerUser[id] = (subscriptionsPerUser[id] ?? 0) + 1;
            subscriber.next(true);
          }),
      );

      // Distinct userIds get distinct cached observables (no cache-key collision).
      expect(sut.authStatusFor$(userId)).not.toBe(sut.authStatusFor$(userId2));

      for (let i = 0; i < 25; i++) {
        await firstValueFrom(sut.authStatusFor$(userId));
        await firstValueFrom(sut.authStatusFor$(userId2));
      }

      // Exactly one upstream subscription per distinct userId: memoization is keyed
      // per userId and there is no cross-contamination or per-call rebuild.
      expect(subscriptionsPerUser[userId]).toBe(1);
      expect(subscriptionsPerUser[userId2]).toBe(1);
    });

    it("caches the LoggedOut stream for an invalid userId (short-circuits inside the factory)", () => {
      // Utils.isGuid(null) is false, so the factory returns of(LoggedOut); perUserCache$
      // still memoizes by key, so repeated invalid lookups reuse one cached observable.
      // Documents intended behavior; the set of invalid keys is effectively {null, undefined}.
      expect(sut.authStatusFor$(null)).toBe(sut.authStatusFor$(null));
    });

    it("does not re-subscribe to upstream state on repeated reads (single shared subscription)", async () => {
      let totalSubscriptions = 0;
      let activeSubscriptions = 0;
      const hasAccessToken$ = new Observable<boolean>((subscriber) => {
        totalSubscriptions++;
        activeSubscriptions++;
        subscriber.next(true);
        return () => {
          activeSubscriptions--;
        };
      });
      tokenService.hasAccessToken$.mockReturnValue(hasAccessToken$);
      // getInMemoryUserKeyFor$ is of(userKey) (beforeEach), which completes immediately;
      // within combineLatest only hasAccessToken$ stays open, so the counters below track
      // that single long-lived upstream.

      for (let i = 0; i < 50; i++) {
        expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
          AuthenticationStatus.Unlocked,
        );
      }

      // perUserCache$ builds the stream once and shares it via
      // shareReplay({ refCount: false }), so exactly one upstream subscription exists
      // regardless of how many reads occur. The pre-fix method created a new shareReplay
      // per call, which would make both of these equal 50 (the leak).
      expect(totalSubscriptions).toBe(1);
      expect(activeSubscriptions).toBe(1);
    });

    // Mirrors the actual bw serve failure surface: GET /status -> StatusCommand ->
    // authService.getAuthStatus(userId) -> firstValueFrom(authStatusFor$(userId)). Pre-fix
    // code would produce 50 upstream subscriptions here (one per HTTP request); the fix
    // must hold when invoked through getAuthStatus(), not just authStatusFor$ directly.
    it("does not leak upstream subscriptions when invoked through getAuthStatus()", async () => {
      let totalSubscriptions = 0;
      const hasAccessToken$ = new Observable<boolean>((subscriber) => {
        totalSubscriptions++;
        subscriber.next(true);
      });
      tokenService.hasAccessToken$.mockReturnValue(hasAccessToken$);

      for (let i = 0; i < 50; i++) {
        await sut.getAuthStatus(userId);
      }

      expect(totalSubscriptions).toBe(1);
    });

    // activeAccountStatus$ is built once in the constructor but switchMap-rebinds to
    // authStatusFor$(userId) every time the active account changes. Pre-fix code
    // produced a brand-new shareReplay pipeline per (re)bind, so switching back to a
    // previously-seen user added another permanent upstream subscription. With
    // memoization, each distinct userId has exactly one cached stream regardless of how
    // many times the active user switches.
    it("does not multiply upstream subscriptions when activeAccount switches back and forth", async () => {
      const userId2 = Utils.newGuid() as UserId;
      const accountInfo1 = {
        status: AuthenticationStatus.Unlocked,
        id: userId,
        ...mockAccountInfoWith({ email: "email", name: "name" }),
      };
      const accountInfo2 = {
        status: AuthenticationStatus.Unlocked,
        id: userId2,
        ...mockAccountInfoWith({ email: "email2", name: "name2" }),
      };

      const subscriptionsPerUser: Record<string, number> = {};
      tokenService.hasAccessToken$.mockImplementation(
        (id: UserId) =>
          new Observable<boolean>((subscriber) => {
            subscriptionsPerUser[id] = (subscriptionsPerUser[id] ?? 0) + 1;
            subscriber.next(true);
          }),
      );

      // Subscribe once; switchMap inside activeAccountStatus$ rebinds per emission.
      trackEmissions(sut.activeAccountStatus$);

      for (let i = 0; i < 10; i++) {
        accountService.activeAccountSubject.next(accountInfo1);
        accountService.activeAccountSubject.next(accountInfo2);
      }

      expect(subscriptionsPerUser[userId]).toBe(1);
      expect(subscriptionsPerUser[userId2]).toBe(1);
    });

    // Behavior-preservation check (the two leak guards above are what catch the regression):
    // confirms memoization did not break live lock/unlock/logout transitions.
    it("still reflects live auth status transitions through the cached stream", async () => {
      const hasAccessToken$ = new BehaviorSubject<boolean>(true);
      tokenService.hasAccessToken$.mockReturnValue(hasAccessToken$);
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.Unlocked,
      );

      hasAccessToken$.next(false);
      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.LoggedOut,
      );

      hasAccessToken$.next(true);
      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.Unlocked,
      );
    });
  });
});
