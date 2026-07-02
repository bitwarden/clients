import { IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";

/** Settings supported when generating a login email address */
export type LoginEmailGenerationOptions = {
  /** the user's login email address */
  email?: string;
} & IntegrationRequest;
