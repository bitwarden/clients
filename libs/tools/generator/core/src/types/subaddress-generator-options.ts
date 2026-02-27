import { IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";

import { UsernameGenerationMode } from "./generator-options";

/** Settings supported when generating an email subaddress */
export type SubaddressGenerationOptions = {
  /** selects the generation algorithm for the catchall email address. */
  subaddressType?: UsernameGenerationMode;

  /** the email address the subaddress is applied to. */
  subaddressEmail?: string;
} & IntegrationRequest;
