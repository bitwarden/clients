import { IntegrationId } from "@bitwarden/common/tools/integration";
import {
  ApiSettings,
  IntegrationRequest,
  SelfHostedApiSettings,
} from "@bitwarden/common/tools/integration/rpc";

import { EmailDomainSettings, EmailPrefixSettings } from "../engine";

// FIXME: this type alias is in place for legacy support purposes;
//   when replacing the forwarder implementation, eliminate `ForwarderId` and
//   `IntegrationId`. The proper type is `VendorId`.
/** Identifiers for email forwarding services.
 *  @remarks These are used to select forwarder-specific options.
 *  The must be kept in sync with the forwarder implementations.
 */
export type ForwarderId = IntegrationId;

/** Options common to all forwarder APIs
 *  @deprecated use {@link ForwarderOptions} instead.
 */
export type ApiOptions = ApiSettings & IntegrationRequest;

/** Api configuration for forwarders that support self-hosted installations.
 *  @deprecated use {@link ForwarderOptions} instead.
 */
export type SelfHostedApiOptions = SelfHostedApiSettings & IntegrationRequest;

/** Api configuration for forwarders that support custom domains.
 *  @deprecated use {@link ForwarderOptions} instead.
 */
export type EmailDomainOptions = EmailDomainSettings;

/** Api configuration for forwarders that support custom email parts.
 *  @deprecated use {@link ForwarderOptions} instead.
 */
export type EmailPrefixOptions = EmailDomainSettings & EmailPrefixSettings;

/** These options are used by all forwarders; each forwarder uses a different set,
 *   as defined by `GeneratorMetadata<T>.capabilities.fields`.
 */
export type ForwarderOptions = Partial<
  {
    /** bearer token that authenticates bitwarden to the forwarder.
     *  This is required to issue an API request.
     */
    token: string;

    /** The base URL of the forwarder's API.
     *  When this is undefined or empty, the forwarder's default production API is used.
     */
    baseUrl: string;

    /** The domain part of the generated email address.
     *  @remarks The domain should be authorized by the forwarder before
     *           submitting a request through bitwarden.
     *  @example If the domain is `domain.io` and the generated username
     *  is `jd`, then the generated email address will be `jd@domain.io`
     */
    domain: string;

    /** A prefix joined to the generated email address' username.
     *  @example If the prefix is `foo`, the generated username is `bar`,
     *  and the domain is `domain.io`, then the generated email address is
     *  `foobar@domain.io`.
     */
    prefix: string;
  } & EmailDomainSettings &
    EmailPrefixSettings &
    SelfHostedApiSettings
>;
