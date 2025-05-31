import { ClientType } from "../../../../enums";
import { GrantType } from "../../../enums/grant-type.enum";
import { Scope } from "../../../enums/scopes.enum";
import { SendAccessCredentials } from "../../../send-access/abstractions/send-token.service";

export type SendAccessTokenPasswordPayload = { password: string };
export type SendAccessTokenEmailOtpPayload = { email: string; otp: string };
export type SendAccessTokenAnonymousPayload = object; // empty object

export interface SendAccessTokenPayloadBase {
  client_id: ClientType;
  grant_type: GrantType;
  scope: Scope;

  send_id: string;
}

// Payload is the base + only 1 set of 3 credentials.
export type SendAccessTokenPayload = SendAccessTokenPayloadBase &
  (
    | SendAccessTokenPasswordPayload
    | SendAccessTokenEmailOtpPayload
    | SendAccessTokenAnonymousPayload
  );

export class SendAccessTokenRequest {
  /// The client_id for the Send client
  private static readonly CLIENT_ID = ClientType.Send as const;

  constructor(
    public sendId: string,
    public sendAccessCredentials?: SendAccessCredentials,
  ) {}

  /**
   * Builds the payload to send to /connect/token
   */
  toIdentityTokenPayload(): SendAccessTokenPayload {
    const base: SendAccessTokenPayloadBase = {
      client_id: SendAccessTokenRequest.CLIENT_ID,
      grant_type: GrantType.SendAccess,
      scope: Scope.Send,

      send_id: this.sendId,
    };

    if (this.sendAccessCredentials && this.sendAccessCredentials.type === "password") {
      return { ...base, password: this.sendAccessCredentials.password };
    } else if (this.sendAccessCredentials && this.sendAccessCredentials.type === "email-otp") {
      return {
        ...base,
        email: this.sendAccessCredentials.email,
        otp: this.sendAccessCredentials.otp,
      };
    } else {
      return base;
    }
  }
}
