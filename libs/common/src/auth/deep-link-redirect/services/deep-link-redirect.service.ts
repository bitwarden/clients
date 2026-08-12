/**
 * Persists a URL for the deep-link route guard to replay once the user reaches an unlocked
 * state. Callers use this to pipe a post-login redirect through intermediate auth stops
 * (2FA, set-initial-password, key-connector) without threading state through each one.
 *
 * The guard replay is web-only; non-web platforms bind a no-op so callers stay platform-agnostic.
 */
export abstract class DeepLinkRedirectService {
  /**
   * Persist a fully-formed URL (path + query) for the deep-link guard to replay after
   * auth completes. Overwrites any previously-persisted value on the same tab.
   */
  abstract persistPostLoginRedirectUrl(url: string): Promise<void>;
}
