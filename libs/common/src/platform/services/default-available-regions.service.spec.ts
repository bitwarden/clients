import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

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

  beforeEach(() => {
    environmentService = mock<EnvironmentService>();
    environmentService.availableRegions.mockReturnValue(allRegions);
  });

  describe("availableRegions$", () => {
    it("emits every region the environment service reports, including Gov", async () => {
      const sut = new DefaultAvailableRegionsService(environmentService);

      const regions = await firstValueFrom(sut.availableRegions$);

      expect(regions.map((r) => r.key)).toEqual([Region.US, Region.EU, Region.Gov]);
    });
  });
});
