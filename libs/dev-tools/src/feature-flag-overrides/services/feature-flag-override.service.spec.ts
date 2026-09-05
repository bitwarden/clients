import { firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/default-config.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { FeatureFlagOverrideService } from "./feature-flag-override.service";

describe("FeatureFlagOverrideService", () => {
  const flagA = FeatureFlag.PM32009NewItemTypes;
  const flagB = FeatureFlag.FedRampGovRegion;

  let stateProvider: FakeStateProvider;
  let sut: FeatureFlagOverrideService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));
    sut = new FeatureFlagOverrideService(stateProvider);
  });

  const storedOverrides = () =>
    firstValueFrom(stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES).state$);

  it("emits an empty record when nothing is overridden", async () => {
    expect(await firstValueFrom(sut.overrides$)).toEqual({});
  });

  it("writes an override to the state DefaultConfigService reads", async () => {
    await sut.setOverride(flagA, true);

    expect(await storedOverrides()).toEqual({ [flagA]: true });
    expect(await firstValueFrom(sut.overrides$)).toEqual({ [flagA]: true });
  });

  it("keeps existing overrides when adding another", async () => {
    await sut.setOverride(flagA, true);
    await sut.setOverride(flagB, false);

    expect(await firstValueFrom(sut.overrides$)).toEqual({ [flagA]: true, [flagB]: false });
  });

  it("overwrites an existing override for the same flag", async () => {
    await sut.setOverride(flagA, true);
    await sut.setOverride(flagA, false);

    expect(await firstValueFrom(sut.overrides$)).toEqual({ [flagA]: false });
  });

  it("removes the key entirely when an override is cleared", async () => {
    await sut.setOverride(flagA, false);
    await sut.setOverride(flagB, true);

    await sut.clearOverride(flagA);

    const overrides = await firstValueFrom(sut.overrides$);
    expect(overrides).toEqual({ [flagB]: true });
    // Not merely set to null — `resolveFlag` would treat a null the same, but the record should
    // not accumulate dead keys.
    expect(flagA in overrides).toBe(false);
  });

  it("is a no-op when clearing a flag that is not overridden", async () => {
    await sut.setOverride(flagB, true);

    await sut.clearOverride(flagA);

    expect(await firstValueFrom(sut.overrides$)).toEqual({ [flagB]: true });
  });

  it("clears every override", async () => {
    await sut.setOverride(flagA, true);
    await sut.setOverride(flagB, true);

    await sut.clearAllOverrides();

    expect(await firstValueFrom(sut.overrides$)).toEqual({});
  });
});
