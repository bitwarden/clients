import { SendHashedPassword } from "../../../key-management/sends/send-password.service";
import { SendAccessToken } from "../models/send-access-token";
import {
  GetSendAcccessTokenError,
  TryGetSendAccessTokenError,
} from "../services/send-token.service";

export type SendAccessCredentialsType = "password" | "email-otp";

export type SendPasswordCredentials = {
  type: "password";
  password: SendHashedPassword;
};
export type SendEmailOtpCredentials = {
  type: "email-otp";
  email: string;
  otp: string;
};
export type SendAccessCredentials = SendPasswordCredentials | SendEmailOtpCredentials;

export abstract class SendTokenService {
  // TODO: consider converting to observable.
  /**
   * Attempts to retrieve a SendAccessToken for the given sendId.
   * If the access token is found in session storage and is not expired, then it returns the token.
   * If the access token is expired, then it returns a SendTokenRetrievalError expired error.
   * If an access token is not found in storage, then it attempts to retrieve it from the server (will succeed for sends that don't require any credentials to view).
   * If the access token is successfully retrieved from the server, then it stores the token in session storage and returns it.
   * If an access token cannot be granted b/c the send requires credentials, then it returns a SendTokenRetrievalError indicating which credentials are required.
   * Any submissions of credentials will be handled by the getSendAccessTokenWithCredentials method.
   * @param sendId The ID of the send to retrieve the access token for.
   * @returns A promise that resolves to a SendAccessToken if found and valid, or a SendTokenRetrievalError if not.
   */
  abstract tryGetSendAccessToken: (
    sendId: string,
  ) => Promise<SendAccessToken | TryGetSendAccessTokenError>;

  /**
   * Retrieves a SendAccessToken for the given sendId using the provided credentials.
   * If the access token is successfully retrieved from the server, it stores the token in session storage and returns it.
   * If the access token cannot be granted due to invalid credentials, it returns a GetSendAcccessTokenError.
   * @param sendId The ID of the send to retrieve the access token for.
   * @param sendAccessCredentials The credentials to use for accessing the send.
   * @returns A promise that resolves to a SendAccessToken if found and valid, or a GetSendAcccessTokenError if not.
   */
  abstract getSendAccessToken: (
    sendId: string,
    sendAccessCredentials: SendAccessCredentials,
  ) => Promise<SendAccessToken | GetSendAcccessTokenError>;

  /**
   * Hashes a password for send access.
   * @param password The raw password string to hash.
   * @param keyMaterialUrlB64 The base64 URL encoded key material string.
   * @returns A promise that resolves to the hashed password as a SendHashedPassword.
   */
  abstract hashPassword: (
    password: string,
    keyMaterialUrlB64: string,
  ) => Promise<SendHashedPassword>;
}
