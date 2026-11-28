import { firstValueFrom } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import type { UserId } from "@bitwarden/common/types/guid";

import type { FillResult } from "../../types";
import { AUTOFILL_DENIED } from "../../utils";
import type { FillServices } from "../services";

/**
 * Verifies that the account a fill was requested for is still the active account, and unlocked (see
 * `model.md`, invariant 12). Resolves to `undefined` when it is, and denies the fill otherwise.
 */
export async function verifyAccount(
  userId: UserId,
  { accountService, authService }: Pick<FillServices, "accountService" | "authService">,
): Promise<FillResult | undefined> {
  const active = await firstValueFrom(accountService.activeAccount$.pipe(getOptionalUserId));
  if (active !== userId) {
    return AUTOFILL_DENIED;
  }
  const status = await firstValueFrom(authService.authStatusFor$(userId));
  return status === AuthenticationStatus.Unlocked ? undefined : AUTOFILL_DENIED;
}
