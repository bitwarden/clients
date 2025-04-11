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

/** Options common to all forwarder APIs */
export type ApiOptions = ApiSettings & IntegrationRequest;

/** Api configuration for forwarders that support self-hosted installations. */
export type SelfHostedApiOptions = SelfHostedApiSettings & IntegrationRequest;

/** Api configuration for forwarders that support custom domains. */
export type EmailDomainOptions = EmailDomainSettings;

/** Api configuration for forwarders that support custom email parts. */
export type EmailPrefixOptions = EmailDomainSettings & EmailPrefixSettings;

// These options are used by all forwarders; each forwarder uses a different set,
// as defined by `GeneratorMetadata<T>.capabilities.fields`.
export type ForwarderOptions = Partial<
  EmailDomainSettings & EmailPrefixSettings & SelfHostedApiSettings
>;
