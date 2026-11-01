import { UserId } from "../../types/guid";
import { AuthenticationStatus } from "../enums/authentication-status";

import { LogoutReason } from "./logout-reason.type";

export interface NewActiveUser {
  userId: UserId;
  authenticationStatus: AuthenticationStatus;
}

export abstract class LogoutService {
  /**
   * Logs out the user.
   * @param userId The user id.
   * @param logoutReason The reason for logging out.
   * @returns The new active user or undefined if there isn't a new active account.
   */
  abstract logout(userId: UserId, logoutReason: LogoutReason): Promise<NewActiveUser | undefined>;
}
