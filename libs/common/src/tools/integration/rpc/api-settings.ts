/** Options common to all forwarder APIs */
export type ApiSettings = {
  /** bearer token that authenticates bitwarden to the forwarder.
   *  This is required to issue an API request.
   */
  token?: string;
};

/** Api configuration for forwarders that support self-hosted installations. */
export type SelfHostedApiSettings = ApiSettings & {
  /** The base URL of the forwarder's API.
   *  When this is empty, the forwarder's default production API is used.
   */
  baseUrl: string;
};
