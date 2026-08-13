import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Observable, Subject, catchError, map, of, switchMap, take, tap } from "rxjs";

import { VaultHealthReportView } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

import { VaultHealthScanState } from "./models/vault-health-scan-state";
import { ScanFailureComponent } from "./scan-failure/scan-failure.component";
import { ScanProgressComponent } from "./scan-progress/scan-progress.component";

/** A finished scan attempt: either a report, or a failure. */
type ScanOutcome = { report: VaultHealthReportView } | { failed: true };

/**
 * The body of the Health tab: runs the vault-health scan and shows its progress,
 * then hands off to the results on success or the scan-failure state on error.
 *
 * Provided to the open-source Health tab shell through the HEALTH_CONTENT token,
 * because the report service and the Health views are licensed code that
 * `apps/browser` may not import.
 *
 * The scan runs on every Health tab open (this component is created per
 * navigation) and there is no manual rescan control. Results are not cached; a
 * failed scan recovers by reopening the tab.
 */
@Component({
  selector: "dirt-vault-health",
  templateUrl: "./vault-health.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScanProgressComponent, ScanFailureComponent],
})
export class VaultHealthComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly vaultHealthReportService = inject(VaultHealthReportService);
  private readonly logService = inject(LogService);

  private readonly scanTrigger$ = new Subject<void>();

  protected readonly scanState = signal<VaultHealthScanState>(VaultHealthScanState.Scanning);

  /**
   * The completed report. Consumed by the Health Overview (PM-35945), which
   * renders the gauge and risk categories once it lands.
   */
  protected readonly report = signal<VaultHealthReportView | null>(null);

  protected readonly VaultHealthScanState = VaultHealthScanState;

  constructor() {
    this.scanTrigger$
      .pipe(
        tap(() => {
          this.scanState.set(VaultHealthScanState.Scanning);
          this.report.set(null);
        }),
        // switchMap so a new scan supersedes one still in flight, and
        // catchError inside it so a failed scan does not end the stream.
        switchMap(() => this.runScan$()),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => {
        if ("failed" in outcome) {
          this.scanState.set(VaultHealthScanState.Failure);
          return;
        }

        this.report.set(outcome.report);
        this.scanState.set(VaultHealthScanState.Results);
      });
  }

  ngOnInit(): void {
    // Scan automatically on open. On the user's first visit the Intro to Health
    // view (PM-39222) is shown ahead of this component and calls startScan()
    // from its "Scan my vault" button instead.
    this.startScan();
  }

  /**
   * Runs the vault-health scan, showing the Scan Progress view while it runs and
   * then the results or the scan-failure state.
   *
   * Public so the Intro to Health view (PM-39222) can start the first scan from
   * its "Scan my vault" button.
   */
  startScan(): void {
    this.scanTrigger$.next();
  }

  private runScan$(): Observable<ScanOutcome> {
    return this.accountService.activeAccount$.pipe(
      map((account) => account?.id),
      filterOutNullish(),
      take(1),
      switchMap((userId) =>
        // A one-shot read: the scan is a point-in-time snapshot per the story, so
        // it does not re-run when the vault changes.
        this.cipherService.cipherViews$(userId).pipe(
          filterOutNullish(),
          take(1),
          switchMap((ciphers) =>
            this.vaultHealthReportService.buildVaultHealthReport$(ciphers, userId),
          ),
        ),
      ),
      map((report) => ({ report })),
      catchError(() => {
        // The failure is most likely the exposed-password check against the
        // external breach API. Logged without the error payload so no vault data
        // can reach the console.
        this.logService.error("Vault health scan failed.");
        return of({ failed: true as const });
      }),
    );
  }
}
