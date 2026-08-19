import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  effect,
  Signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  Observable,
  catchError,
  defer,
  filter,
  ignoreElements,
  map,
  merge,
  of,
  startWith,
  switchMap,
  take,
} from "rxjs";

import {
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportState,
} from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { I18nPipe } from "@bitwarden/ui-common";

import { HealthIntroComponent } from "./health-intro.component";
import { HealthOverviewComponent } from "./health-overview.component";
import { HealthScanErrorComponent } from "./health-scan-error.component";
import { HealthScanningComponent } from "./health-scanning.component";
import { HealthAccessService } from "./services/health-access.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health",
  templateUrl: "./health.component.html",
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    I18nPipe,
    HealthIntroComponent,
    HealthOverviewComponent,
    HealthScanningComponent,
    HealthScanErrorComponent,
  ],
})
export class HealthComponent {
  readonly accountService = inject(AccountService);
  readonly healthAccessService = inject(HealthAccessService);
  private readonly cipherService = inject(CipherService);
  private readonly vaultHealthReportService = inject(VaultHealthReportService);
  private readonly logService = inject(LogService);

  readonly userId = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.id)),
  );
  readonly hasHealthBeenOpened = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) =>
        userId ? this.healthAccessService.healthHasBeenOpened$(userId) : of(false),
      ),
    ),
    { initialValue: false },
  );
  readonly hasRunHealthScan = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) =>
        userId ? this.healthAccessService.hasRunHealthScan$(userId) : of(false),
      ),
    ),
    { initialValue: false },
  );

  /**
   * Where report generation is for the active user, per the report service.
   *
   * Annotated rather than passed as a type argument: `toSignal`'s only overload
   * that accepts a non-null `initialValue` declares two type parameters, so one
   * explicit argument disqualifies it on arity.
   */
  private readonly scanState: Signal<VaultHealthReportState> = toSignal(
    toObservable(this.userId).pipe(
      filterOutNullish(),
      switchMap((userId) =>
        this.healthAccessService.hasRunHealthScan$(userId).pipe(
          // On the first visit this waits for the intro's "Scan my vault"; on
          // every later visit it is already true, so generation starts as soon
          // as the tab opens. take(1) keeps it to one build per open.
          filter(Boolean),
          take(1),
          switchMap(() => this.generateReport$(userId)),
          // Clears the previous account's result the moment the active account
          // changes, so switching users can never briefly show A's at-risk
          // counts to B while B's own state is still resolving.
          startWith(VAULT_HEALTH_REPORT_IDLE),
        ),
      ),
    ),
    { initialValue: VAULT_HEALTH_REPORT_IDLE },
  );

  /** True when report generation did not complete. */
  protected readonly scanFailed = computed(() => this.scanState().status === "error");

  /** The completed report, or null while generating or after a failure. */
  protected readonly report = computed(() => {
    const state = this.scanState();
    return state.status === "success" ? state.report : null;
  });

  constructor() {
    effect(async () => {
      const userId = this.userId();
      if (!userId) {
        return;
      }

      // mark state indicating the User has opened the Health tab
      if (!this.hasHealthBeenOpened()) {
        await this.healthAccessService.setHealthHasBeenOpened(userId);
      }
    });
  }

  readonly handleHealthScan = async () => {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    // mark state indicating the User has run a Health scan (i.e. completed the introduction CTA)
    await this.healthAccessService.setHasRunHealthScan(userId);
  };

  /**
   * Reports where generation is for `userId`, starting it only if the service
   * has nothing for them yet.
   *
   * Re-creating this component must not repeat the scan. `/health/:category` is
   * a sibling route and the popup never reuses routes, so the back arrow
   * destroys and rebuilds this component; without the guard the user pays a
   * second breach lookup and watches the progress view again for results they
   * were reading a moment earlier. The report service is popup-scoped, so
   * closing the popup still discards everything and the next open scans afresh.
   *
   * Never errors, so a failure renders the failure view instead of tearing down
   * the pipeline.
   */
  private generateReport$(userId: UserId): Observable<VaultHealthReportState> {
    return this.vaultHealthReportService.getVaultHealthReportState$(userId).pipe(
      take(1),
      switchMap((existing) =>
        existing.status === "idle"
          ? this.startGeneration$(userId)
          : // Already generated, generating, or failed for this user. Follow it
            // rather than starting a second one.
            this.vaultHealthReportService.getVaultHealthReportState$(userId),
      ),
      // The service publishes its own failures as state, so reaching here means
      // the ciphers stream failed instead. Distinct message so the two failure
      // classes are separable in a log dump.
      catchError((error: unknown): Observable<VaultHealthReportState> => {
        this.logService.error("Vault health scan pipeline failed", error);
        return of({ status: "error" });
      }),
    );
  }

  /** Runs one report build for `userId` and reports the service's state for it. */
  private startGeneration$(userId: UserId): Observable<VaultHealthReportState> {
    return this.cipherService.cipherViews$(userId).pipe(
      // cipherViews$ may emit null when decrypted ciphers are cleared.
      filterOutNullish(),
      // Generation does an external breach lookup; a vault edit must not re-run it.
      take(1),
      switchMap((ciphers) =>
        merge(
          // Trigger only. merge subscribes in order, so the service has already
          // published `loading` by the time the state stream is subscribed
          // below.
          defer(() => this.vaultHealthReportService.buildVaultHealthReport(ciphers, userId)).pipe(
            ignoreElements(),
          ),
          this.vaultHealthReportService.getVaultHealthReportState$(userId),
        ),
      ),
    );
  }
}
