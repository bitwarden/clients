import { RequireExactlyOne } from "type-fest";

import { CredentialType, GeneratorProfile, CredentialAlgorithm } from "../metadata";

/** Contextual information about the application state when a generator is invoked.
 */
export type GenerateRequest = RequireExactlyOne<
  { type: CredentialType; algorithm: CredentialAlgorithm },
  "type" | "algorithm"
> & {
  profile?: GeneratorProfile;

  /** Traces the origin of the generation request. This parameter is
   *  copied to the generated credential.
   *
   *  @remarks This parameter it is provided solely so that generator
   *  consumers can differentiate request sources from one another.
   *  It never affects the random output of the generator algorithms,
   *  and it is never communicated to 3rd party systems. It MAY be
   *  tracked in the generator history.
   */
  source?: string;

  /** Traces the website associated with a generated credential.
   *
   *  @remarks  Random generators MUST NOT depend upon the website during credential
   *   generation. Non-random generators MAY include the website in the generated
   *   credential (e.g. a catchall email address). This parameter MAY be transmitted
   *   to 3rd party systems (e.g. as the description for a forwarding email).
   *   It MAY be tracked in the generator history.
   */
  website?: string;
};
