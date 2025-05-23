import { SendAccessToken } from "../models/send-access-token";
import { SendTokenRetrievalError } from "../services/send-token.service";

export type SendAccessCredentialsType = "password" | "email-otp";

export type SendPasswordCredentials = {
  type: "password";
  password: string;
};
export type SendEmailOtpCredentials = {
  type: "email-otp";
  email: string;
  otp: string;
};
export type SendAccessCredentials = SendPasswordCredentials | SendEmailOtpCredentials;

export abstract class SendTokenService {
  // SendAccessTokens need to be stored in session storage once retrieved.
  // All SendAccessTokens are scoped to a specific send id so all getting and setting should accept a send id.

  // TODO: should this abstraction have separate methods for requesting an access token from the server
  // and for getting the access token from storage?
  // One method that does both is ideal.
  // We will need to extend inputs to include the send id and the credentials.
  // We will also need to store the send access token with it's expires_in value so we know if it's expired
  // so that we don't hand out an expired token to make a request.

  // Returned error types should be discriminated union with a type that can be conditioned off for logic.

  // TODO: define return types.
  // TODO: consider converting to observable.
  abstract tryGetSendAccessToken: (
    sendId: string,
  ) => Promise<SendAccessToken | SendTokenRetrievalError>;

  abstract getSendAccessTokenWithCredentials: (
    sendId: string,
    sendAccessCredentials: SendAccessCredentials,
  ) => Promise<void>;
}
