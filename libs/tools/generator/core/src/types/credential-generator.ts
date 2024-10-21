import { GenerationRequest } from "@bitwarden/common/tools/types";

import { GeneratedCredential } from "./generated-credential";
import { CredentialAlgorithm } from "./generator-type";

/** An algorithm that generates credentials. */
export type CredentialGenerator<Settings> = {
  /** Generates a credential
   *  @param request runtime parameters
   *  @param settings stored parameters
   */
  generate: (
    request: GenerationRequest,
    algorithm: CredentialAlgorithm,
    settings: Settings,
  ) => Promise<GeneratedCredential>;
};
