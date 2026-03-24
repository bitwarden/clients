import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { FakeStateProvider, FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { TargetingRulesByDomain, FormContent } from "../types";

import { DefaultDomainSettingsService, DomainSettingsService } from "./domain-settings.service";

describe("DefaultDomainSettingsService", () => {
  let domainSettingsService: DomainSettingsService;
  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);
  const policyService = mock<PolicyService>();
  const configService = mock<ConfigService>();
  const fakeStateProvider: FakeStateProvider = new FakeStateProvider(accountService);

  const mockEquivalentDomains = [
    ["example.com", "exampleapp.com", "example.co.uk", "ejemplo.es"],
    ["bitwarden.com", "bitwarden.co.uk", "sm-bitwarden.com"],
    ["example.co.uk", "exampleapp.co.uk"],
  ];

  beforeEach(() => {
    domainSettingsService = new DefaultDomainSettingsService(
      fakeStateProvider,
      policyService,
      accountService,
      configService,
    );

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

  describe("getTargetingRulesForUrl", () => {
    const mockForms: FormContent[] = [
      {
        selectors: {
          username: ["input#email"],
          password: ["input#pass"],
        },
      },
    ];

    const mockWwwForms: FormContent[] = [
      {
        selectors: {
          username: ["input#www-email"],
        },
      },
    ];

    const mockRules: TargetingRulesByDomain = {
      "example.com": {
        forms: mockForms,
      },
    };

    beforeEach(() => {
      configService.getFeatureFlag.mockImplementation((flag: string) => {
        if (flag === FeatureFlag.FillAssistTargetingRules) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
    });

    async function setupRules(rules: TargetingRulesByDomain) {
      await domainSettingsService.setEnableFillAssist(true);
      await domainSettingsService.setTargetingRules(rules);
    }

    it("falls back from www.example.com to example.com when no www entry exists", async () => {
      await setupRules(mockRules);

      const result = await domainSettingsService.getTargetingRulesForUrl(
        "https://www.example.com/login",
      );

      expect(result).toEqual(mockForms);
    });

    it("uses www.example.com entry when one exists (no fallback)", async () => {
      await setupRules({
        ...mockRules,
        "www.example.com": { forms: mockWwwForms },
      });

      const result = await domainSettingsService.getTargetingRulesForUrl(
        "https://www.example.com/login",
      );

      expect(result).toEqual(mockWwwForms);
    });

    it("blocklists www.example.com without falling back when www entry is null", async () => {
      await setupRules({
        ...mockRules,
        "www.example.com": null,
      });

      const result = await domainSettingsService.getTargetingRulesForUrl(
        "https://www.example.com/login",
      );

      expect(result).toEqual([]);
    });

    it("does not fall back from example.com to www.example.com", async () => {
      await setupRules({
        "www.example.com": { forms: mockWwwForms },
      });

      const result = await domainSettingsService.getTargetingRulesForUrl(
        "https://example.com/login",
      );

      expect(result).toBeNull();
    });

    it("returns null when neither www nor bare domain entry exists", async () => {
      await setupRules(mockRules);

      const result = await domainSettingsService.getTargetingRulesForUrl(
        "https://www.unknown.com/login",
      );

      expect(result).toBeNull();
    });
  });
});
