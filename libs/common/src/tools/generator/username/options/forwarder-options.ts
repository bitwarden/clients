/** Identifiers for email forwarding services.
 *  @remarks These are used to select forwarder-specific options.
 *  The must be kept in sync with the forwarder implementations.
 */
export type ForwarderId =
  | "anonaddy"
  | "duckduckgo"
  | "fastmail"
  | "firefoxrelay"
  | "forwardemail"
  | "simplelogin";

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
export type ApiOptions = {
  /** bearer token that authenticates bitwarden to the forwarder.
   *  This is required to issue an API request.
   */
  token?: string;
} & RequestOptions;

/** Options that provide contextual information about the application state
 *  when a forwarder is invoked.
 *  @remarks these fields should always be omitted when saving options.
 */
export type RequestOptions = {
  /** @param website The domain of the website the generated email is used
   *  within. This should be set to `null` when the request is not specific
   *  to any website.
   */
  website: string | null;
};

/** Api configuration for forwarders that support self-hosted installations. */
export type SelfHostedApiOptions = ApiOptions & {
  /** The base URL of the forwarder's API.
   *  When this is empty, the forwarder's default production API is used.
   */
  baseUrl: string;
};

/** Api configuration for forwarders that support custom domains. */
export type EmailDomainOptions = {
  /** The domain part of the generated email address.
   *  @remarks The domain should be authorized by the forwarder before
   *           submitting a request through bitwarden.
   *  @example If the domain is `domain.io` and the generated username
   *  is `jd`, then the generated email address will be `jd@mydomain.io`
   */
  domain: string;
};

/** Api configuration for forwarders that support custom email parts. */
export type EmailPrefixOptions = EmailDomainOptions & {
  /** A prefix joined to the generated email address' username.
   *  @example If the prefix is `foo`, the generated username is `bar`,
   *  and the domain is `domain.io`, then the generated email address is `
   *  then the generated username is `foobar@domain.io`.
   */
  prefix: string;
};
