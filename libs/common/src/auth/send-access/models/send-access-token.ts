import { Jsonify } from "type-fest";

import { SendAccessTokenResponse } from "@bitwarden/sdk-internal";

export class SendAccessToken {
  constructor(
    /**
     * The access token string
     */
    readonly token: string,
    /**
     * The time (in milliseconds since the epoch) when the token expires
     */
    readonly expiresAt: number,
  ) {}

  /** Returns whether the send access token is expired or not
   * Has a 5 second threshold to avoid race conditions with the token
   * expiring in flight
   */
  isExpired(threshold: number = 5_000): boolean {
    return Date.now() >= this.expiresAt - threshold;
  }

  /** Returns how many full seconds remain until expiry. Returns 0 if expired. */
  timeUntilExpirySeconds(): number {
    return Math.max(0, Math.floor((this.expiresAt - Date.now()) / 1_000));
  }

  static fromJson(parsedJson: Jsonify<SendAccessToken>): SendAccessToken {
    return new SendAccessToken(parsedJson.token, parsedJson.expiresAt);
  }

  /**
   * Creates a SendAccessToken from a SendAccessTokenResponse.
   * @param sendAccessTokenResponse The SDK response object containing the token and expiry information.
   * @returns A new instance of SendAccessToken.
   * note: we need to convert from the SDK response type to our internal type so that we can
   * be sure it will serialize/deserialize correctly in state provider.
   */
  static fromSendAccessTokenResponse(
    sendAccessTokenResponse: SendAccessTokenResponse,
  ): SendAccessToken {
    return new SendAccessToken(sendAccessTokenResponse.token, sendAccessTokenResponse.expiresAt);
  }
}
