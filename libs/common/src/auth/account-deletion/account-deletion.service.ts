import { UserId } from "../../types/guid";
import { Verification } from "../types/verification";

export abstract class AccountDeletionService {
  /**
   * Deletes the user's account on the server, then logs the user out.
   *
   * @param userId The user whose account to delete.
   * @param verification The secret that authorizes the deletion, such as the master password or
   * an email verification code.
   * @throws When the verification is rejected or the request fails. The user stays logged in.
   */
  abstract deleteAccount(userId: UserId, verification: Verification): Promise<void>;
}
