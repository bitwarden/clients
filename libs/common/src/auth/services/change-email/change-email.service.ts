import { UserId } from "@bitwarden/common/types/guid";

export abstract class ChangeEmailService {
  /**
   * Requests an email change token from the server.
   *
   * @param masterPassword The user's current master password
   * @param newEmail The new email address
   * @param userId The user's ID
   * @throws if master password verification fails
   */
  abstract requestEmailToken(
    masterPassword: string,
    newEmail: string,
    userId: UserId,
  ): Promise<void>;

  /**
   * Confirms the email change with the token received via email.
   *
   * @param masterPassword The user's current master password
   * @param newEmail The new email address
   * @param token The verification token received via email
   * @param userId The user's ID
   * @throws if master password verification fails
   */
  abstract confirmEmailChange(
    masterPassword: string,
    newEmail: string,
    token: string,
    userId: UserId,
  ): Promise<void>;
}
