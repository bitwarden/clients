// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, distinctUntilChanged, map, Observable } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Region, RegionConfig } from "@bitwarden/common/platform/abstractions/environment.service";
import { DefaultEnvironmentService } from "@bitwarden/common/platform/services/default-environment.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { ManagedSettingsService } from "@bitwarden/managed-settings";

import { GroupPolicyEnvironment } from "../../admin-console/types/group-policy-environment";
import { devFlagEnabled, devFlagValue } from "../flags";

const MANAGED_ENVIRONMENT_FIELDS: readonly (keyof GroupPolicyEnvironment)[] = [
  "base",
  "webVault",
  "api",
  "identity",
  "icons",
  "notifications",
  "events",
];

/**
 * Field-by-field equality over the managed environment fields.
 *
 * Compares the values as read from the profile rather than the urls they produce, so an
 * administrator who forces an empty string stays distinguishable from one who does not force the
 * field at all.
 */
export function sameManagedEnvironment(
  a: GroupPolicyEnvironment | null,
  b: GroupPolicyEnvironment | null,
): boolean {
  if (a == null || b == null) {
    return a == b;
  }

  return MANAGED_ENVIRONMENT_FIELDS.every((field) => a[field] === b[field]);
}

export class BrowserEnvironmentService extends DefaultEnvironmentService {
  /**
   * {@link getManagedEnvironment}, re-read whenever a pushed profile changes it.
   *
   * `BrowserManagedEnvironmentApplier` subscribes in the background and writes the result to the
   * global environment, so the popup observes an applied policy through {@link environment$}
   * rather than through this stream.
   */
  readonly managedEnvironment$: Observable<GroupPolicyEnvironment | null>;

  /**
   * @param managedSettingsService - Source of the administrator's `environment.*` settings. In a
   *   released build only the background's instance is fed, by `BrowserManagedConfigReader`, so
   *   the popup's instance is empty and {@link managedEnvironment$} never emits anything but
   *   `null` there. Under the `managedSettingsDevSource` dev flag the background skips the reader
   *   and both contexts are seeded from the flag instead, so the popup's stream emits as well.
   */
  constructor(
    stateProvider: StateProvider,
    accountService: AccountService,
    private managedSettingsService: ManagedSettingsService,
    additionalRegionConfigs: RegionConfig[] = [],
  ) {
    super(stateProvider, accountService, additionalRegionConfigs);

    this.managedEnvironment$ = combineLatest(
      MANAGED_ENVIRONMENT_FIELDS.map((field) =>
        this.managedSettingsService.get$(`environment.${field}`),
      ),
    ).pipe(
      // The emitted values are discarded on purpose. A profile push reaches the seven subscriptions
      // one at a time, so `combineLatest` emits once per changed key and every emission but the
      // last carries a half-updated tuple. Re-reading the profile instead yields the same, fully
      // updated environment for each of them, which `distinctUntilChanged` then collapses to one.
      map(() => this.getManagedEnvironment()),
      distinctUntilChanged(sameManagedEnvironment),
    );
  }

  /**
   * The administrator's environment, reconstructed from the `environment.*` leaves of the active
   * management profile, or `null` when none of them is managed.
   *
   * The `managedEnvironment` dev flag overrides this, returning its value verbatim without reading
   * the profile.
   */
  getManagedEnvironment(): GroupPolicyEnvironment | null {
    if (devFlagEnabled("managedEnvironment")) {
      return devFlagValue("managedEnvironment");
    }

    let managed = false;
    const environment: GroupPolicyEnvironment = {};
    for (const field of MANAGED_ENVIRONMENT_FIELDS) {
      // Absence, not falsiness: presence in the profile means the value is forced, so an
      // administrator who sets an empty string has forced an empty string.
      const raw = this.managedSettingsService.get(`environment.${field}`);
      if (raw === undefined) {
        continue;
      }

      managed = true;
      // Unguarded because every writer reaches the profile through `flattenSettings`, which
      // JSON-encodes each leaf. A stored value is always decodable.
      environment[field] = JSON.parse(raw) as string;
    }

    return managed ? environment : null;
  }

  /**
   * Apply an administrator's environment as the self-hosted environment.
   *
   * Takes the environment rather than re-reading it, so the caller applies the value it observed
   * and decided on and a profile arriving in between cannot substitute a different one.
   */
  async setUrlsToManagedEnvironment(environment: GroupPolicyEnvironment) {
    await this.setEnvironment(Region.SelfHosted, {
      base: environment.base,
      webVault: environment.webVault,
      api: environment.api,
      identity: environment.identity,
      icons: environment.icons,
      notifications: environment.notifications,
      events: environment.events,
    });
  }
}
