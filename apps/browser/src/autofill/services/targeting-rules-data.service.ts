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
import { FormsMapResource, TargetingRulesByDomain } from "@bitwarden/common/autofill/types";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

const TARGETING_RULES_META_KEY = new KeyDefinition<TargetingRulesDataMeta>(
  DOMAIN_SETTINGS_DISK,
  "fillAssistTargetingRulesMeta",
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
  static readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  // guard against accidental leaks.
  private _destroy$ = new Subject<void>();
  private _triggerUpdate$ = new Subject<void>();
  private _metaState: GlobalState<TargetingRulesDataMeta>;

  constructor(
    private apiService: ApiService,
    private domainSettingsService: DomainSettingsService,
    private configService: ConfigService,
    private taskSchedulerService: TaskSchedulerService,
    private globalStateProvider: GlobalStateProvider,
    private logService: LogService,
  ) {
    this._metaState = this.globalStateProvider.get(TARGETING_RULES_META_KEY);
  }

  /**
   * Initializes the service: checks the feature flag, registers the periodic
   * update task, wires up the background update pipeline, and triggers the
   * first fetch.
   */
  async init(): Promise<void> {
    const isEnabled = await this.configService.getFeatureFlag(FeatureFlag.FillAssistTargetingRules);

    if (!isEnabled) {
      return;
    }

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

    // Trigger initial update
    this._triggerUpdate$.next();
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
      this.logService.info("[TargetingRulesDataService] Update triggered...");

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
            return timer(5 * 60 * 1000);
          },
        }),
        catchError((err: unknown) => {
          this.logService.error("[TargetingRulesDataService] All retry attempts failed.", err);
          return EMPTY;
        }),
      );
    });
  }

  private async _fetchAndStoreRules(): Promise<void> {
    const meta = await firstValueFrom(this._metaState.state$);
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

    try {
      const response = await this.apiService.nativeFetch(new Request(sourceUrl.href));

      if (!response.ok) {
        throw new Error(`Failed to fetch rules: ${response.status} ${response.statusText}`);
      }

      const resource: FormsMapResource = await response.json();
      const rules: TargetingRulesByDomain = resource?.hosts ?? {};

      if (resource?.version) {
        this.logService.debug(
          `[TargetingRulesDataService] Resource schema version: ${resource.version}`,
        );
      }

      await this.domainSettingsService.setTargetingRules(rules);
      await this._metaState.update(() => ({ timestamp: Date.now() }));

      this.logService.info(
        `[TargetingRulesDataService] Stored ${Object.keys(rules).length} domain rule sets`,
      );
    } catch (error: unknown) {
      this.logService.warning(
        "[TargetingRulesDataService] Resource unavailable, storing empty rules.",
        error,
      );
      // Intentionally clear cached rules on failure rather than retaining
      // potentially stale/invalid data. The risk of acting on outdated rules
      // (e.g. filling wrong fields after a site redesign) outweighs the impact of
      // temporarily falling back to heuristics until the next successful fetch.
      await this.domainSettingsService.setTargetingRules({});
    }
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
