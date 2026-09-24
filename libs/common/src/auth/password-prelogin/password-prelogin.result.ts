import { PasswordPreloginData } from "./password-prelogin.model";

/**
 * Prelogin data paired with the source it was retrieved from.
 *
 * The source is recorded at fetch time so every later step of a single login derives from
 * one decision. Resolving the source a second time downstream can yield a different answer,
 * because it depends on server config that hydrates asynchronously and can change between
 * the moment prelogin data is fetched and the moment a master key is derived from it.
 */
export class PasswordPreloginResult {
  constructor(
    /**
     * Whether the SDK retrieved this data.
     *
     * The SDK substitutes the normalized email when the server has no salt for the account,
     * so {@link data}'s salt is populated whenever this is `true`. The API path performs no
     * such substitution, so the salt may be null when this is `false`.
     */
    readonly fetchedFromSdk: boolean,
    readonly data: PasswordPreloginData,
  ) {}
}
