import { UserId } from "@bitwarden/common/types/guid";

export abstract class LoginSuccessHandlerService {
  /**
   * Runs any service calls required after a successful login.
   * Service calls that should be included in this method are only those required to be awaited after successful login.
   * @param userId The user id.
   * @param masterPassword
   */
  abstract run(userId: UserId, masterPassword?: string): Promise<void>;
}
