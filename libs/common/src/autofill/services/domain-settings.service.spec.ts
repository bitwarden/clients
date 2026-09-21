import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { FakeStateProvider, FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../admin-console/enums";
import { Policy } from "../../admin-console/models/domain/policy";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../platform/abstractions/environment.service";
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
  let configService: MockProxy<ConfigService>;
  let fakeStateProvider: FakeStateProvider;
  let environmentService: MockProxy<EnvironmentService>;
  let authService: MockProxy<AuthService>;
  let fillAssistFeatureFlagMock$: BehaviorSubject<boolean>;
  let fillAssistPolicyMock$: BehaviorSubject<Policy[]>;
  let serverConfigMock$: BehaviorSubject<any>;

  const makeFillAssistPolicy = (data: unknown, enabled: boolean = true): Policy =>
    ({
      id: "policy-id",
      organizationId: "org-id",
      type: PolicyType.FillAssist,
      data,
      enabled,
    }) as unknown as Policy;

  const mockEquivalentDomains = [
    ["example.com", "exampleapp.com", "example.co.uk", "ejemplo.es"],
    ["bitwarden.com", "bitwarden.co.uk", "sm-bitwarden.com"],
    ["example.co.uk", "exampleapp.co.uk"],
  ];

  beforeEach(() => {
    fakeStateProvider = new FakeStateProvider(accountService);
    configService = mock<ConfigService>();

    const mockEnvironment = mock<Environment>();
    mockEnvironment.getApiUrl.mockReturnValue(MOCK_API_URL);
    environmentService = mock<EnvironmentService>();
    environmentService.environment$ = new BehaviorSubject(mockEnvironment);

    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));

    fillAssistFeatureFlagMock$ = new BehaviorSubject(false);
    configService.getFeatureFlag$
      .calledWith(FeatureFlag.FillAssistTargetingRules)
      .mockReturnValue(fillAssistFeatureFlagMock$);

    fillAssistPolicyMock$ = new BehaviorSubject<Policy[]>([]);
    // Broadly mock so any call returns the fill assist mock; other policy-type
    // consumers (e.g. defaultUriMatchStrategyPolicy$) stay cold unless a test
    // subscribes to them.
    policyService.policiesByType$.mockReturnValue(fillAssistPolicyMock$);

    // effectiveFillAssistRulesUrl$ subscribes to serverConfig$; default the
    // mock to an empty environment so the URL derivation falls back to the
    // hardcoded default.
    serverConfigMock$ = new BehaviorSubject<any>({ environment: {} });
    (configService as any).serverConfig$ = serverConfigMock$;

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
      fillAssistFeatureFlagMock$.next(true);
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
        fillAssistFeatureFlagMock$.next(false);
        await domainSettingsService.setEnableFillAssist(true);
        await setupRules(mockRules);

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toBeNull();
      });

      it("returns null when fill assist setting is disabled", async () => {
        fillAssistFeatureFlagMock$.next(true);
        await domainSettingsService.setEnableFillAssist(false);
        await domainSettingsService.setTargetingRules(mockRules);

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toBeNull();
      });

      it("returns null when no active account (logged out)", async () => {
        fillAssistFeatureFlagMock$.next(true);
        await domainSettingsService.setEnableFillAssist(true);
        accountService.activeAccountSubject.next(null);
        await setupRules(mockRules);

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toBeNull();
      });

      it("returns null when no rules exist in state", async () => {
        fillAssistFeatureFlagMock$.next(true);
        await domainSettingsService.setEnableFillAssist(true);
        await domainSettingsService.setTargetingRules({});

        const result = await domainSettingsService.getTargetingRulesForUrl(
          "https://example.com/login",
        );

        expect(result).toBeNull();
      });
    });
  });

  describe("fillAssistPolicy$", () => {
    beforeEach(() => {
      accountService.activeAccountSubject.next({ id: mockUserId } as any);
    });

    it("emits null when no policies match", async () => {
      fillAssistPolicyMock$.next([]);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toBeNull();
    });

    it("emits null when the policy is present but disabled", async () => {
      fillAssistPolicyMock$.next([
        makeFillAssistPolicy({ rulesUrl: "https://example.com/rules" }, false),
      ]);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toBeNull();
    });

    it("emits {} (applies without URL) when policy data is null", async () => {
      fillAssistPolicyMock$.next([makeFillAssistPolicy(null)]);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toEqual({});
    });

    it("emits {} (applies without URL) when rulesUrl is missing from policy data", async () => {
      fillAssistPolicyMock$.next([makeFillAssistPolicy({})]);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toEqual({});
    });

    it("emits {} (applies without URL) when rulesUrl is an empty string", async () => {
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: "" })]);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toEqual({});
    });

    it("emits {} (applies without URL) when rulesUrl is not a string (defensive)", async () => {
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: 123 })]);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toEqual({});
    });

    it.each([
      ["http://example.com/rules"],
      ["javascript:alert(1)"],
      ["file:///etc/passwd"],
      ["ftp://example.com/rules"],
      ["not a url"],
    ])(
      "emits {} (applies without URL) when rulesUrl is a non-https or malformed URL: %s",
      async (rulesUrl) => {
        fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl })]);

        const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

        expect(result).toEqual({});
      },
    );

    it("emits { rulesUrl } when the policy is enabled with a valid https URL", async () => {
      const rulesUrl = "https://acme-org.example.com/rules";
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl })]);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toEqual({ rulesUrl });
    });

    it("returns the first policy when multiple orgs have fill assist policies (any-org-applies)", async () => {
      fillAssistPolicyMock$.next([
        makeFillAssistPolicy({ rulesUrl: "https://first-org.example.com/rules" }),
        makeFillAssistPolicy({ rulesUrl: "https://second-org.example.com/rules" }),
      ]);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toEqual({ rulesUrl: "https://first-org.example.com/rules" });
    });

    it("emits null when no active account", async () => {
      accountService.activeAccountSubject.next(null);

      const result = await firstValueFrom(domainSettingsService.fillAssistPolicy$);

      expect(result).toBeNull();
    });
  });

  describe("effectiveFillAssistRulesUrl$", () => {
    const DEFAULT_URL_TRAILING =
      "https://github.com/bitwarden/map-the-web/releases/latest/download/";

    beforeEach(() => {
      accountService.activeAccountSubject.next({ id: mockUserId } as any);
    });

    it("falls back to the hardcoded default when no policy URL and no server config URL", async () => {
      fillAssistPolicyMock$.next([]);
      serverConfigMock$.next({ environment: {} });

      const url = await firstValueFrom(domainSettingsService.effectiveFillAssistRulesUrl$);

      expect(url).toBe(DEFAULT_URL_TRAILING);
    });

    it("uses the server config URL when no policy URL is set", async () => {
      fillAssistPolicyMock$.next([]);
      serverConfigMock$.next({
        environment: { fillAssistRules: "https://server.example.com/rules" },
      });

      const url = await firstValueFrom(domainSettingsService.effectiveFillAssistRulesUrl$);

      expect(url).toBe("https://server.example.com/rules/");
    });

    it("prefers a custom policy URL over the server config URL", async () => {
      fillAssistPolicyMock$.next([
        makeFillAssistPolicy({ rulesUrl: "https://policy.example.com/rules" }),
      ]);
      serverConfigMock$.next({
        environment: { fillAssistRules: "https://server.example.com/rules" },
      });

      const url = await firstValueFrom(domainSettingsService.effectiveFillAssistRulesUrl$);

      expect(url).toBe("https://policy.example.com/rules/");
    });

    it("falls back to server config when the policy URL matches the hardcoded default", async () => {
      // A policy configured with the Bitwarden default URL should not shadow
      // the server config — otherwise self-hosted admins couldn't override.
      fillAssistPolicyMock$.next([
        makeFillAssistPolicy({
          rulesUrl: "https://github.com/bitwarden/map-the-web/releases/latest/download",
        }),
      ]);
      serverConfigMock$.next({
        environment: { fillAssistRules: "https://server.example.com/rules" },
      });

      const url = await firstValueFrom(domainSettingsService.effectiveFillAssistRulesUrl$);

      expect(url).toBe("https://server.example.com/rules/");
    });

    it("also falls back to server config when the policy URL is the default with a trailing slash", async () => {
      // The comparison normalizes both sides — an admin saving the default
      // URL with a slash must not shadow server config.
      fillAssistPolicyMock$.next([
        makeFillAssistPolicy({
          rulesUrl: "https://github.com/bitwarden/map-the-web/releases/latest/download/",
        }),
      ]);
      serverConfigMock$.next({
        environment: { fillAssistRules: "https://server.example.com/rules" },
      });

      const url = await firstValueFrom(domainSettingsService.effectiveFillAssistRulesUrl$);

      expect(url).toBe("https://server.example.com/rules/");
    });

    it("appends a trailing slash when the resolved URL is missing one", async () => {
      fillAssistPolicyMock$.next([
        makeFillAssistPolicy({ rulesUrl: "https://policy.example.com/rules" }),
      ]);

      const url = await firstValueFrom(domainSettingsService.effectiveFillAssistRulesUrl$);

      expect(url.endsWith("/")).toBe(true);
    });

    it("preserves an existing trailing slash without doubling it", async () => {
      fillAssistPolicyMock$.next([
        makeFillAssistPolicy({ rulesUrl: "https://policy.example.com/rules/" }),
      ]);

      const url = await firstValueFrom(domainSettingsService.effectiveFillAssistRulesUrl$);

      expect(url).toBe("https://policy.example.com/rules/");
    });
  });

  describe("setTargetingRules — snapshot URL", () => {
    // Semantic anchor for the read side: getTargetingRulesForUrl reads the
    // rules keyed by the current effective URL, so we verify by pointing the
    // effective URL at the same host we wrote to.
    const mockRulesForUrlTest: TargetingRulesByDomain = {
      "example.com": {
        forms: [
          {
            category: FormPurposeCategories.AccountLogin,
            fields: { username: ["input#u"] },
          },
        ],
      },
    };

    beforeEach(() => {
      fillAssistFeatureFlagMock$.next(true);
      accountService.activeAccountSubject.next({ id: mockUserId } as any);
    });

    it("writes rules under the passed-in effective URL, not the currently-resolved one", async () => {
      const snapshotUrl = "https://org-a.example.com/rules/";
      const currentUrl = "https://org-b.example.com/rules/";

      // Simulate the mid-fetch drift: caller resolved snapshotUrl earlier, but
      // by the time it calls setTargetingRules, the effective URL has moved.
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: currentUrl })]);
      await domainSettingsService.setEnableFillAssist(true);
      await domainSettingsService.setTargetingRules(mockRulesForUrlTest, snapshotUrl);

      // Point the effective URL back at snapshotUrl — the rules should be
      // there (i.e. the write pinned to snapshotUrl, not currentUrl).
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: snapshotUrl })]);
      const result = await domainSettingsService.getTargetingRulesForUrl(
        "https://example.com/login",
      );

      expect(result).not.toBeNull();
    });

    it("falls back to re-resolving the effective URL when no snapshot is passed", async () => {
      const currentUrl = "https://org-b.example.com/rules/";

      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: currentUrl })]);
      await domainSettingsService.setEnableFillAssist(true);
      await domainSettingsService.setTargetingRules(mockRulesForUrlTest);

      // Effective URL is still currentUrl — the rules should read back here.
      const result = await domainSettingsService.getTargetingRulesForUrl(
        "https://example.com/login",
      );

      expect(result).not.toBeNull();
    });
  });

  describe("resolvedEnableFillAssist$ (user-explicit-wins semantics)", () => {
    beforeEach(() => {
      accountService.activeAccountSubject.next({ id: mockUserId } as any);
      fillAssistFeatureFlagMock$.next(true);
    });

    it("returns false when feature flag is off, regardless of user setting or policy", async () => {
      fillAssistFeatureFlagMock$.next(false);
      await domainSettingsService.setEnableFillAssist(true);
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: "https://example.com/rules" })]);

      const result = await firstValueFrom(domainSettingsService.resolvedEnableFillAssist$);

      expect(result).toBe(false);
    });

    it("returns false when user is pristine (untouched) and no policy applies", async () => {
      // Don't call setEnableFillAssist — user setting is pristine (null).
      fillAssistPolicyMock$.next([]);

      const result = await firstValueFrom(domainSettingsService.resolvedEnableFillAssist$);

      expect(result).toBe(false);
    });

    it("returns true when user is pristine and policy applies (policy defaults ON)", async () => {
      // Don't call setEnableFillAssist — user setting is pristine.
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: "https://example.com/rules" })]);

      const result = await firstValueFrom(domainSettingsService.resolvedEnableFillAssist$);

      expect(result).toBe(true);
    });

    it("returns true when user has explicitly set true and no policy applies", async () => {
      await domainSettingsService.setEnableFillAssist(true);
      fillAssistPolicyMock$.next([]);

      const result = await firstValueFrom(domainSettingsService.resolvedEnableFillAssist$);

      expect(result).toBe(true);
    });

    it("returns false when user has explicitly set false and no policy applies", async () => {
      await domainSettingsService.setEnableFillAssist(false);
      fillAssistPolicyMock$.next([]);

      const result = await firstValueFrom(domainSettingsService.resolvedEnableFillAssist$);

      expect(result).toBe(false);
    });

    it("returns true when user has explicitly set true and policy applies", async () => {
      await domainSettingsService.setEnableFillAssist(true);
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: "https://example.com/rules" })]);

      const result = await firstValueFrom(domainSettingsService.resolvedEnableFillAssist$);

      expect(result).toBe(true);
    });

    it("returns false when user has explicitly set false even if policy applies (user-explicit-wins)", async () => {
      await domainSettingsService.setEnableFillAssist(false);
      fillAssistPolicyMock$.next([makeFillAssistPolicy({ rulesUrl: "https://example.com/rules" })]);

      const result = await firstValueFrom(domainSettingsService.resolvedEnableFillAssist$);

      expect(result).toBe(false);
    });
  });
});
