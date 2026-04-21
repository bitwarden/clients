import {
  catchError,
  defer,
  EMPTY,
  firstValueFrom,
  from,
  retry,
  Subject,
  switchMap,
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

/** Fallback manifest URI when the server does not provide one */
const DEFAULT_MANIFEST_URL =
  "https://github.com/bitwarden/map-the-web/releases/latest/download/manifest.json";

/** Manifest key for the forms map version this client targets */
const TARGET_FORMS_VERSION = "v1";

type TargetingRulesDataMeta = {
  /** The last time the data source was checked */
  timestamp: number;
  /** Content hash (cid) of the forms map file last stored to state */
  cid?: string;
};

const SERVER_TARGETING_RULES_META = KeyDefinition.record<TargetingRulesDataMeta, string>(
  DOMAIN_SETTINGS_DISK,
  "fillAssistTargetingRulesMetaByServer",
  {
    deserializer: (value: TargetingRulesDataMeta) => ({
      timestamp: value?.timestamp ?? 0,
      cid: value?.cid,
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
  /** Emits `true` to skip the cache-age check, `false`/`undefined` for normal interval */
  private _triggerUpdate$ = new Subject<boolean>();
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
      this._triggerUpdate$.next(false),
    );

    this.taskSchedulerService.setInterval(
      ScheduledTaskNames.targetingRulesUpdate,
      TargetingRulesDataService.UPDATE_INTERVAL,
    );

    this._triggerUpdate$
      .pipe(
        // switchMap cancels any in-progress update (including retry delays)
        // when a new trigger arrives, ensuring account/environment switches
        // are not blocked by a stale retry chain
        switchMap((skipCacheAgeCheck) => this._backgroundUpdate(skipCacheAgeCheck)),
        takeUntil(this._destroy$),
      )
      .subscribe();

    // Trigger a fetch whenever the server config changes (e.g. after
    // unlock, account switch, or environment change). The config lags
    // behind environment$, so reacting here ensures _resolveManifestUrl
    // reads the correct config for the active environment.
    this.configService.serverConfig$.pipe(takeUntil(this._destroy$)).subscribe(() => {
      this._triggerUpdate$.next(false);
    });
  }

  /**
   * Forces an immediate manifest check, bypassing the cache-age interval.
   * The manifest cid comparison still prevents unnecessary downloads.
   * Intended for user-initiated actions (e.g. vault sync).
   */
  forceUpdate(): void {
    this._triggerUpdate$.next(true);
  }

  private async _resetMeta(): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const apiUrl = env.getApiUrl();
    await this._metaState.update((existing) => ({
      ...existing,
      [apiUrl]: { cid: undefined, timestamp: 0 },
    }));
  }

  dispose(): void {
    // Signal all pipelines to stop and unsubscribe stored subscriptions
    this._destroy$.next();
    this._destroy$.complete();
  }

  private _backgroundUpdate(skipCacheAgeCheck = false) {
    // Use defer to restart timer if retry is activated
    return defer(() => {
      const startTime = Date.now();

      return from(this._fetchAndStoreRules(skipCacheAgeCheck)).pipe(
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

  private async _fetchAndStoreRules(skipCacheAgeCheck = false): Promise<void> {
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

    if (!skipCacheAgeCheck && cacheAge < TargetingRulesDataService.UPDATE_INTERVAL) {
      this.logService.debug("[TargetingRulesDataService] Cache is still fresh, skipping fetch.");
      return;
    }

    const manifestUrl = await this._resolveManifestUrl();

    // Step 1: Fetch the lightweight manifest to check if the data has changed
    this.logService.info(`[TargetingRulesDataService] Checking manifest at ${manifestUrl}`);

    // Add CDN cache-buster
    const manifestRequestURL = new URL(manifestUrl);
    manifestRequestURL.searchParams.set("_", Date.now().toString());

    const manifestResponse = await this.apiService.nativeFetch(
      new Request(manifestRequestURL.href),
    );
    if (!manifestResponse.ok) {
      throw new Error(
        `Failed to fetch manifest: ${manifestResponse.status} ${manifestResponse.statusText}`,
      );
    }

    const manifest = await manifestResponse.json();

    // Locate the forms map entry for our target version
    const formsEntry = manifest?.maps?.forms?.[TARGET_FORMS_VERSION];
    if (
      !formsEntry?.filename ||
      typeof formsEntry.filename !== "string" ||
      !formsEntry.filename.endsWith(".json") ||
      formsEntry.filename.includes("/") ||
      formsEntry.filename.includes("\\")
    ) {
      throw new Error(`Manifest contains no valid forms map entry for ${TARGET_FORMS_VERSION}`);
    }

    const remoteCid = formsEntry.cid;

    // If the content hash matches, the data hasn't changed; skip download
    if (remoteCid && meta?.cid && meta.cid === remoteCid) {
      this.logService.debug(
        `[TargetingRulesDataService] Data unchanged (cid match), skipping download.`,
      );
      await this._metaState.update((existing) => ({
        ...existing,
        [apiUrl]: { ...meta, timestamp: Date.now() },
      }));
      return;
    }

    // Step 2: Data has changed (or first fetch); download the map file
    const formsMapUrl = new URL(formsEntry.filename, manifestRequestURL.href).href;
    this.logService.info(`[TargetingRulesDataService] Fetching updated data from ${formsMapUrl}`);

    const response = await this.apiService.nativeFetch(new Request(formsMapUrl));
    if (!response.ok) {
      throw new Error(`Failed to fetch rules: ${response.status} ${response.statusText}`);
    }

    const resource = await response.json();

    if (resource == null || typeof resource !== "object") {
      throw new Error("Invalid targeting rules resource: not an object");
    }

    if (
      typeof resource.hosts !== "object" ||
      resource.hosts === null ||
      Array.isArray(resource.hosts)
    ) {
      throw new Error("Invalid targeting rules resource: missing or malformed 'hosts'");
    }

    const rules: TargetingRulesByDomain = resource.hosts;

    await this.domainSettingsService.setTargetingRules(rules);
    await this._metaState.update((existing) => ({
      ...existing,
      [apiUrl]: { timestamp: Date.now(), cid: remoteCid },
    }));

    this.logService.info(
      `[TargetingRulesDataService] Stored ${Object.keys(rules).length} domain rule sets`,
    );
  }

  /**
   * Resolves the manifest URL by checking the server config first,
   * falling back to the hardcoded default.
   */
  private async _resolveManifestUrl(): Promise<string> {
    const serverConfig = await firstValueFrom(this.configService.serverConfig$);
    return serverConfig?.environment?.fillAssistRules || DEFAULT_MANIFEST_URL;
  }
}
