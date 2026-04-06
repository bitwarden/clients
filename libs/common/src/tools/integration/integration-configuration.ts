import { IntegrationContext } from "./integration-context";
import { IntegrationMetadata } from "./integration-metadata";
import { ApiSettings, IntegrationRequest, TokenHeader } from "./rpc";

/** Configures integration-wide settings */
export type IntegrationConfiguration = IntegrationMetadata & {
  /** Creates the authentication header for all integration remote procedure calls */
  authenticate: (
    request: IntegrationRequest,
    context: IntegrationContext<ApiSettings>,
  ) => TokenHeader;
};
