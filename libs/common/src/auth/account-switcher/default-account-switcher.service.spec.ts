import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, map } from "rxjs";

import { mockAccountInfoWith } from "../../../spec/fake-account-service";
import { Environment, EnvironmentService } from "../../platform/abstractions/environment.service";
import { UserId } from "../../types/guid";
import { Account, AccountInfo, AccountService } from "../abstractions/account.service";
import { AuthService } from "../abstractions/auth.service";
import { AvatarService } from "../abstractions/avatar.service";
import { AuthenticationStatus } from "../enums/authentication-status";

import { DefaultAccountSwitcherService } from "./default-account-switcher.service";

describe("DefaultAccountSwitcherService", () => {
  const userA = "00000000-0000-0000-0000-00000000000a" as UserId;
  const userB = "00000000-0000-0000-0000-00000000000b" as UserId;
  const userC = "00000000-0000-0000-0000-00000000000c" as UserId;

  let accounts$: BehaviorSubject<Record<UserId, AccountInfo>>;
  let activeAccount$: BehaviorSubject<Account | null>;
  let sortedUserIds$: BehaviorSubject<UserId[]>;
  let authStatuses$: BehaviorSubject<Record<UserId, AuthenticationStatus>>;
  let avatarColors: Record<UserId, BehaviorSubject<string | null>>;
  let environments: Record<UserId, BehaviorSubject<Environment>>;

  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let avatarService: MockProxy<AvatarService>;
  let environmentService: MockProxy<EnvironmentService>;
  let sut: DefaultAccountSwitcherService;

  const environmentWithHost = (hostname: string) =>
    ({ getHostname: () => hostname }) as Environment;

  const infoFor = (userId: UserId) =>
    mockAccountInfoWith({ name: `name-${userId}`, email: `${userId}@example.com` });

  /** Sets up accounts A, B, and C with the given statuses. A is active; A, B, C is most recent first. */
  const setup = (statuses: Record<UserId, AuthenticationStatus>, active: UserId | null = userA) => {
    accounts$.next({ [userA]: infoFor(userA), [userB]: infoFor(userB), [userC]: infoFor(userC) });
    activeAccount$.next(active == null ? null : { id: active, ...infoFor(active) });
    sortedUserIds$.next([userA, userB, userC]);
    authStatuses$.next(statuses);
  };

  beforeEach(() => {
    accounts$ = new BehaviorSubject<Record<UserId, AccountInfo>>({});
    activeAccount$ = new BehaviorSubject<Account | null>(null);
    sortedUserIds$ = new BehaviorSubject<UserId[]>([]);
    authStatuses$ = new BehaviorSubject<Record<UserId, AuthenticationStatus>>({});
    avatarColors = {
      [userA]: new BehaviorSubject<string | null>("#aaaaaa"),
      [userB]: new BehaviorSubject<string | null>("#bbbbbb"),
      [userC]: new BehaviorSubject<string | null>(null),
    };
    environments = {
      [userA]: new BehaviorSubject(environmentWithHost(`server-${userA}`)),
      [userB]: new BehaviorSubject(environmentWithHost(`server-${userB}`)),
      [userC]: new BehaviorSubject(environmentWithHost(`server-${userC}`)),
    };

    accountService = mock<AccountService>();
    accountService.accounts$ = accounts$;
    accountService.activeAccount$ = activeAccount$;
    accountService.sortedUserIds$ = sortedUserIds$;

    authService = mock<AuthService>();
    authService.authStatuses$ = authStatuses$;
    authService.authStatusFor$.mockImplementation((userId) =>
      authStatuses$.pipe(map((statuses) => statuses[userId] ?? AuthenticationStatus.LoggedOut)),
    );

    avatarService = mock<AvatarService>();
    avatarService.getUserAvatarColor$.mockImplementation((userId) => avatarColors[userId]);

    environmentService = mock<EnvironmentService>();
    environmentService.getEnvironment$.mockImplementation((userId) => environments[userId]);

    sut = new DefaultAccountSwitcherService(
      accountService,
      authService,
      avatarService,
      environmentService,
    );
  });

  describe("entries$", () => {
    it("includes the active account and excludes logged-out accounts", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.Locked,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(result.map((e) => [e.id, e.isActive])).toEqual([
        [userA, true],
        [userC, false],
      ]);
    });

    it("orders entries by most recent activity", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Unlocked,
      });
      sortedUserIds$.next([userC, userA, userB]);

      const result = await firstValueFrom(sut.entries$);

      expect(result.map((e) => e.id)).toEqual([userC, userA, userB]);
    });

    it("excludes accounts with no recorded activity", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Locked,
      });
      sortedUserIds$.next([userA, userC]);

      const result = await firstValueFrom(sut.entries$);

      expect(result.map((e) => e.id)).toEqual([userA, userC]);
    });

    it("excludes activity entries with no matching account", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Locked,
      });
      accounts$.next({ [userA]: infoFor(userA), [userC]: infoFor(userC) });

      const result = await firstValueFrom(sut.entries$);

      expect(result.map((e) => e.id)).toEqual([userA, userC]);
    });

    it("builds each entry from account, status, avatar, and environment data", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(result).toEqual([
        {
          id: userA,
          name: `name-${userA}`,
          email: `${userA}@example.com`,
          status: AuthenticationStatus.Unlocked,
          avatarColor: "#aaaaaa",
          serverHostname: `server-${userA}`,
          isActive: true,
        },
        {
          id: userB,
          name: `name-${userB}`,
          email: `${userB}@example.com`,
          status: AuthenticationStatus.Locked,
          avatarColor: "#bbbbbb",
          serverHostname: `server-${userB}`,
          isActive: false,
        },
      ]);
    });

    it("emits again when an avatar color changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: (string | null)[] = [];
      const subscription = sut.entries$.subscribe((entries) =>
        emissions.push(entries.find((e) => e.id === userB)?.avatarColor ?? null),
      );

      avatarColors[userB].next("#123456");
      subscription.unsubscribe();

      expect(emissions).toEqual(["#bbbbbb", "#123456"]);
    });

    it("excludes the active account when it is logged out", async () => {
      setup({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(result.map((e) => [e.id, e.isActive])).toEqual([[userB, false]]);
    });

    it("excludes accounts with no known status", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userC]: AuthenticationStatus.Locked,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(result.map((e) => e.id)).toEqual([userA, userC]);
    });

    it("updates an entry when its status changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Locked,
      });
      const emissions: [string, AuthenticationStatus][][] = [];
      const subscription = sut.entries$.subscribe((entries) =>
        emissions.push(entries.map((e) => [e.id, e.status])),
      );

      authStatuses$.next({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Unlocked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      subscription.unsubscribe();

      expect(emissions.at(-1)).toEqual([
        [userA, AuthenticationStatus.Unlocked],
        [userB, AuthenticationStatus.Unlocked],
      ]);
    });

    it("moves the active flag when the active account changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Unlocked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: [string, boolean][][] = [];
      const subscription = sut.entries$.subscribe((entries) =>
        emissions.push(entries.map((e) => [e.id, e.isActive])),
      );

      activeAccount$.next({ id: userB, ...infoFor(userB) });
      subscription.unsubscribe();

      expect(emissions.at(-1)).toEqual([
        [userA, false],
        [userB, true],
      ]);
    });

    it("emits again when a server hostname changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: (string | undefined)[] = [];
      const subscription = sut.entries$.subscribe((entries) =>
        emissions.push(entries.find((e) => e.id === userB)?.serverHostname),
      );

      environments[userB].next(environmentWithHost("self-hosted.example.com"));
      subscription.unsubscribe();

      expect(emissions).toEqual([`server-${userB}`, "self-hosted.example.com"]);
    });

    it("emits an empty list when every account is logged out", async () => {
      setup({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(result).toEqual([]);
    });
  });

  describe("nextSwitchableAccount$", () => {
    it("skips the active account and a more recent logged-out account", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.Locked,
      });

      const result = await firstValueFrom(sut.nextSwitchableAccount$);

      expect(result).toEqual({ id: userC, ...infoFor(userC) });
    });

    it("considers every usable account when there is no active account", async () => {
      setup(
        {
          [userA]: AuthenticationStatus.Unlocked,
          [userB]: AuthenticationStatus.Locked,
          [userC]: AuthenticationStatus.Locked,
        },
        null,
      );

      const result = await firstValueFrom(sut.nextSwitchableAccount$);

      expect(result?.id).toBe(userA);
    });

    it("emits null when every other account is logged out", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await firstValueFrom(sut.nextSwitchableAccount$);

      expect(result).toBeNull();
    });
  });

  describe("resolveActiveAccount", () => {
    it("keeps the active account when there is none", async () => {
      setup({ [userB]: AuthenticationStatus.Locked }, null);

      const result = await sut.resolveActiveAccount();

      expect(result).toEqual({ action: "keep" });
    });

    it.each([AuthenticationStatus.Locked, AuthenticationStatus.Unlocked])(
      "keeps the active account when its status is %s",
      async (status) => {
        setup({
          [userA]: status,
          [userB]: AuthenticationStatus.Locked,
          [userC]: AuthenticationStatus.Locked,
        });

        const result = await sut.resolveActiveAccount();

        expect(result).toEqual({ action: "keep" });
      },
    );

    it("switches to the next switchable account when the active account is logged out", async () => {
      setup({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.Locked,
      });

      const result = await sut.resolveActiveAccount();

      expect(result).toEqual({ action: "switch", targetUserId: userC });
    });

    it("clears the active account when it is logged out and every other account is logged out", async () => {
      setup({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await sut.resolveActiveAccount();

      expect(result).toEqual({ action: "clear" });
    });

    it("does not read avatar or environment data", async () => {
      setup({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Locked,
      });

      await sut.resolveActiveAccount();

      expect(avatarService.getUserAvatarColor$).not.toHaveBeenCalled();
      expect(environmentService.getEnvironment$).not.toHaveBeenCalled();
    });
  });
});
