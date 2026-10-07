import { UserId } from "../../types/guid";

/**
 * The outcome of checking whether the active account can stay active.
 * - `keep`: the active account is usable, or there is no active account.
 * - `switch`: the active account is logged out; `userId` should become active.
 * - `clear`: the active account is logged out and no other account can replace it.
 */
export type ActiveAccountResolution =
  { action: "keep" } | { action: "switch"; userId: UserId } | { action: "clear" };
