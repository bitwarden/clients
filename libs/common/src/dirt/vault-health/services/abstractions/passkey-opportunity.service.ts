import { Observable } from "rxjs";

import { UserId } from "../../../../types/guid";
import { CipherView } from "../../../../vault/models/view/cipher.view";
import { PasskeyOpportunitiesState } from "../../models/passkey-opportunity";

/**
 * Finds the logins on the browser Health tab whose sites support passkeys and
 * publishes them. Matching a login to the passkey directory, and deciding which
 * logins are eligible, is the SDK's job (`CipherRiskClient`) and is not
 * reimplemented here. This service only fetches the directory, maps logins to
 * the SDK's candidate shape, and publishes the result.
 *
 * The caller owns fetching the ciphers and deciding when to recompute, as with
 * {@link VaultHealthReportService}.
 */
export abstract class PasskeyOpportunityService {
  /**
   * Finds the passkey opportunities among `ciphers` and publishes them for
   * `userId`. The directory is fetched once per user and reused; pass
   * `reloadDirectory` to fetch it again, e.g. on a retry after a failure.
   *
   * Emits `loading` only when there is no earlier result to keep on screen.
   * Never rejects: a failure is published as an `error` status.
   */
  abstract findPasskeyOpportunities(
    ciphers: CipherView[],
    userId: UserId,
    options?: { reloadDirectory?: boolean },
  ): Promise<void>;

  /** The user's check status and latest result; `idle` with no result until a check runs. */
  abstract getPasskeyOpportunities$(userId: UserId): Observable<PasskeyOpportunitiesState>;
}
