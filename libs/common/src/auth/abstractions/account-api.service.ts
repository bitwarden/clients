import { RegisterFinishRequest } from "../models/request/registration/register-finish.request";
import { RegisterSendVerificationEmailRequest } from "../models/request/registration/register-send-verification-email.request";
import { Verification } from "../types/verification";

export abstract class AccountApiService {
  /**
   * Deletes an account that has confirmed the operation is authorized
   *
   * @param verification - authorizes the account deletion operation.
   * @returns A promise that resolves when the account is
   * successfully deleted.
   */
  abstract deleteAccount(verification: Verification): Promise<void>;

  /**
   * Sends a verification email as part of the registration process.
   *
   * @param request - The request object containing
   * information needed to send the verification email, such as the user's email address.
   * @returns A promise that resolves to a string tokencontaining the user's encrypted
   * information which must be submitted to complete registration or `null` if
   * email verification is enabled (users must get the token by clicking a
   * link in the email that will be sent to them).
   */
  abstract registerSendVerificationEmail(
    request: RegisterSendVerificationEmailRequest,
  ): Promise<null | string>;

  /**
   * Completes the registration process.
   *
   * @param request - The request object containing the user's email verification token,
   * the email, hashed MP, newly created user key, and new asymmetric user key pair along
   * with the KDF information used during the process.
   * @returns A promise that resolves to a string captcha bypass token when the
   * registration process is successfully completed.
   */
  abstract registerFinish(request: RegisterFinishRequest): Promise<string>;
}
