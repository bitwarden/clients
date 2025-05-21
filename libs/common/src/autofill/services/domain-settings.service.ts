// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { map, Observable, switchMap, of } from "rxjs";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import {
  NeverDomains,
  EquivalentDomains,
  UriMatchStrategySetting,
  UriMatchStrategy,
} from "../../models/domain/domain-service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { Utils } from "../../platform/misc/utils";
import {
  DOMAIN_SETTINGS_DISK,
  ActiveUserState,
  GlobalState,
  KeyDefinition,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { UserId } from "../../types/guid";

const SHOW_FAVICONS = new KeyDefinition(DOMAIN_SETTINGS_DISK, "showFavicons", {
  deserializer: (value: boolean) => value ?? true,
});

// Domain exclusion list for notifications
const NEVER_DOMAINS = new KeyDefinition(DOMAIN_SETTINGS_DISK, "neverDomains", {
  deserializer: (value: NeverDomains) => value ?? null,
});

// Domain exclusion list for content script injections
const BLOCKED_INTERACTIONS_URIS = new KeyDefinition(
  DOMAIN_SETTINGS_DISK,
  "blockedInteractionsUris",
  {
    deserializer: (value: NeverDomains) => value ?? {},
  },
);

const EQUIVALENT_DOMAINS = new UserKeyDefinition(DOMAIN_SETTINGS_DISK, "equivalentDomains", {
  deserializer: (value: EquivalentDomains) => value ?? null,
  clearOn: ["logout"],
});

const DEFAULT_URI_MATCH_STRATEGY = new UserKeyDefinition(
  DOMAIN_SETTINGS_DISK,
  "defaultUriMatchStrategy",
  {
    deserializer: (value: UriMatchStrategySetting) => value ?? UriMatchStrategy.Domain,
    clearOn: [],
  },
);

/**
 * The Domain Settings service; provides client settings state for "active client view" URI concerns
 */
export abstract class DomainSettingsService {
  /**
   * Indicates if the favicons for ciphers' URIs should be shown instead of a placeholder
   */
  showFavicons$: Observable<boolean>;
  setShowFavicons: (newValue: boolean) => Promise<void>;

  /**
   * User-specified URIs for which the client notifications should not appear
   */
  neverDomains$: Observable<NeverDomains>;
  setNeverDomains: (newValue: NeverDomains) => Promise<void>;

  /**
   * User-specified URIs for which client content script injections should not occur, and the state
   * of banner/notice visibility for those domains within the client
   */
  blockedInteractionsUris$: Observable<NeverDomains>;
  setBlockedInteractionsUris: (newValue: NeverDomains) => Promise<void>;

  /**
   * URIs which should be treated as equivalent to each other for various concerns (autofill, etc)
   */
  equivalentDomains$: Observable<EquivalentDomains>;
  setEquivalentDomains: (newValue: EquivalentDomains, userId: UserId) => Promise<void>;

  /**
   * User-specified default for URI-matching strategies (for example, when determining relevant
   * ciphers for an active browser tab). Can be overridden by cipher-specific settings.
   */
  defaultUriMatchStrategy$: Observable<UriMatchStrategySetting>;
  setDefaultUriMatchStrategy: (newValue: UriMatchStrategySetting) => Promise<void>;

  /**
   * Helper function for the common resolution of a given URL against equivalent domains
   */
  getUrlEquivalentDomains: (url: string) => Observable<Set<string>>;
}

export class DefaultDomainSettingsService implements DomainSettingsService {
  private showFaviconsState: GlobalState<boolean>;
  readonly showFavicons$: Observable<boolean>;

  private neverDomainsState: GlobalState<NeverDomains>;
  readonly neverDomains$: Observable<NeverDomains>;

  private blockedInteractionsUrisState: GlobalState<NeverDomains>;
  readonly blockedInteractionsUris$: Observable<NeverDomains>;

  private equivalentDomainsState: ActiveUserState<EquivalentDomains>;
  readonly equivalentDomains$: Observable<EquivalentDomains>;

  private defaultUriMatchStrategyState: ActiveUserState<UriMatchStrategySetting>;
  readonly defaultUriMatchStrategy$: Observable<UriMatchStrategySetting>;

  constructor(
    private stateProvider: StateProvider,
    private configService: ConfigService,
  ) {
    this.showFaviconsState = this.stateProvider.getGlobal(SHOW_FAVICONS);
    this.showFavicons$ = this.showFaviconsState.state$.pipe(map((x) => x ?? true));

    this.neverDomainsState = this.stateProvider.getGlobal(NEVER_DOMAINS);
    this.neverDomains$ = this.neverDomainsState.state$.pipe(map((x) => x ?? null));

    // Needs to be global to prevent pre-login injections
    this.blockedInteractionsUrisState = this.stateProvider.getGlobal(BLOCKED_INTERACTIONS_URIS);

    this.blockedInteractionsUris$ = this.configService
      .getFeatureFlag$(FeatureFlag.BlockBrowserInjectionsByDomain)
      .pipe(
        switchMap((featureIsEnabled) =>
          featureIsEnabled ? this.blockedInteractionsUrisState.state$ : of({} as NeverDomains),
        ),
        map((disabledUris) => (Object.keys(disabledUris).length ? disabledUris : {})),
      );

    this.equivalentDomainsState = this.stateProvider.getActive(EQUIVALENT_DOMAINS);
    this.equivalentDomains$ = this.equivalentDomainsState.state$.pipe(map((x) => x ?? null));

    this.defaultUriMatchStrategyState = this.stateProvider.getActive(DEFAULT_URI_MATCH_STRATEGY);
    this.defaultUriMatchStrategy$ = this.defaultUriMatchStrategyState.state$.pipe(
      map((x) => x ?? UriMatchStrategy.Domain),
    );
  }

  async setShowFavicons(newValue: boolean): Promise<void> {
    await this.showFaviconsState.update(() => newValue);
  }

  async setNeverDomains(newValue: NeverDomains): Promise<void> {
    await this.neverDomainsState.update(() => newValue);
  }

  async setBlockedInteractionsUris(newValue: NeverDomains): Promise<void> {
    await this.blockedInteractionsUrisState.update(() => newValue);
  }

  async setEquivalentDomains(newValue: EquivalentDomains, userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, EQUIVALENT_DOMAINS).update(() => newValue);
  }

  async setDefaultUriMatchStrategy(newValue: UriMatchStrategySetting): Promise<void> {
    await this.defaultUriMatchStrategyState.update(() => newValue);
  }

  getUrlEquivalentDomains(url: string): Observable<Set<string>> {
    const domains$ = this.equivalentDomains$.pipe(
      map((equivalentDomains) => {
        const domain = Utils.getDomain(url);
        if (domain == null || equivalentDomains == null) {
          return new Set() as Set<string>;
        }

        const equivalents = equivalentDomains.filter((ed) => ed.includes(domain)).flat();

        return new Set(equivalents);
      }),
    );

    return domains$;
  }
}
