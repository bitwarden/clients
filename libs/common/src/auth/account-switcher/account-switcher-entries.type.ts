import { AccountSwitcherEntry } from "./account-switcher-entry.type";

/**
 * The accounts an account switcher shows, split into the active account and the others.
 * Logged-out accounts never appear.
 */
export type AccountSwitcherEntries = {
  /** The active account, or `null` when there is none or it is logged out. */
  active: AccountSwitcherEntry | null;
  /** Every other account, most recently active first. */
  inactive: AccountSwitcherEntry[];
  /** Whether another account can be added without exceeding the account limit. */
  canAddAccount: boolean;
};
