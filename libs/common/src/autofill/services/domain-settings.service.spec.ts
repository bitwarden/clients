import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";

import { FakeStateProvider, FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { FormPurposeCategories } from "../constants";
import { TargetingRulesByDomain, FormContent } from "../types";

import { DefaultDomainSettingsService, DomainSettingsService } from "./domain-settings.service";

const MOCK_API_URL = "https://api.bitwarden.com";

describe("DefaultDomainSettingsService", () => {
  let domainSettingsService: DomainSettingsService;
  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);
  const policyService = mock<PolicyService>();
  const configService = mock<ConfigService>();
  const fakeStateProvider: FakeStateProvider = new FakeStateProvider(accountService);
  let environmentService: MockProxy<EnvironmentService>;
  let authService: MockProxy<AuthService>;

  const mockEquivalentDomains = [
    ["example.com", "exampleapp.com", "example.co.uk", "ejemplo.es"],
    ["bitwarden.com", "bitwarden.co.uk", "sm-bitwarden.com"],
    ["example.co.uk", "exampleapp.co.uk"],
  ];

  beforeEach(() => {
    const mockEnvironment = mock<Environment>();
    mockEnvironment.getApiUrl.mockReturnValue(MOCK_API_URL);
    environmentService = mock<EnvironmentService>();
    environmentService.environment$ = new BehaviorSubject(mockEnvironment);

    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));

    domainSettingsService = new DefaultDomainSettingsService(
      fakeStateProvider,
      policyService,
      accountService,
      configService,
      environmentService,
      authService,
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
        category: FormPurposeCategories.AccountLogin,
        fields: {
          username: ["input#email"],
          password: ["input#pass"],
        },
      },
    ];

    const mockWwwForms: FormContent[] = [
      {
        category: FormPurposeCategories.AccountLogin,
        fields: {
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
      accountService.activeAccountSubject.next({ id: mockUserId } as any);
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

    describe("handles null hosts (blocklisted)", () => {
      it("always returns empty array when host is null", async () => {
        await setupRules({
          "example.com": null,
        });

        const rootRules =
          await domainSettingsService.getTargetingRulesForUrl("https://example.com/");
        const pathRules = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );
        const deepPathRules = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/deep/path",
        );

        expect(rootRules).toEqual([]);
        expect(pathRules).toEqual([]);
        expect(deepPathRules).toEqual([]);
      });
    });

    describe("handling for port-specific hosts", () => {
      const portForms: FormContent[] = [
        {
          category: FormPurposeCategories.AccountLogin,
          fields: { username: ["input#green-knight"] },
        },
      ];

      it("treats example.com and example.com:8443 as distinct entries", async () => {
        await setupRules({
          "example.com": { forms: mockForms },
          "example.com:8443": { forms: portForms },
        });

        const defaultPortResult = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );
        const customPortResult = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com:8443/login",
        );

        expect(defaultPortResult).toEqual(mockForms);
        expect(customPortResult).toEqual(portForms);
      });

      it("does not fall back from a ported host to the bare host", async () => {
        await setupRules({
          "example.com": { forms: mockForms },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com:8443/login",
        );

        expect(result).toBeNull();
      });

      it("strips default port 443 and matches bare host", async () => {
        await setupRules({
          "example.com": { forms: mockForms },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com:443/login",
        );

        expect(result).toEqual(mockForms);
      });
    });

    describe("resolves pathnames", () => {
      const loginForms: FormContent[] = [
        {
          category: FormPurposeCategories.AccountLogin,
          fields: { username: ["input#login-user"], password: ["input#login-pass"] },
        },
      ];
      const hostnameFallbackForms: FormContent[] = [
        { category: FormPurposeCategories.AccountLogin, fields: { username: ["input#babelfish"] } },
      ];

      it("returns pathname-specific rules when pathname matches", async () => {
        await setupRules({
          "example.com": {
            forms: hostnameFallbackForms,
            pathnames: {
              "/login": { forms: loginForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toEqual(loginForms);
      });

      it("falls back to hostname forms when no pathname matches", async () => {
        await setupRules({
          "example.com": {
            forms: hostnameFallbackForms,
            pathnames: {
              "/login": { forms: loginForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/about",
        );

        expect(result).toEqual(hostnameFallbackForms);
      });

      it("blocklists a specific pathname when set to null", async () => {
        await setupRules({
          "example.com": {
            forms: hostnameFallbackForms,
            pathnames: {
              "/search": null,
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/search",
        );

        expect(result).toEqual([]);
      });

      it("normalizes trailing slashes in pathnames", async () => {
        await setupRules({
          "example.com": {
            pathnames: {
              "/login": { forms: loginForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login/",
        );

        expect(result).toEqual(loginForms);
      });

      it("returns null (use heuristics) when hostname has pathnames but no forms fallback", async () => {
        await setupRules({
          "example.com": {
            pathnames: {
              "/login": { forms: loginForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/other",
        );

        expect(result).toBeNull();
      });

      it("matches a root path rule for the domain root", async () => {
        const rootForms: FormContent[] = [
          {
            category: FormPurposeCategories.AccountLogin,
            fields: { username: ["input.global-form-field"] },
          },
        ];
        await setupRules({
          "example.com": {
            forms: hostnameFallbackForms,
            pathnames: {
              "/": { forms: rootForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl("https://example.com/");

        expect(result).toEqual(rootForms);
      });

      it("matches a root path rule when URL has no trailing slash", async () => {
        const rootForms: FormContent[] = [
          {
            category: FormPurposeCategories.AccountLogin,
            fields: { username: ["input.global-form-field"] },
          },
        ];
        await setupRules({
          "example.com": {
            forms: hostnameFallbackForms,
            pathnames: {
              "/": { forms: rootForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl("https://example.com");

        expect(result).toEqual(rootForms);
      });

      it("uses hostname fallback for non-root paths when only root path is defined", async () => {
        const rootForms: FormContent[] = [
          {
            category: FormPurposeCategories.AccountLogin,
            fields: { username: ["input.global-form-field"] },
          },
        ];
        await setupRules({
          "example.com": {
            forms: hostnameFallbackForms,
            pathnames: {
              "/": { forms: rootForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/about",
        );

        expect(result).toEqual(hostnameFallbackForms);
      });
    });

    describe("defensively handles schema-violating data", () => {
      it("returns empty array when host is an empty object (no forms or pathnames)", async () => {
        await setupRules({
          "example.com": {} as TargetingRulesByDomain[""],
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toEqual([]);
      });

      it("returns empty array when host has empty forms and no pathnames", async () => {
        await setupRules({
          "example.com": { forms: [] },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toEqual([]);
      });

      it("returns empty array when a pathname has an empty forms array", async () => {
        await setupRules({
          "example.com": {
            pathnames: {
              "/login": { forms: [] },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toEqual([]);
      });

      it("ignores empty pathnames object and falls back to hostname forms", async () => {
        await setupRules({
          "example.com": {
            forms: mockForms,
            pathnames: {},
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toEqual(mockForms);
      });
    });

    describe("handles punycode cases", () => {
      it("matches punycode host key against URL containing a unicode hostname", async () => {
        await setupRules({
          "xn--mnchen-3ya.de": { forms: mockForms },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://münchen.de/login",
        );

        expect(result).toEqual(mockForms);
      });

      it("matches unicode host key against punycode URL", async () => {
        // Note, rules from the default provider are not expected to have
        // unicode host keys, but we handle those cases defensively
        await setupRules({
          "münchen.de": { forms: mockForms },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://xn--mnchen-3ya.de/login",
        );

        expect(result).toEqual(mockForms);
      });

      it("matches unicode host key against URL containing a unicode hostname", async () => {
        // Note, rules from the default provider are not expected to have
        // unicode host keys, but we handle those cases defensively
        await setupRules({
          "münchen.de": { forms: mockForms },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://münchen.de/login",
        );

        expect(result).toEqual(mockForms);
      });

      it("matches punycode host key against punycode URL", async () => {
        await setupRules({
          "xn--mnchen-3ya.de": { forms: mockForms },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://xn--mnchen-3ya.de/login",
        );

        expect(result).toEqual(mockForms);
      });

      it("falls back from www.xn--mnchen-3ya.de to xn--mnchen-3ya.de", async () => {
        await setupRules({
          "xn--mnchen-3ya.de": { forms: mockForms },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://www.xn--mnchen-3ya.de/login",
        );

        expect(result).toEqual(mockForms);
      });

      it("falls back from www.münchen.de to münchen.de via punycode normalization", async () => {
        await setupRules({
          "xn--mnchen-3ya.de": { forms: mockForms },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://www.münchen.de/login",
        );

        expect(result).toEqual(mockForms);
      });
    });

    describe("invalid URL input", () => {
      it("returns null for a malformed URL", async () => {
        await setupRules(mockRules);

        const result = await domainSettingsService.getTargetingRulesForUrl("not-a-url");

        expect(result).toBeNull();
      });

      it("returns null for an empty string", async () => {
        await setupRules(mockRules);

        const result = await domainSettingsService.getTargetingRulesForUrl("");

        expect(result).toBeNull();
      });
    });

    describe("handles query strings and fragments", () => {
      it("ignores query strings when matching pathnames", async () => {
        const loginForms: FormContent[] = [
          {
            category: FormPurposeCategories.AccountLogin,
            fields: { username: ["input#login-user"] },
          },
        ];
        await setupRules({
          "example.com": {
            pathnames: {
              "/login": { forms: loginForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login?ref=foo&bar=baz",
        );

        expect(result).toEqual(loginForms);
      });

      it("ignores fragments when matching pathnames", async () => {
        const loginForms: FormContent[] = [
          {
            category: FormPurposeCategories.AccountLogin,
            fields: { username: ["input#login-user"] },
          },
        ];
        await setupRules({
          "example.com": {
            pathnames: {
              "/login": { forms: loginForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login#section",
        );

        expect(result).toEqual(loginForms);
      });

      it("ignores both query strings and fragments together", async () => {
        const loginForms: FormContent[] = [
          {
            category: FormPurposeCategories.AccountLogin,
            fields: { username: ["input#login-user"] },
          },
        ];
        await setupRules({
          "example.com": {
            pathnames: {
              "/login": { forms: loginForms },
            },
          },
        });

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login?ref=foo#section",
        );

        expect(result).toEqual(loginForms);
      });
    });

    describe("handles state gates", () => {
      it("returns null when feature flag is disabled", async () => {
        configService.getFeatureFlag.mockImplementation(() => Promise.resolve(false));
        await domainSettingsService.setEnableFillAssist(true);
        await setupRules(mockRules);

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toBeNull();
      });

      it("returns null when fill assist setting is disabled", async () => {
        configService.getFeatureFlag.mockImplementation(() => Promise.resolve(true));
        await domainSettingsService.setEnableFillAssist(false);
        await domainSettingsService.setTargetingRules(mockRules);

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toBeNull();
      });

      it("returns null when no active account (logged out)", async () => {
        configService.getFeatureFlag.mockImplementation(() => Promise.resolve(true));
        await domainSettingsService.setEnableFillAssist(true);
        accountService.activeAccountSubject.next(null);
        await setupRules(mockRules);

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toBeNull();
      });

      it("returns null when no rules exist in state", async () => {
        configService.getFeatureFlag.mockImplementation(() => Promise.resolve(true));
        await domainSettingsService.setEnableFillAssist(true);
        await domainSettingsService.setTargetingRules({});

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toBeNull();
      });
    });
  });
});
