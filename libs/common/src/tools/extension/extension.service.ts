import { shareReplay } from "rxjs";

import { SemanticLogger } from "@bitwarden/logging";

import { Account } from "../../auth/abstractions/account.service";
import { BoundDependency } from "../dependencies";
import { UserStateSubject } from "../state/user-state-subject";
import { UserStateSubjectDependencyProvider } from "../state/user-state-subject-dependency-provider";

import { ExtensionRegistry } from "./extension-registry.abstraction";
import { ExtensionProfileMetadata, SiteId, VendorId } from "./type";
import { toObjectKey } from "./util";

/** Provides configuration and storage support for Bitwarden client extensions.
 *  These extensions integrate 3rd party services into Bitwarden.
 */
export class ExtensionService {
  /** Instantiate the extension service.
   *  @param registry provides runtime status for extension sites
   *  @param providers provide persistent data
   */
  constructor(
    private registry: ExtensionRegistry,
    private readonly providers: UserStateSubjectDependencyProvider,
  ) {
    this.log = providers.log({
      type: "ExtensionService",
    });
  }

  private log: SemanticLogger;

  /** Get a subject bound to a user's extension settings
   * @param profile the site's extension profile
   * @param vendor the vendor integrated at the extension site
   * @param dependencies.account$ the account to which the settings are bound
   * @returns a subject bound to the requested user's generator settings
   */
  settings<Settings extends object, Site extends SiteId>(
    profile: ExtensionProfileMetadata<Settings, Site>,
    vendor: VendorId,
    dependencies: BoundDependency<"account", Account>,
  ): UserStateSubject<Settings> {
    const metadata = this.registry.extension(profile.site, vendor);
    if (!metadata) {
      this.log.panic({ site: profile.site as string, vendor }, "extension not defined");
    }

    const key = toObjectKey(profile, metadata);
    const account$ = dependencies.account$.pipe(shareReplay({ bufferSize: 1, refCount: true }));
    // FIXME: load and apply constraints
    const subject = new UserStateSubject(key, this.providers, { account$ });

    return subject;
  }

  /** Look up extension metadata for a site
   *  @param site defines the site to retrieve.
   *  @returns the extensions available at the site.
   */
  site(site: SiteId) {
    return this.registry.build(site);
  }
}
