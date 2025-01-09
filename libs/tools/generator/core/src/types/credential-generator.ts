import { GenerationRequest } from "@bitwarden/common/tools/types";

import { GeneratedCredential } from "./generated-credential";

/** An algorithm that generates credentials. */
export type CredentialGenerator<Settings> = {
  /** Generates a credential
   *  @param request runtime parameters
   *  @param settings stored parameters
   */
  generate: (request: GenerationRequest, settings: Settings) => Promise<GeneratedCredential>;
};
