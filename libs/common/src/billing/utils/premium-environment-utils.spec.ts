import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, Observable, of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Environment } from "@bitwarden/common/platform/abstractions/environment.service";

import { isPremiumCloudEnvironment$ } from "./premium-environment-utils";

describe("isPremiumCloudEnvironment$", () => {
  let environment$: Observable<Environment>;
  let configService: MockProxy<ConfigService>;

  const setup = (isCloud: boolean, disableSelfHostCheck: boolean) => {
    configService = mock<ConfigService>();

    environment$ = of({ isCloud: () => isCloud } as Environment);
    configService.getFeatureFlag$.mockReturnValue(of(disableSelfHostCheck));
  };

  it("emits true for a cloud environment when the flag is disabled", async () => {
    setup(true, false);

    await expect(
      firstValueFrom(isPremiumCloudEnvironment$(environment$, configService)),
    ).resolves.toBe(true);
  });

  it("emits true for a cloud environment when the flag is enabled", async () => {
    setup(true, true);

    await expect(
      firstValueFrom(isPremiumCloudEnvironment$(environment$, configService)),
    ).resolves.toBe(true);
  });

  it("emits false for a self-hosted environment when the flag is disabled", async () => {
    setup(false, false);

    await expect(
      firstValueFrom(isPremiumCloudEnvironment$(environment$, configService)),
    ).resolves.toBe(false);
  });

  it("emits true for a self-hosted environment when the flag is enabled", async () => {
    setup(false, true);

    await expect(
      firstValueFrom(isPremiumCloudEnvironment$(environment$, configService)),
    ).resolves.toBe(true);
  });

  it("does not consult the feature flag for a cloud environment", async () => {
    setup(true, false);

    await firstValueFrom(isPremiumCloudEnvironment$(environment$, configService));

    expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
  });

  it("reads the PM38393_DisableSelfHostPremiumCheck feature flag for a self-hosted environment", async () => {
    setup(false, false);

    await firstValueFrom(isPremiumCloudEnvironment$(environment$, configService));

    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.PM38393_DisableSelfHostPremiumCheck,
    );
  });

  it("re-emits when the flag value changes on a self-hosted environment", async () => {
    configService = mock<ConfigService>();
    environment$ = of({ isCloud: () => false } as Environment);
    configService.getFeatureFlag$.mockReturnValue(of(false, true));

    const emissions: boolean[] = [];
    isPremiumCloudEnvironment$(environment$, configService).subscribe((value) =>
      emissions.push(value),
    );

    expect(emissions).toEqual([false, true]);
  });
});
