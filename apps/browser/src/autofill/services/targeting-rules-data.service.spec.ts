import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DEFAULT_FILL_ASSIST_RULES_URL } from "@bitwarden/common/autofill/constants";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
const DEFAULT_URL_TRAILING = `${DEFAULT_FILL_ASSIST_RULES_URL}/`;

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

describe("TargetingRulesDataService", () => {
  let apiService: MockProxy<ApiService>;
  let domainSettingsService: MockProxy<DomainSettingsService>;
  let configService: MockProxy<ConfigService>;
  let environmentService: MockProxy<EnvironmentService>;
  let taskSchedulerService: MockProxy<TaskSchedulerService>;
  let globalStateProvider: MockProxy<GlobalStateProvider>;
  let logService: MockProxy<LogService>;

  let fillAssistPolicyMock$: BehaviorSubject<{ rulesUrl?: string } | null>;
  let effectiveUrlMock$: BehaviorSubject<string>;
  let resolvedEnableFillAssistMock$: BehaviorSubject<boolean>;
  let serverConfigMock$: BehaviorSubject<any>;
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

    // configService.serverConfig$ still drives the "trigger fetch on config
    // change" subscription in init() even though URL derivation moved out.
    serverConfigMock$ = new BehaviorSubject<any>({ environment: {} });
    (configService as any).serverConfig$ = serverConfigMock$;

    // fillAssistPolicy$ still drives the "trigger fetch on policy change"
    // subscription in init().
    fillAssistPolicyMock$ = new BehaviorSubject<{ rulesUrl?: string } | null>(null);
    (domainSettingsService as any).fillAssistPolicy$ = fillAssistPolicyMock$;

    // effectiveFillAssistRulesUrl$ is now the single source of truth for
    // "which URL should the fetcher use" (derived in DomainSettingsService).
    effectiveUrlMock$ = new BehaviorSubject<string>(DEFAULT_URL_TRAILING);
    (domainSettingsService as any).effectiveFillAssistRulesUrl$ = effectiveUrlMock$;

    // resolvedEnableFillAssist$ gates whether the fetcher runs at all —
    // an opted-out user should have zero outbound traffic. Default to `true`
    // so existing tests exercise the fetch path unchanged.
    resolvedEnableFillAssistMock$ = new BehaviorSubject<boolean>(true);
    (domainSettingsService as any).resolvedEnableFillAssist$ = resolvedEnableFillAssistMock$;

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

  describe("init subscriptions", () => {
    it("triggers a fetch when the fill assist policy changes", async () => {
      const fetchSpy = jest
        .spyOn(service as any, "_fetchAndStoreRules")
        .mockResolvedValue(undefined);

      await service.init();
      // Clear calls made during init (from initial serverConfig$ / policy emissions)
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
        environment: { fillAssistRules: "https://new.example.com/rules" },
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe("_resolveResourceBaseUrl", () => {
    it("reads from DomainSettingsService.effectiveFillAssistRulesUrl$", async () => {
      const expected = "https://acme-org.example.com/rules/";
      effectiveUrlMock$.next(expected);

      const url = await (service as any)._resolveResourceBaseUrl();

      expect(url).toBe(expected);
    });
  });

  describe("cache invalidation via compound key", () => {
    it("re-fetches when the effective URL changes, even within the cache-age window", async () => {
      const url1 = DEFAULT_URL_TRAILING;
      const url2 = "https://acme-org.example.com/rules/";

      apiService.nativeFetch
        .mockResolvedValueOnce(makeManifestResponse("cid-1"))
        .mockResolvedValueOnce(makeRulesResponse())
        .mockResolvedValueOnce(makeManifestResponse("cid-2"))
        .mockResolvedValueOnce(makeRulesResponse());

      // First fetch under url1
      effectiveUrlMock$.next(url1);
      await (service as any)._fetchAndStoreRules(true /* skip cache-age */);
      const callsAfterFirst = apiService.nativeFetch.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThanOrEqual(2); // manifest + rules

      // URL changes; despite cache being fresh, the new compound key misses
      // and a fresh fetch happens.
      effectiveUrlMock$.next(url2);
      await (service as any)._fetchAndStoreRules(false);
      expect(apiService.nativeFetch.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it("skips fetch when the cache is fresh under the current effective URL", async () => {
      apiService.nativeFetch
        .mockResolvedValueOnce(makeManifestResponse("cid-1"))
        .mockResolvedValueOnce(makeRulesResponse());

      // First fetch writes the cache under the current URL
      await (service as any)._fetchAndStoreRules(true);
      const callsAfterFirst = apiService.nativeFetch.mock.calls.length;

      // Same URL, cache-age check active — should skip
      await (service as any)._fetchAndStoreRules(false);

      expect(apiService.nativeFetch.mock.calls.length).toBe(callsAfterFirst);
    });

    it("caches independently for two different effective URLs on the same server", async () => {
      const urlA = "https://org-a.example.com/rules/";
      const urlB = "https://org-b.example.com/rules/";

      apiService.nativeFetch
        .mockResolvedValueOnce(makeManifestResponse("cid-A"))
        .mockResolvedValueOnce(makeRulesResponse())
        .mockResolvedValueOnce(makeManifestResponse("cid-B"))
        .mockResolvedValueOnce(makeRulesResponse());

      // Fetch under URL A
      effectiveUrlMock$.next(urlA);
      await (service as any)._fetchAndStoreRules(true);
      const callsAfterA = apiService.nativeFetch.mock.calls.length;

      // Switch to URL B — expect a fresh fetch under a different cache key
      effectiveUrlMock$.next(urlB);
      await (service as any)._fetchAndStoreRules(false);
      const callsAfterB = apiService.nativeFetch.mock.calls.length;
      expect(callsAfterB).toBeGreaterThan(callsAfterA);

      // Switch back to URL A — the URL-A cache should still be fresh, no fetch
      effectiveUrlMock$.next(urlA);
      await (service as any)._fetchAndStoreRules(false);
      expect(apiService.nativeFetch.mock.calls.length).toBe(callsAfterB);
    });

    it("stores rules under the effective URL's cache key on successful fetch", async () => {
      effectiveUrlMock$.next(DEFAULT_URL_TRAILING);
      apiService.nativeFetch
        .mockResolvedValueOnce(makeManifestResponse("cid-1"))
        .mockResolvedValueOnce(makeRulesResponse());

      await (service as any)._fetchAndStoreRules(true);

      // Behavior check: a subsequent fetch with the same URL and skip-age=false
      // should NOT hit the network again (cache is warm).
      const callsAfterFirst = apiService.nativeFetch.mock.calls.length;
      await (service as any)._fetchAndStoreRules(false);
      expect(apiService.nativeFetch.mock.calls.length).toBe(callsAfterFirst);
    });
  });

  describe("resolvedEnableFillAssist$ gate", () => {
    it("skips fetch when fill assist is off, even with the feature flag on", async () => {
      // An opted-out user should have zero outbound traffic to the
      // (potentially org-admin-configured) rules feed URL.
      resolvedEnableFillAssistMock$.next(false);

      await (service as any)._fetchAndStoreRules(true /* skip cache-age */);

      expect(apiService.nativeFetch).not.toHaveBeenCalled();
    });

    it("triggers a fetch when fill assist transitions from off to on", async () => {
      // Start opted out so init doesn't consume the trigger.
      resolvedEnableFillAssistMock$.next(false);

      const fetchSpy = jest
        .spyOn(service as any, "_fetchAndStoreRules")
        .mockResolvedValue(undefined);

      await service.init();
      // Clear the init-time fires from serverConfig$ / fillAssistPolicy$.
      fetchSpy.mockClear();

      resolvedEnableFillAssistMock$.next(true);
      await new Promise((r) => setTimeout(r, 0));

      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe("_resetMeta", () => {
    it("clears meta under the compound cache key so the next fetch re-downloads", async () => {
      const url = "https://acme-org.example.com/rules/";
      effectiveUrlMock$.next(url);

      // Warm the cache under the compound key.
      apiService.nativeFetch
        .mockResolvedValueOnce(makeManifestResponse("cid-1"))
        .mockResolvedValueOnce(makeRulesResponse());
      await (service as any)._fetchAndStoreRules(true);
      const callsAfterWarm = apiService.nativeFetch.mock.calls.length;

      // Sanity: same URL, non-skip → cache hit, no network.
      await (service as any)._fetchAndStoreRules(false);
      expect(apiService.nativeFetch.mock.calls.length).toBe(callsAfterWarm);

      // Reset should clear the compound-key entry, forcing the next
      // non-skip fetch to hit the network again.
      await (service as any)._resetMeta();

      apiService.nativeFetch
        .mockResolvedValueOnce(makeManifestResponse("cid-2"))
        .mockResolvedValueOnce(makeRulesResponse());
      await (service as any)._fetchAndStoreRules(false);
      expect(apiService.nativeFetch.mock.calls.length).toBeGreaterThan(callsAfterWarm);
    });
  });
});
