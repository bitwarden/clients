import { IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";

/** Settings supported when generating a username using the EFF word list */
export type EffUsernameGenerationOptions = {
  /** when true, the word is capitalized */
  wordCapitalize?: boolean;

  /** when true, a random number is appended to the username */
  wordIncludeNumber?: boolean;
} & IntegrationRequest;
