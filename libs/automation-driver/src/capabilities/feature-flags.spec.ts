import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/default-config.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { FeatureFlagsCapability } from "./feature-flags";

describe("FeatureFlagsCapability", () => {
  const flag = FeatureFlag.GenerateInviteLink;
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;

  let configService: ReturnType<typeof mock<ConfigService>>;
  let stateProvider: FakeStateProvider;
  let sut: FeatureFlagsCapability;

  const currentOverrides = () =>
    firstValueFrom(stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES).state$);

  beforeEach(() => {
    configService = mock<ConfigService>();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    sut = new FeatureFlagsCapability(configService, stateProvider);
  });

  it("sets an override", async () => {
    await sut.set(flag, true);

    expect(await currentOverrides()).toEqual({ [flag]: true });
  });

  it("clears a single override", async () => {
    await sut.set(flag, true);

    await sut.clear(flag);

    expect(await currentOverrides()).toEqual({});
  });

  it("clears all overrides", async () => {
    await sut.set(flag, true);

    await sut.clearAll();

    expect(await currentOverrides()).toEqual({});
  });

  it("reads the effective value from the config service", async () => {
    configService.getFeatureFlag.mockResolvedValue(true as never);

    await expect(sut.get(flag)).resolves.toBe(true);
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(flag);
  });
});
