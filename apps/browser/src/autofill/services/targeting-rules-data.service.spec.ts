import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DEFAULT_FILL_ASSIST_RULES_URL } from "@bitwarden/common/autofill/constants";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { GlobalState, GlobalStateProvider } from "@bitwarden/state";

import { TargetingRulesDataService } from "./targeting-rules-data.service";

// The service uses `new Request(url)` under `apiService.nativeFetch(...)`.
// Jest's default node env doesn't include the fetch API globals; stub `Request`
// so the service's construction of it doesn't throw. Response is not needed
// because we duck-type it directly in per-test mocks below.
(global as any).Request =
  (global as any).Request ??
  class {
    constructor(public url: string) {}
  };

const MOCK_API_URL = "https://api.bitwarden.com";

describe("TargetingRulesDataService", () => {
  let apiService: MockProxy<ApiService>;
  let domainSettingsService: MockProxy<DomainSettingsService>;
  let configService: MockProxy<ConfigService>;
  let environmentService: MockProxy<EnvironmentService>;
  let taskSchedulerService: MockProxy<TaskSchedulerService>;
  let globalStateProvider: MockProxy<GlobalStateProvider>;
  let logService: MockProxy<LogService>;

  let fillAssistPolicyMock$: BehaviorSubject<{ rulesUrl: string } | null>;
  let serverConfigMock$: BehaviorSubject<Partial<ServerConfig> | undefined>;
  let metaStateMock$: BehaviorSubject<Record<string, any>>;
  let metaState: MockProxy<GlobalState<Record<string, any>>>;

  let service: TargetingRulesDataService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    domainSettingsService = mock<DomainSettingsService>();
    configService = mock<ConfigService>();
    environmentService = mock<EnvironmentService>();
    taskSchedulerService = mock<TaskSchedulerService>();
    globalStateProvider = mock<GlobalStateProvider>();
    logService = mock<LogService>();

    const mockEnvironment = mock<Environment>();
    mockEnvironment.getApiUrl.mockReturnValue(MOCK_API_URL);
    (environmentService as any).environment$ = new BehaviorSubject(mockEnvironment);

    serverConfigMock$ = new BehaviorSubject<Partial<ServerConfig> | undefined>({
      environment: {} as any,
    });
    (configService as any).serverConfig$ = serverConfigMock$;

    fillAssistPolicyMock$ = new BehaviorSubject<{ rulesUrl: string } | null>(null);
    (domainSettingsService as any).fillAssistPolicy$ = fillAssistPolicyMock$;

    metaStateMock$ = new BehaviorSubject<Record<string, any>>({});
    metaState = mock<GlobalState<Record<string, any>>>();
    (metaState as any).state$ = metaStateMock$;
    metaState.update.mockImplementation(async (updater: any) => {
      const next = updater(metaStateMock$.value);
      metaStateMock$.next(next);
      return next;
    });
    globalStateProvider.get.mockReturnValue(metaState as any);

    configService.getFeatureFlag.mockResolvedValue(true);

    service = new TargetingRulesDataService(
      apiService,
      domainSettingsService,
      configService,
      environmentService,
      taskSchedulerService,
      globalStateProvider,
      logService,
    );
  });

  afterEach(() => {
    service.dispose();
  });

  describe("_resolveResourceBaseUrl", () => {
    it("falls back to the hardcoded Bitwarden default when neither policy nor server config supplies a URL", async () => {
      fillAssistPolicyMock$.next(null);
      serverConfigMock$.next({ environment: {} as any });

      const url = await (service as any)._resolveResourceBaseUrl();

      expect(url).toBe(`${DEFAULT_FILL_ASSIST_RULES_URL}/`);
    });

    it("uses the server config URL when no policy applies", async () => {
      const serverUrl = "https://self-hosted.example.com/rules";
      fillAssistPolicyMock$.next(null);
      serverConfigMock$.next({ environment: { fillAssistRules: serverUrl } as any });

      const url = await (service as any)._resolveResourceBaseUrl();

      expect(url).toBe(`${serverUrl}/`);
    });

    it("uses the server config URL when the policy URL matches the Bitwarden default (admin left pre-fill)", async () => {
      const serverUrl = "https://self-hosted.example.com/rules";
      fillAssistPolicyMock$.next({ rulesUrl: DEFAULT_FILL_ASSIST_RULES_URL });
      serverConfigMock$.next({ environment: { fillAssistRules: serverUrl } as any });

      const url = await (service as any)._resolveResourceBaseUrl();

      expect(url).toBe(`${serverUrl}/`);
    });

    it("uses the policy URL when it differs from the Bitwarden default", async () => {
      const policyUrl = "https://acme-org.example.com/rules";
      const serverUrl = "https://self-hosted.example.com/rules";
      fillAssistPolicyMock$.next({ rulesUrl: policyUrl });
      serverConfigMock$.next({ environment: { fillAssistRules: serverUrl } as any });

      const url = await (service as any)._resolveResourceBaseUrl();

      expect(url).toBe(`${policyUrl}/`);
    });

    it("appends a trailing slash when the resolved URL doesn't have one", async () => {
      fillAssistPolicyMock$.next({ rulesUrl: "https://acme-org.example.com/rules" });

      const url = await (service as any)._resolveResourceBaseUrl();

      expect(url).toBe("https://acme-org.example.com/rules/");
    });

    it("preserves an existing trailing slash without doubling it", async () => {
      fillAssistPolicyMock$.next({ rulesUrl: "https://acme-org.example.com/rules/" });

      const url = await (service as any)._resolveResourceBaseUrl();

      expect(url).toBe("https://acme-org.example.com/rules/");
    });
  });

  describe("init subscriptions", () => {
    it("triggers a fetch when the fill assist policy changes", async () => {
      const fetchSpy = jest
        .spyOn(service as any, "_fetchAndStoreRules")
        .mockResolvedValue(undefined);

      await service.init();
      // Clear calls made during init (from initial serverConfig$ emission)
      fetchSpy.mockClear();

      fillAssistPolicyMock$.next({ rulesUrl: "https://acme-org.example.com/rules" });
      await new Promise((r) => setTimeout(r, 0));

      expect(fetchSpy).toHaveBeenCalled();
    });

    it("triggers a fetch when the server config changes", async () => {
      const fetchSpy = jest
        .spyOn(service as any, "_fetchAndStoreRules")
        .mockResolvedValue(undefined);

      await service.init();
      fetchSpy.mockClear();

      serverConfigMock$.next({
        environment: { fillAssistRules: "https://new.example.com/rules" } as any,
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe("cache invalidation on URL change", () => {
    const makeManifestResponse = (cid: string) =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          maps: { forms: { v1: { filename: "forms.json", cid } } },
        }),
      }) as unknown as Response;
    const makeRulesResponse = () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ hosts: {} }),
      }) as unknown as Response;

    it("forces a fetch even when cache is fresh, if the effective URL changed", async () => {
      // Cache is 'fresh' (just written) with an old URL from a previous policy
      const oldUrl = "https://old-policy.example.com/rules/";
      metaStateMock$.next({
        [MOCK_API_URL]: { timestamp: Date.now(), cid: "abc123", url: oldUrl },
      });

      // Current effective URL is the Bitwarden default (no policy)
      fillAssistPolicyMock$.next(null);
      serverConfigMock$.next({ environment: {} as any });

      apiService.nativeFetch
        .mockResolvedValueOnce(makeManifestResponse("xyz789"))
        .mockResolvedValueOnce(makeRulesResponse());

      await (service as any)._fetchAndStoreRules(false);

      // Fetch should have been called despite the fresh cache
      expect(apiService.nativeFetch).toHaveBeenCalled();
    });

    it("skips fetch when cache is fresh and URL is unchanged", async () => {
      const currentUrl = `${DEFAULT_FILL_ASSIST_RULES_URL}/`;
      metaStateMock$.next({
        [MOCK_API_URL]: { timestamp: Date.now(), cid: "abc123", url: currentUrl },
      });

      fillAssistPolicyMock$.next(null);
      serverConfigMock$.next({ environment: {} as any });

      await (service as any)._fetchAndStoreRules(false);

      expect(apiService.nativeFetch).not.toHaveBeenCalled();
    });

    it("stores the effective URL in meta on successful fetch", async () => {
      metaStateMock$.next({}); // no prior cache

      const policyUrl = "https://acme-org.example.com/rules";
      fillAssistPolicyMock$.next({ rulesUrl: policyUrl });
      serverConfigMock$.next({ environment: {} as any });

      apiService.nativeFetch
        .mockResolvedValueOnce(makeManifestResponse("cid-1"))
        .mockResolvedValueOnce(makeRulesResponse());

      await (service as any)._fetchAndStoreRules(true /* skip cache-age */);

      const meta = metaStateMock$.value[MOCK_API_URL];
      expect(meta.url).toBe(`${policyUrl}/`);
      expect(meta.cid).toBe("cid-1");
    });
  });
});
