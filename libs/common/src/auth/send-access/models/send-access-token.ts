import { Jsonify } from "type-fest";

export interface SendAccessTokenJson {
  access_token: string;
  expires_in: number; // in seconds
  scope: string;
  token_type: string;
}

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

  /**
   * Builds an instance from our Identity token response data
   * @param sendAccessTokenJson The JSON data from the Identity token response
   */
  static fromResponseData(sendAccessTokenJson: SendAccessTokenJson): SendAccessToken {
    const expiresAtTimeStamp = Date.now() + sendAccessTokenJson.expires_in * 1000;
    return new SendAccessToken(sendAccessTokenJson.access_token, expiresAtTimeStamp);
  }

  /** Returns whether the send access token is expired or not */
  isExpired(): boolean {
    return Date.now() >= this.expiresAt;
  }

  /** Returns how many full seconds remain until expiry. Returns 0 if expired. */
  timeUntilExpirySeconds(): number {
    return Math.max(0, Math.floor((this.expiresAt - Date.now()) / 1_000));
  }

  static fromJson(json: Jsonify<SendAccessToken>): SendAccessToken {
    return new SendAccessToken(json.token, json.expiresAt);
  }
}
