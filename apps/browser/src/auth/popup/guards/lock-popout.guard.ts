import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BiometricsService } from "@bitwarden/key-management";
import { WebAuthnPrfUnlockService } from "@bitwarden/key-management-ui";

import { platformPopoutGuard } from "./platform-popout.guard";

/** Move passkey-capable Linux lock screens into a popout after the parent lock guard allows access. */
export const lockPopoutGuard: CanActivateFn = async (route, state) => {
  const accountService = inject(AccountService);
  const biometricsService = inject(BiometricsService);
  const webAuthnPrfUnlockService = inject(WebAuthnPrfUnlockService);

  // Keep the normal popup for accounts without passkey unlock.
  const account = await firstValueFrom(accountService.activeAccount$);
  if (!account || !(await webAuthnPrfUnlockService.isPrfUnlockAvailable(account.id))) {
    return true;
  }

  // Suppression lives in the current window, so pass it to the popout's new service.
  const shouldAutoprompt = await biometricsService.getShouldAutopromptNow();

  return platformPopoutGuard(["linux"], false, {
    suppressBiometricAutoPrompt: String(!shouldAutoprompt),
  })(route, state);
};
