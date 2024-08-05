/** Api configuration for forwarders that support custom domains. */
export type EmailDomainSettings = {
  /** The domain part of the generated email address.
   *  @remarks The domain should be authorized by the forwarder before
   *           submitting a request through bitwarden.
   *  @example If the domain is `domain.io` and the generated username
   *  is `jd`, then the generated email address will be `jd@domain.io`
   */
  domain: string;
};

/** Api configuration for forwarders that support custom email parts. */
export type EmailPrefixSettings = {
  /** A prefix joined to the generated email address' username.
   *  @example If the prefix is `foo`, the generated username is `bar`,
   *  and the domain is `domain.io`, then the generated email address is `
   *  then the generated username is `foobar@domain.io`.
   */
  prefix: string;
};
