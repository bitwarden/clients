import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import { AccountEventKind } from "./enums";
import type { AccountEvent, AccountReduction, AccountStatuses } from "./types";

const { LoggedOut, Locked } = AuthenticationStatus;

/** The events between one observation of the accounts and the next. */
export function reduceAccounts(
  previous: AccountReduction | undefined,
  activeUserId: UserId | null,
  statuses: AccountStatuses,
): AccountReduction {
  const before: AccountStatuses = previous?.statuses ?? {};
  const userIds = new Set([...Object.keys(before), ...Object.keys(statuses)] as UserId[]);

  const logins: AccountEvent[] = [];
  const changes: AccountEvent[] = [];
  for (const userId of userIds) {
    const was = before[userId] ?? LoggedOut;
    const is = statuses[userId] ?? LoggedOut;
    if (was === is) {
      continue;
    }
    if (was === LoggedOut) {
      logins.push({ kind: AccountEventKind.Login, userId });
    } else if (is === LoggedOut) {
      changes.push({ kind: AccountEventKind.Logout, userId });
    } else {
      changes.push({
        kind: is === Locked ? AccountEventKind.Lock : AccountEventKind.Unlock,
        userId,
      });
    }
  }

  // a switch implies the account it goes to is signed in, so one to a signed-out account waits
  // for that account's login
  let active = previous?.active ?? null;
  const switches: AccountEvent[] = [];
  if (
    activeUserId !== null &&
    activeUserId !== active &&
    (statuses[activeUserId] ?? LoggedOut) !== LoggedOut
  ) {
    switches.push({ kind: AccountEventKind.Switch, from: active, to: activeUserId });
    active = activeUserId;
  }

  const events = [...logins, ...switches, ...changes];
  if (previous === undefined) {
    events.push({ kind: AccountEventKind.Bootstrapped });
  }
  return { statuses, active, events };
}
