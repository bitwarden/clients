import { BaseResponse } from "../../../models/response/base.response";

export class RefreshTokenResponse extends BaseResponse {
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
  tokenType: string;

  constructor(response: unknown) {
    super(response);

    const accessToken = this.getResponseProperty("access_token");
    if (accessToken == null || typeof accessToken !== "string") {
      throw new Error("Refresh token response does not contain a valid access token");
    }
    const tokenType = this.getResponseProperty("token_type");
    if (tokenType == null || typeof tokenType !== "string") {
      throw new Error("Refresh token response does not contain a valid token type");
    }
    this.accessToken = accessToken;
    this.tokenType = tokenType;

    const expiresIn = this.getResponseProperty("expires_in");
    if (expiresIn != null && typeof expiresIn === "number") {
      this.expiresIn = expiresIn;
    }
    const refreshToken = this.getResponseProperty("refresh_token");
    if (refreshToken != null && typeof refreshToken === "string") {
      this.refreshToken = refreshToken;
    }
  }
}
