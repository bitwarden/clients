import { CredentialGenerator, GeneratorDependencyProvider } from "../types";

import { AlgorithmMetadata } from "./algorithm-metadata";
import { Profile } from "./data";
import { ProfileMetadata } from "./profile-metadata";

/** Extends the algorithm metadata with storage and engine configurations.
 * @example
 *   // Use `isForwarderIntegration(algorithm: CredentialAlgorithm)`
 *   // to pattern test whether the credential describes a forwarder algorithm
 *   const meta : CredentialGeneratorInfo = // ...
 *   const { forwarder } = isForwarderIntegration(meta.id) ? credentialId : {};
 */
export type GeneratorMetadata<Options> = AlgorithmMetadata & {
  /** An algorithm that generates credentials when ran. */
  engine: {
    /** Factory for the generator
     */
    create: (randomizer: GeneratorDependencyProvider) => CredentialGenerator<Options>;
  };

  /** Defines parameters for credential generation */
  profiles: {
    /** profiles supported by this generator; when `undefined`,
     * the generator does not support the profile.
     */
    [K in keyof typeof Profile]?: ProfileMetadata<Options>;
  };
};
