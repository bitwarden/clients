import { Page } from "@playwright/test";

import { automationDriver } from "./automation-driver";

const CAPABILITY = "lock";

/** An account the client knows, see `UserLockStatus` in libs/automation-driver. */
export type ClientAccount = {
  userId: string;
  email: string;
  status: "LoggedOut" | "Locked" | "Unlocked";
};

type LockCapability = {
  listUsers(): Promise<ClientAccount[]>;
};

/** Every account the client knows, with its lock status. */
export function clientAccounts(page: Page): Promise<ClientAccount[]> {
  return automationDriver<LockCapability>(page, CAPABILITY).listUsers();
}
