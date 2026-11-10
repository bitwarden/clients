import { inject, Injectable } from "@angular/core";
import {
  catchError,
  combineLatest,
  concatMap,
  debounceTime,
  defer,
  EMPTY,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
} from "rxjs";

import { PasskeyOpportunityService } from "@bitwarden/common/dirt/vault-health/services";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

/** A sync rewrites many ciphers across several ticks; a burst is collapsed into one check. */
const VAULT_CHANGE_DEBOUNCE_MS = 300;

/**
 * Decides *when* the Health views recheck passkey opportunities;
 * {@link PasskeyOpportunityService} owns *what* they are.
 *
 * Separate from `HealthScanService` because the two have different costs: a
 * health scan does a breach lookup per login and so runs once, while a passkey
 * check is a local match against a cached directory and so simply reruns on
 * every vault change. That keeps the list current when the user comes back
 * from adding a passkey to an item.
 *
 * Cold and scoped to the subscriber, like `HealthScanService`. Nothing here
 * throws: a failure arrives as a published `error` status.
 */
@Injectable({ providedIn: "root" })
export class HealthPasskeyScanService {
  private readonly cipherService = inject(CipherService);
  private readonly passkeyOpportunityService = inject(PasskeyOpportunityService);
  private readonly logService = inject(LogService);
  private readonly configService = inject(ConfigService);

  /**
   * Whether the passkeys category is released. Its list is built on the popup vault's
   * `bit-table-v2` list, so it also waits for that (VFO1).
   */
  readonly enabled$: Observable<boolean> = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.PasskeyLoginReport),
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
  ]).pipe(map(([passkeys, vfo1]) => passkeys && vfo1));

  /** Per user, because this service outlives an account switch. */
  private readonly retries = new Map<UserId, Subject<void>>();

  /** Checks now, then again on every vault change, until the caller unsubscribes. */
  keepPasskeysCurrent$(userId: UserId): Observable<void> {
    return merge(of(false), this.retriesFor(userId).pipe(map(() => true))).pipe(
      // A retry starts over and fetches the directory again, since a failed
      // fetch is the likeliest reason to retry.
      switchMap((reloadDirectory) =>
        this.cipherService.cipherViews$(userId).pipe(
          // cipherViews$ can emit null while decryption is still running.
          filterOutNullish(),
          debounceTime(VAULT_CHANGE_DEBOUNCE_MS),
          concatMap((ciphers, index) =>
            defer(() =>
              this.passkeyOpportunityService.findPasskeyOpportunities(ciphers, userId, {
                reloadDirectory: reloadDirectory && index === 0,
              }),
            ),
          ),
          catchError((error: unknown) => {
            this.logService.error("Passkey opportunity pipeline failed", error);
            return EMPTY;
          }),
        ),
      ),
    );
  }

  /** Requests another check with a fresh directory. Only `userId`'s subscribed pipeline reacts. */
  retry(userId: UserId): void {
    this.retriesFor(userId).next();
  }

  private retriesFor(userId: UserId): Subject<void> {
    let retry = this.retries.get(userId);
    if (retry == null) {
      retry = new Subject<void>();
      this.retries.set(userId, retry);
    }
    return retry;
  }
}
