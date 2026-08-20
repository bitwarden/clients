import { map, Observable } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { SignedSecurityState } from "@bitwarden/legacy-crypto";

import { UserId } from "../../../types/guid";
import { AccountCryptographicStateService } from "../../account-cryptography/account-cryptographic-state.service";
import { SecurityStateService } from "../abstractions/security-state.service";

export class DefaultSecurityStateService implements SecurityStateService {
  constructor(private accountCryptographicStateService: AccountCryptographicStateService) {}

  // Emits the provided user's security state, or null if there is no security state present for the user.
  accountSecurityState$(userId: UserId): Observable<SignedSecurityState | null> {
    return this.accountCryptographicStateService.accountCryptographicState$(userId).pipe(
      map((cryptographicState) => {
        if (cryptographicState == null) {
          return null;
        }

        if ("V2" in cryptographicState) {
          return cryptographicState.V2.security_state as SignedSecurityState;
        } else {
          return null;
        }
      }),
    );
  }
}
