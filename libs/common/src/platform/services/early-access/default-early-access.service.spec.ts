import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { ConfigService } from "../../abstractions/config/config.service";

import {
  DefaultEarlyAccessService,
  USER_EARLY_ACCESS_ENABLED,
} from "./default-early-access.service";

describe("DefaultEarlyAccessService", () => {
  const userId = "userId" as UserId;
  const accountService = mockAccountServiceWith(userId);
  let stateProvider: FakeStateProvider;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let flagValue$: BehaviorSubject<boolean>;
  let sut: DefaultEarlyAccessService;

  beforeEach(async () => {
    stateProvider = new FakeStateProvider(accountService);
    configService = mock<ConfigService>();
    flagValue$ = new BehaviorSubject<boolean>(true);
    configService.userCachedFeatureFlag$.mockReturnValue(flagValue$);
    configService.invalidateUserConfig.mockResolvedValue(undefined);

    await accountService.switchAccount(userId);
    sut = new DefaultEarlyAccessService(stateProvider, configService);
  });

  it("defaults to disabled when the app has never been opted in", async () => {
    expect(await firstValueFrom(sut.earlyAccess$(userId))).toBe(false);
  });

  it("returns false when the EarlyAccess feature flag is disabled, even if state has been opted in", async () => {
    await stateProvider.setUserState(USER_EARLY_ACCESS_ENABLED, true, userId);
    flagValue$.next(false);

    expect(await firstValueFrom(sut.earlyAccess$(userId))).toBe(false);
  });

  it("gates on the EarlyAccess feature flag for the specific userId", async () => {
    await sut.setEarlyAccess(userId, true);
    await firstValueFrom(sut.earlyAccess$(userId));

    expect(configService.userCachedFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.EarlyAccess,
      userId,
    );
  });

  it("setEarlyAccess toggles what earlyAccess$ emits when the flag is on", async () => {
    await sut.setEarlyAccess(userId, true);
    expect(await firstValueFrom(sut.earlyAccess$(userId))).toBe(true);

    await sut.setEarlyAccess(userId, false);
    expect(await firstValueFrom(sut.earlyAccess$(userId))).toBe(false);
  });

  it("delivers live updates to subscribers without re-subscribing", async () => {
    const emissions: boolean[] = [];
    const subscription = sut.earlyAccess$(userId).subscribe((v) => emissions.push(v));

    await sut.setEarlyAccess(userId, true);
    await sut.setEarlyAccess(userId, false);
    await sut.setEarlyAccess(userId, true);
    subscription.unsubscribe();

    expect(emissions).toEqual([false, true, false, true]);
  });

  it("is user-scoped: each user's preference is independent", async () => {
    const otherUserId = "other-user" as UserId;

    await sut.setEarlyAccess(userId, true);
    await sut.setEarlyAccess(otherUserId, false);

    expect(await firstValueFrom(sut.earlyAccess$(userId))).toBe(true);
    expect(await firstValueFrom(sut.earlyAccess$(otherUserId))).toBe(false);
  });

  it("persists across logout — clearOn is [] so re-authenticating keeps the preference", async () => {
    // A fresh service instance (as if the app relaunched) reads the same persisted value.
    await sut.setEarlyAccess(userId, true);

    const nextLaunch = new DefaultEarlyAccessService(stateProvider, configService);
    expect(await firstValueFrom(nextLaunch.earlyAccess$(userId))).toBe(true);
  });

  it("invalidates the user's cached server config so flag values refresh on the next read", async () => {
    await sut.setEarlyAccess(userId, true);

    expect(configService.invalidateUserConfig).toHaveBeenCalledWith(userId);
  });

  it("does not consult ConfigService for a null feature-flag stream", async () => {
    // Guard against a regression where a caller passes null-tolerating patterns and the pipeline
    // silently emits `true` because null was coerced. earlyAccess$ must resolve to a strict
    // boolean AND — anything non-true from the flag side yields false.
    configService.userCachedFeatureFlag$.mockReturnValue(of(null as unknown as boolean));
    await stateProvider.setUserState(USER_EARLY_ACCESS_ENABLED, true, userId);

    const fresh = new DefaultEarlyAccessService(stateProvider, configService);
    expect(await firstValueFrom(fresh.earlyAccess$(userId))).toBe(false);
  });
});
