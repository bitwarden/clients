import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { SiteId } from "@bitwarden/common/tools/extension";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";
import { Constraints } from "@bitwarden/common/tools/types";

import { GeneratorConstraints } from "../types";

export type ProfileContext<Options> = {
  /** The email address for the current user;
   *  `undefined` when no email is available.
   */
  email?: string;

  /** Default application limits for the profile */
  defaultConstraints: Constraints<Options>;
};

type ProfileConstraints<Options> = {
  /** The key used to locate this profile's policies in the admin console.
   *  When this type is undefined, no policy is defined for the profile.
   */
  type?: PolicyType;

  /** default application limits for this profile; these are overridden
   *  by the policy
   */
  default: Constraints<Options>;

  /** Constructs generator constraints from a policy.
   *  @param policies the administrative policy to apply to the provided constraints
   *  When `type` is undefined then `policy` is `undefined` this is an empty array.
   *  @param defaultConstraints application constraints; typically those defined in
   *   the `default` member, above.
   *  @returns the generator constraints to apply to this profile's options.
   */
  create: (policies: Policy[], context: ProfileContext<Options>) => GeneratorConstraints<Options>;
};

/** Generator profiles partition generator operations
 *  according to where they're used within the password
 *  manager. Core profiles store their data using the
 *  generator's system storage.
 */
export type CoreProfileMetadata<Options> = {
  /** distinguishes profile metadata types */
  type: "core";

  /** plaintext import buffer */
  import?: ObjectKey<Options, Record<string, never>, Options> & { format: "plain" };

  /** persistent storage location */
  storage: ObjectKey<Options>;

  /** policy enforced when saving the options */
  constraints: ProfileConstraints<Options>;
};

/** Generator profiles partition generator operations
 *  according to where they're used within the password
 *  manager. Extension profiles store their data
 *  using the extension system.
 */
export type ExtensionProfileMetadata<Options, Site extends SiteId> = {
  /** distinguishes profile metadata types */
  type: "extension";

  /** The extension site described by this metadata */
  site: Site;

  constraints: ProfileConstraints<Options>;
};

/** Generator profiles partition generator operations
 *  according to where they're used within the password
 *  manager
 */
export type ProfileMetadata<Options> =
  | CoreProfileMetadata<Options>
  | ExtensionProfileMetadata<Options, "forwarder">;
