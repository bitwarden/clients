import { UserId } from "../../types/guid";
import { AuthenticationStatus } from "../enums/authentication-status";

import { LogoutReason } from "./logout-reason.type";

export interface NewActiveUser {
  userId: UserId;
  authenticationStatus: AuthenticationStatus;
}

// TODO(PM-21212 review): DECISION NEEDED - Jira tracking for the split PRs.
//   Keep all PRs (web, desktop, and browser logout services, then the callback removal) under
//   PM-21212, or file sub-tickets (one per client, one per team)? Sub-tickets give QA one
//   ticket per test target. The PM-21212 description rewrite also waits for this answer.
// TODO(PM-21212 review): DECISION NEEDED - Fate of this review branch.
//   After the per-client PRs open from main, delete the remote branch
//   auth/pm-21212-logout-service-consolidation, or reuse it for one of those PRs?
export abstract class LogoutService {
  /**
   * Logs out the user.
   * @param userId The user id.
   * @param logoutReason The reason for logging out.
   * @returns The new active user or undefined if there isn't a new active account.
   */
  abstract logout(userId: UserId, logoutReason: LogoutReason): Promise<NewActiveUser | undefined>;
}
