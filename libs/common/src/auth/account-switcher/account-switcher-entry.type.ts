import { UserId } from "../../types/guid";
import { AuthenticationStatus } from "../enums/authentication-status";

/**
 * One account as an account switcher shows it.
 */
export type AccountSwitcherEntry = {
  id: UserId;
  name: string | undefined;
  email: string;
  status: AuthenticationStatus;
  avatarColor: string | null;
  serverHostname: string | undefined;
};
