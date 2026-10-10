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

  /** The exact `baseUrl` value the user has deliberately approved for use even though it
   *  isn't https or targets a local/private network address. Only takes effect when it
   *  matches the current `baseUrl` exactly — changing `baseUrl` afterwards requires a fresh
   *  approval. Never set by import; only the settings UI may write this field.
   */
  allowUnsafeUrlFor?: string;
};
