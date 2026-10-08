import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, map, of } from "rxjs";

import { mockAccountInfoWith } from "../../../spec/fake-account-service";
import { Environment, EnvironmentService } from "../../platform/abstractions/environment.service";
import { UserId } from "../../types/guid";
import { Account, AccountInfo, AccountService } from "../abstractions/account.service";
import { AuthService } from "../abstractions/auth.service";
import { AvatarService } from "../abstractions/avatar.service";
import { AuthenticationStatus } from "../enums/authentication-status";

import { AccountSwitcherEntries } from "./account-switcher-entries.type";
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

  /** Reduces entries to their user IDs for compact assertions. */
  const idsOf = (entries: AccountSwitcherEntries) => ({
    active: entries.active?.id ?? null,
    inactive: entries.inactive.map((entry) => entry.id),
  });

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
    avatarService.getUserAvatarColor$.mockImplementation(
      (userId) => avatarColors[userId] ?? of(null),
    );

    environmentService = mock<EnvironmentService>();
    environmentService.getEnvironment$.mockImplementation(
      (userId) => environments[userId] ?? of(environmentWithHost(`server-${userId}`)),
    );

    sut = new DefaultAccountSwitcherService(
      accountService,
      authService,
      avatarService,
      environmentService,
    );
  });

  describe("entries$", () => {
    it("splits the active account from the others and excludes logged-out accounts", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.Locked,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(idsOf(result)).toEqual({ active: userA, inactive: [userC] });
    });

    it("orders the inactive accounts by most recent activity", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Unlocked,
      });
      sortedUserIds$.next([userC, userA, userB]);

      const result = await firstValueFrom(sut.entries$);

      expect(idsOf(result)).toEqual({ active: userA, inactive: [userC, userB] });
    });

    it("excludes accounts with no recorded activity", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Locked,
      });
      sortedUserIds$.next([userA, userC]);

      const result = await firstValueFrom(sut.entries$);

      expect(idsOf(result)).toEqual({ active: userA, inactive: [userC] });
    });

    it("excludes activity entries with no matching account", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Locked,
      });
      accounts$.next({ [userA]: infoFor(userA), [userC]: infoFor(userC) });

      const result = await firstValueFrom(sut.entries$);

      expect(idsOf(result)).toEqual({ active: userA, inactive: [userC] });
    });

    it("excludes accounts with no known status", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userC]: AuthenticationStatus.Locked,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(idsOf(result)).toEqual({ active: userA, inactive: [userC] });
    });

    it("has no active entry when the active account is logged out", async () => {
      setup({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(idsOf(result)).toEqual({ active: null, inactive: [userB] });
    });

    it("has no active entry when there is no active account", async () => {
      setup(
        {
          [userA]: AuthenticationStatus.Unlocked,
          [userB]: AuthenticationStatus.Locked,
          [userC]: AuthenticationStatus.LoggedOut,
        },
        null,
      );

      const result = await firstValueFrom(sut.entries$);

      expect(idsOf(result)).toEqual({ active: null, inactive: [userA, userB] });
    });

    it("builds each entry from account, status, avatar, and environment data", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(result).toEqual({
        active: {
          id: userA,
          name: `name-${userA}`,
          email: `${userA}@example.com`,
          status: AuthenticationStatus.Unlocked,
          avatarColor: "#aaaaaa",
          serverHostname: `server-${userA}`,
        },
        inactive: [
          {
            id: userB,
            name: `name-${userB}`,
            email: `${userB}@example.com`,
            status: AuthenticationStatus.Locked,
            avatarColor: "#bbbbbb",
            serverHostname: `server-${userB}`,
          },
        ],
        canAddAccount: true,
      });
    });

    it("updates an entry when its status changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.Locked,
      });
      const emissions: AccountSwitcherEntries[] = [];
      const subscription = sut.entries$.subscribe((entries) => emissions.push(entries));

      authStatuses$.next({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Unlocked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      subscription.unsubscribe();

      const latest = emissions.at(-1)!;
      expect(idsOf(latest)).toEqual({ active: userA, inactive: [userB] });
      expect(latest.inactive[0].status).toBe(AuthenticationStatus.Unlocked);
    });

    it("moves an account to active when the active account changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Unlocked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: AccountSwitcherEntries[] = [];
      const subscription = sut.entries$.subscribe((entries) => emissions.push(entries));

      activeAccount$.next({ id: userB, ...infoFor(userB) });
      subscription.unsubscribe();

      expect(idsOf(emissions.at(-1)!)).toEqual({ active: userB, inactive: [userA] });
    });

    it("never shows an account as both active and inactive, or as neither, during a switch", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Unlocked,
        [userC]: AuthenticationStatus.Locked,
      });
      const emissions: AccountSwitcherEntries[] = [];
      const subscription = sut.entries$.subscribe((entries) => emissions.push(entries));

      activeAccount$.next({ id: userB, ...infoFor(userB) });
      activeAccount$.next({ id: userC, ...infoFor(userC) });
      subscription.unsubscribe();

      for (const entries of emissions) {
        const ids = [entries.active?.id, ...entries.inactive.map((entry) => entry.id)];
        expect(ids.sort()).toEqual([userA, userB, userC].sort());
      }
      expect(idsOf(emissions.at(-1)!)).toEqual({ active: userC, inactive: [userA, userB] });
    });

    it("emits again when an avatar color changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: (string | null)[] = [];
      const subscription = sut.entries$.subscribe((entries) =>
        emissions.push(entries.inactive[0]?.avatarColor ?? null),
      );

      avatarColors[userB].next("#123456");
      subscription.unsubscribe();

      expect(emissions).toEqual(["#bbbbbb", "#123456"]);
    });

    it("emits again when a server hostname changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: (string | undefined)[] = [];
      const subscription = sut.entries$.subscribe((entries) =>
        emissions.push(entries.inactive[0]?.serverHostname),
      );

      environments[userB].next(environmentWithHost("self-hosted.example.com"));
      subscription.unsubscribe();

      expect(emissions).toEqual([`server-${userB}`, "self-hosted.example.com"]);
    });

    it("emits no entries when every account is logged out", async () => {
      setup({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(result).toEqual({ active: null, inactive: [], canAddAccount: true });
    });

    it("emits the active entry alone when every other account is logged out", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.LoggedOut,
      });

      const result = await firstValueFrom(sut.entries$);

      expect(idsOf(result)).toEqual({ active: userA, inactive: [] });
      expect(result.canAddAccount).toBe(true);
    });

    it("emits again when the active account's avatar color changes", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: (string | null)[] = [];
      const subscription = sut.entries$.subscribe((entries) =>
        emissions.push(entries.active?.avatarColor ?? null),
      );

      avatarColors[userA].next("#654321");
      subscription.unsubscribe();

      expect(emissions).toEqual(["#aaaaaa", "#654321"]);
    });

    it("keeps emitting after every account logs out and an account becomes usable again", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: AccountSwitcherEntries[] = [];
      const subscription = sut.entries$.subscribe((entries) => emissions.push(entries));

      authStatuses$.next({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      authStatuses$.next({
        [userA]: AuthenticationStatus.LoggedOut,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      subscription.unsubscribe();

      expect(emissions.map(idsOf)).toEqual([
        { active: userA, inactive: [] },
        { active: null, inactive: [] },
        { active: null, inactive: [userB] },
      ]);
    });

    it("passes through a missing avatar color and a missing environment", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.Locked,
      });
      environments[userC].next(null as unknown as Environment);

      const result = await firstValueFrom(sut.entries$);

      expect(result.inactive).toEqual([
        expect.objectContaining({ id: userC, avatarColor: null, serverHostname: undefined }),
      ]);
    });

    it("stops emitting for avatar or environment changes of an account that logs out", async () => {
      setup({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.Locked,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissions: AccountSwitcherEntries[] = [];
      const subscription = sut.entries$.subscribe((entries) => emissions.push(entries));

      authStatuses$.next({
        [userA]: AuthenticationStatus.Unlocked,
        [userB]: AuthenticationStatus.LoggedOut,
        [userC]: AuthenticationStatus.LoggedOut,
      });
      const emissionCountAfterLogout = emissions.length;
      avatarColors[userB].next("#123456");
      environments[userB].next(environmentWithHost("self-hosted.example.com"));
      subscription.unsubscribe();

      expect(emissions).toHaveLength(emissionCountAfterLogout);
      expect(idsOf(emissions.at(-1)!)).toEqual({ active: userA, inactive: [] });
    });
  });

  describe("account limit", () => {
    const userD = "00000000-0000-0000-0000-00000000000d" as UserId;
    const userE = "00000000-0000-0000-0000-00000000000e" as UserId;
    const allUsers = [userA, userB, userC, userD, userE];

    const allWithStatus = (status: AuthenticationStatus) =>
      Object.fromEntries(allUsers.map((id) => [id, status])) as Record<
        UserId,
        AuthenticationStatus
      >;

    /** Sets up five accounts with the given statuses. A is active. */
    const setupFive = (statuses: Record<UserId, AuthenticationStatus>) => {
      accounts$.next(Object.fromEntries(allUsers.map((id) => [id, infoFor(id)])));
      activeAccount$.next({ id: userA, ...infoFor(userA) });
      sortedUserIds$.next(allUsers);
      authStatuses$.next(statuses);
    };

    const fourOfFive = {
      ...allWithStatus(AuthenticationStatus.Locked),
      [userE]: AuthenticationStatus.LoggedOut,
    };

    it("does not allow another account when five accounts are not logged out", async () => {
      setupFive(allWithStatus(AuthenticationStatus.Locked));

      expect(await firstValueFrom(sut.canAddAccount$)).toBe(false);
      expect((await firstValueFrom(sut.entries$)).canAddAccount).toBe(false);
    });

    it("allows another account when four accounts are not logged out", async () => {
      setupFive(fourOfFive);

      expect(await firstValueFrom(sut.canAddAccount$)).toBe(true);
      expect((await firstValueFrom(sut.entries$)).canAddAccount).toBe(true);
    });

    it("allows another account again after an account logs out", async () => {
      setupFive(allWithStatus(AuthenticationStatus.Locked));
      const emissions: boolean[] = [];
      const subscription = sut.canAddAccount$.subscribe((canAdd) => emissions.push(canAdd));

      authStatuses$.next(fourOfFive);
      subscription.unsubscribe();

      expect(emissions).toEqual([false, true]);
    });

    it("does not read avatar or environment data for canAddAccount$", async () => {
      setupFive(fourOfFive);

      await firstValueFrom(sut.canAddAccount$);

      expect(avatarService.getUserAvatarColor$).not.toHaveBeenCalled();
      expect(environmentService.getEnvironment$).not.toHaveBeenCalled();
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
