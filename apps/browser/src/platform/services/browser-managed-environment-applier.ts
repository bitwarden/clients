import { concatMap, filter, firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { ENVIRONMENT_DISK, GlobalState, KeyDefinition, StateProvider } from "@bitwarden/state";

import { GroupPolicyEnvironment } from "../../admin-console/types/group-policy-environment";

import { BrowserEnvironmentService, sameManagedEnvironment } from "./browser-environment.service";

/**
 * The managed environment this client last applied, stored exactly as it was read from the
 * profile. `setEnvironment` normalizes what it writes, so comparing against the effective
 * environment would never match and the applier would rewrite on every service worker start.
 */
const LAST_APPLIED_MANAGED_ENVIRONMENT = new KeyDefinition<GroupPolicyEnvironment>(
  ENVIRONMENT_DISK,
  "lastAppliedManagedEnvironment",
  { deserializer: (value) => value },
);

/**
 * Keeps the global environment in step with the administrator's `environment.*` settings.
 *
 * The browser populates managed storage asynchronously and an administrator may deploy a policy
 * long after the extension started, so applying once at install time loses any policy that arrives
 * late. This applies whenever the managed environment changes instead.
 *
 * Only the change is acted on: the last applied environment is persisted and compared, so a
 * service worker restart — which re-pushes the same profile — writes nothing and cannot undo a
 * url the user set themselves.
 *
 * Managed settings are administrator configuration rather than vault data and involve no
 * cryptography. They are still kept out of the log, because a url can disclose an organization's
 * self-hosted infrastructure; only key names and counts are written.
 */
export class BrowserManagedEnvironmentApplier {
  private readonly lastApplied: GlobalState<GroupPolicyEnvironment>;

  constructor(
    private readonly environmentService: BrowserEnvironmentService,
    stateProvider: StateProvider,
    private readonly logService: LogService,
  ) {
    this.lastApplied = stateProvider.getGlobal(LAST_APPLIED_MANAGED_ENVIRONMENT);
  }

  init(): void {
    this.environmentService.managedEnvironment$
      .pipe(
        // An absent environment means the administrator forces none, so control belongs to the
        // user and the urls already applied stay. This also absorbs the empty profile that exists
        // before acquisition completes, which is indistinguishable from a withdrawn policy.
        filter((environment): environment is GroupPolicyEnvironment => environment != null),
        // Serialized so that two policy changes in quick succession apply in order, and so the
        // read-compare-write below cannot interleave with itself.
        concatMap((environment) => this.apply(environment)),
      )
      .subscribe();
  }

  private async apply(environment: GroupPolicyEnvironment): Promise<void> {
    try {
      const lastApplied = await firstValueFrom(this.lastApplied.state$);
      if (sameManagedEnvironment(lastApplied, environment)) {
        return;
      }

      await this.environmentService.setUrlsToManagedEnvironment(environment);
      // Recorded after the write, so a termination in between re-applies the same environment on
      // the next start. The reverse order would drop it permanently.
      await this.lastApplied.update(() => environment);

      this.logService.info(
        `Managed environment: applied ${Object.keys(environment).length} url(s).`,
        Object.keys(environment).sort(),
      );
    } catch (e) {
      // Swallowed so the subscription survives. Letting it tear down would leave the client
      // ignoring every later policy change for the lifetime of the service worker.
      this.logService.error(
        "Managed environment: failed to apply.",
        e instanceof Error ? e.message : e,
      );
    }
  }
}
