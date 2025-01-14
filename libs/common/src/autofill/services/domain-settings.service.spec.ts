import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { FakeStateProvider, FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";

import { DefaultDomainSettingsService, DomainSettingsService } from "./domain-settings.service";

describe("DefaultDomainSettingsService", () => {
  let domainSettingsService: DomainSettingsService;
  let configService: MockProxy<ConfigService>;
  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);
  const fakeStateProvider: FakeStateProvider = new FakeStateProvider(accountService);

  const mockEquivalentDomains = [
    ["example.com", "exampleapp.com", "example.co.uk", "ejemplo.es"],
    ["bitwarden.com", "bitwarden.co.uk", "sm-bitwarden.com"],
    ["example.co.uk", "exampleapp.co.uk"],
  ];

  beforeEach(() => {
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation(() => of(false));
    domainSettingsService = new DefaultDomainSettingsService(fakeStateProvider, configService);

    jest.spyOn(domainSettingsService, "getUrlEquivalentDomains");
    domainSettingsService.equivalentDomains$ = of(mockEquivalentDomains);
    domainSettingsService.blockedInteractionsUris$ = of({});
  });

  describe("getUrlEquivalentDomains", () => {
    it("returns all equivalent domains for a URL", async () => {
      const expected = new Set([
        "example.com",
        "exampleapp.com",
        "example.co.uk",
        "ejemplo.es",
        "exampleapp.co.uk",
      ]);

      const actual = await firstValueFrom(
        domainSettingsService.getUrlEquivalentDomains("example.co.uk"),
      );

      expect(domainSettingsService.getUrlEquivalentDomains).toHaveBeenCalledWith("example.co.uk");
      expect(actual).toEqual(expected);
    });

    it("returns an empty set if there are no equivalent domains", async () => {
      const actual = await firstValueFrom(domainSettingsService.getUrlEquivalentDomains("asdf"));

      expect(domainSettingsService.getUrlEquivalentDomains).toHaveBeenCalledWith("asdf");
      expect(actual).toEqual(new Set());
    });
  });
});
