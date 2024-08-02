import { IntegrationId } from "@bitwarden/common/tools/integration";
import {
  ApiSettings,
  IntegrationRequest,
  SelfHostedApiSettings,
} from "@bitwarden/common/tools/integration/rpc";

import { EmailDomainSettings, EmailPrefixSettings } from "../engine";

/** Identifiers for email forwarding services.
 *  @remarks These are used to select forwarder-specific options.
 *  The must be kept in sync with the forwarder implementations.
 */
export type ForwarderId = IntegrationId;

/** Metadata format for email forwarding services. */
export type ForwarderMetadata = {
  /** The unique identifier for the forwarder. */
  id: ForwarderId;

  /** The name of the service the forwarder queries. */
  name: string;

  /** Whether the forwarder is valid for self-hosted instances of Bitwarden. */
  validForSelfHosted: boolean;
};

/** Options common to all forwarder APIs */
export type ApiOptions = ApiSettings & IntegrationRequest;

/** Api configuration for forwarders that support self-hosted installations. */
export type SelfHostedApiOptions = SelfHostedApiSettings & IntegrationRequest;

/** Api configuration for forwarders that support custom domains. */
export type EmailDomainOptions = EmailDomainSettings;

/** Api configuration for forwarders that support custom email parts. */
export type EmailPrefixOptions = EmailDomainSettings & EmailPrefixSettings;
