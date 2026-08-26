import { mock, MockProxy } from "jest-mock-extended";
import { Subject, firstValueFrom, of, toArray } from "rxjs";
import { take } from "rxjs/operators";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../abstractions/config/config.service";
import {
  EnvironmentService,
  Region,
  RegionConfig,
  Urls,
} from "../abstractions/environment.service";

import { DefaultAvailableRegionsService } from "./default-available-regions.service";

describe("DefaultAvailableRegionsService", () => {
  const urls: Urls = {} as Urls;
  const allRegions: RegionConfig[] = [
    { key: Region.US, domain: "bitwarden.com", urls },
    { key: Region.EU, domain: "bitwarden.eu", urls },
    { key: Region.Gov, domain: "bitwarden-gov.com", urls },
  ];

  let environmentService: MockProxy<EnvironmentService>;
  let configService: MockProxy<ConfigService>;

  beforeEach(() => {
    environmentService = mock<EnvironmentService>();
    configService = mock<ConfigService>();
    environmentService.availableRegions.mockReturnValue(allRegions);
  });

  describe("availableRegions$", () => {
    it("includes Gov when the FedRampGovRegion flag emits true", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      const sut = new DefaultAvailableRegionsService(environmentService, configService);

      const regions = await firstValueFrom(sut.availableRegions$.pipe(take(2), toArray()));
      const lastEmission = regions[regions.length - 1];

      expect(lastEmission.map((r) => r.key)).toEqual([Region.US, Region.EU, Region.Gov]);
      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.FedRampGovRegion);
    });

    it("excludes Gov when the FedRampGovRegion flag emits false", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      const sut = new DefaultAvailableRegionsService(environmentService, configService);

      const regions = await firstValueFrom(sut.availableRegions$);

      expect(regions.map((r) => r.key)).toEqual([Region.US, Region.EU]);
    });

    it("excludes Gov on the initial synchronous emission (startWith(false) seed) before the flag emits", async () => {
      // Never-emitting upstream: the only emission consumers see is the startWith(false) seed.
      configService.getFeatureFlag$.mockReturnValue(new Subject<boolean>().asObservable());
      const sut = new DefaultAvailableRegionsService(environmentService, configService);

      const regions = await firstValueFrom(sut.availableRegions$);

      expect(regions.map((r) => r.key)).toEqual([Region.US, Region.EU]);
    });

    it.each([true, false])(
      "always includes US and EU regardless of flag state (flag=%s)",
      async (flagValue) => {
        configService.getFeatureFlag$.mockReturnValue(of(flagValue));
        const sut = new DefaultAvailableRegionsService(environmentService, configService);

        const emissions = await firstValueFrom(sut.availableRegions$.pipe(take(2), toArray()));
        const finalEmission = emissions[emissions.length - 1];

        expect(finalEmission.map((r) => r.key)).toEqual(
          expect.arrayContaining([Region.US, Region.EU]),
        );
      },
    );
  });
});
