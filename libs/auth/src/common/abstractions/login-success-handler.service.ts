import { UserId } from "@bitwarden/common/types/guid";

export abstract class LoginSuccessHandlerService {
  /**
   * Runs any service calls required after a successful login.
   * Service calls that should be included in this method are only those required to be awaited after successful login.
   * @param userId The user id.
   * @param masterPassword The master password, if available. Null when logging in with SSO or other non-master-password methods.
   */
  abstract run(userId: UserId, masterPassword: string | null): Promise<void>;
}
