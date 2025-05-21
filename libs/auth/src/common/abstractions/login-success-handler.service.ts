import { UserId } from "@bitwarden/common/types/guid";

export abstract class LoginSuccessHandlerService {
  /**
   * Runs any service calls required after a successful login.
   * Service calls that should be included in this method are only those required to be awaited after successful login.
   * @param userId The user id.
   */
  abstract run(userId: UserId): Promise<void>;
}
