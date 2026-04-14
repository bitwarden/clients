import {
  catchError,
  defer,
  EMPTY,
  exhaustMap,
  firstValueFrom,
  from,
  retry,
  Subject,
  takeUntil,
  tap,
  timer,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { TargetingRulesByDomain } from "@bitwarden/common/autofill/types";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import {
  DOMAIN_SETTINGS_DISK,
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
} from "@bitwarden/state";

/** Fallback URI used when the server does not provide a targeting rules URI */
const DEFAULT_TARGETING_RULES_SOURCE_URL =
  "https://github.com/bitwarden/map-the-web/releases/latest/download/forms.v1.json";

type TargetingRulesDataMeta = {
  /** The last time the data set was updated  */
  timestamp: number;
};

const SERVER_TARGETING_RULES_META = KeyDefinition.record<TargetingRulesDataMeta, string>(
  DOMAIN_SETTINGS_DISK,
  "fillAssistTargetingRulesMetaByServer",
  {
    deserializer: (value: TargetingRulesDataMeta) => ({
      timestamp: value?.timestamp ?? 0,
    }),
  },
);

/**
 * Browser-specific service responsible for fetching and syncing targeting rules
 * from an external source. Fetches rules on initialization and periodically
 * refreshes them in the background.
 */
export class TargetingRulesDataService {
  static readonly UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  // guard against accidental leaks.
  private _destroy$ = new Subject<void>();
  private _triggerUpdate$ = new Subject<void>();
  private _metaState: GlobalState<Record<string, TargetingRulesDataMeta>>;

  constructor(
    private apiService: ApiService,
    private domainSettingsService: DomainSettingsService,
    private configService: ConfigService,
    private environmentService: EnvironmentService,
    private taskSchedulerService: TaskSchedulerService,
    private globalStateProvider: GlobalStateProvider,
    private logService: LogService,
  ) {
    this._metaState = this.globalStateProvider.get(SERVER_TARGETING_RULES_META);
  }

  /**
   * Initializes the service: checks the feature flag, registers the periodic
   * update task, wires up the background update pipeline, and triggers the
   * first fetch.
   */
  async init(): Promise<void> {
    this.taskSchedulerService.registerTaskHandler(ScheduledTaskNames.targetingRulesUpdate, () =>
      this._triggerUpdate$.next(),
    );

    this.taskSchedulerService.setInterval(
      ScheduledTaskNames.targetingRulesUpdate,
      TargetingRulesDataService.UPDATE_INTERVAL,
    );

    this._triggerUpdate$
      .pipe(
        exhaustMap(() => this._backgroundUpdate()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    // Trigger a fetch whenever the server config changes (e.g. after
    // unlock, account switch, or environment change). The config lags
    // behind environment$, so reacting here ensures _resolveSourceUrl
    // reads the correct config for the active environment.
    this.configService.serverConfig$.pipe(takeUntil(this._destroy$)).subscribe(() => {
      this._triggerUpdate$.next();
    });
  }

  private async _resetMeta(): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const apiUrl = env.getApiUrl();
    await this._metaState.update((existing) => ({
      ...existing,
      [apiUrl]: { timestamp: 0 },
    }));
  }

  dispose(): void {
    // Signal all pipelines to stop and unsubscribe stored subscriptions
    this._destroy$.next();
    this._destroy$.complete();
  }

  private _backgroundUpdate() {
    // Use defer to restart timer if retry is activated
    return defer(() => {
      const startTime = Date.now();

      return from(this._fetchAndStoreRules()).pipe(
        tap(() => {
          const elapsed = Date.now() - startTime;
          this.logService.info(`[TargetingRulesDataService] Update completed in ${elapsed}ms`);
        }),
        retry({
          count: 2,
          delay: (error, retryCount) => {
            this.logService.error(
              `[TargetingRulesDataService] Attempt ${retryCount} failed. Retrying in 5m...`,
              error,
            );

            // Intentionally clear cached rules on first failure rather than
            // retaining potentially stale/invalid data. The risk of acting on
            // outdated rules (e.g. filling wrong fields after a site redesign)
            // outweighs the impact of temporarily falling back to heuristics until
            // the next successful fetch.
            if (retryCount === 1) {
              void this.domainSettingsService.setTargetingRules({});
              void this._resetMeta();
            }

            return timer(5 * 60 * 1000); // 5 minutes
          },
        }),
        catchError((err: unknown) => {
          this.logService.error(
            "[TargetingRulesDataService] All retry attempts failed, deferring to next scheduled check.",
            err,
          );
          return EMPTY;
        }),
      );
    });
  }

  private async _fetchAndStoreRules(): Promise<void> {
    const isEnabled = await this.configService.getFeatureFlag(FeatureFlag.FillAssistTargetingRules);
    if (!isEnabled) {
      this.logService.debug("[TargetingRulesDataService] Feature is not enabled, skipping fetch.");

      return;
    }

    this.logService.info("[TargetingRulesDataService] Update triggered...");

    const env = await firstValueFrom(this.environmentService.environment$);
    const apiUrl = env.getApiUrl();

    const allMeta = await firstValueFrom(this._metaState.state$);
    const meta = allMeta?.[apiUrl];
    const cacheAge = Date.now() - (meta?.timestamp ?? 0);

    if (cacheAge < TargetingRulesDataService.UPDATE_INTERVAL) {
      this.logService.debug("[TargetingRulesDataService] Cache is still fresh, skipping fetch.");
      return;
    }

    const sourceUrl = new URL(await this._resolveSourceUrl());

    // Add query for CDN cache-busting; we're already caching at intervals locally
    sourceUrl.searchParams.set("_", Date.now().toString());

    this.logService.info(
      `[TargetingRulesDataService] Fetching targeting rules from ${sourceUrl.href}`,
    );

    const response = await this.apiService.nativeFetch(new Request(sourceUrl.href));

    if (!response.ok) {
      throw new Error(`Failed to fetch rules: ${response.status} ${response.statusText}`);
    }

    const resource = await response.json();

    if (resource == null || typeof resource !== "object") {
      throw new Error("Invalid targeting rules resource: not an object");
    }

    // Reject incompatible schema versions (current: v1.x)
    const version = resource.schemaVersion;
    if (typeof version === "string" && !version.startsWith("1.")) {
      throw new Error(`Unsupported targeting rules schema version: ${version}`);
    }

    if (
      typeof resource.hosts !== "object" ||
      resource.hosts === null ||
      Array.isArray(resource.hosts)
    ) {
      throw new Error("Invalid targeting rules resource: missing or malformed 'hosts'");
    }

    if (version) {
      this.logService.debug(`[TargetingRulesDataService] Resource schema version: ${version}`);
    }

    const rules: TargetingRulesByDomain = resource.hosts;

    await this.domainSettingsService.setTargetingRules(rules);
    await this._metaState.update((existing) => ({
      ...existing,
      [apiUrl]: { timestamp: Date.now() },
    }));

    this.logService.info(
      `[TargetingRulesDataService] Stored ${Object.keys(rules).length} domain rule sets`,
    );
  }

  /**
   * Resolves the targeting rules source URL by checking the server config first,
   * falling back to the hardcoded default if unavailable.
   */
  private async _resolveSourceUrl(): Promise<string> {
    const serverConfig = await firstValueFrom(this.configService.serverConfig$);
    return serverConfig?.environment?.fillAssistRules || DEFAULT_TARGETING_RULES_SOURCE_URL;
  }
}
