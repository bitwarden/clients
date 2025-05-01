import { GenerateRequest } from "./generate-request";
import { GeneratedCredential } from "./generated-credential";

/** An algorithm that generates credentials. */
export type CredentialGenerator<Settings> = {
  /** Generates a credential
   *  @param request runtime parameters
   *  @param settings stored parameters
   */
  generate: (request: GenerateRequest, settings: Settings) => Promise<GeneratedCredential>;
};
