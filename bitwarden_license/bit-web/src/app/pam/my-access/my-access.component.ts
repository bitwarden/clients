import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { filter } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeComponent,
  ButtonModule,
  DialogService,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AccessLeaseId, AccessRequestId, formatRemaining } from "..";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { RelativeTimePipe } from "../date/relative-time.pipe";

import { MyAccessLeaseRow, MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

/**
 * "My access" (`/pam`) — the individual user's own PAM requests and leases, split into:
 *  - Active leases (the leases they currently hold)
 *  - Pending      (requests still awaiting a decision, or approved and awaiting activation)
 *  - History      (every terminal request, once no lease it produced is still active)
 *
 * Faithful port of the `pam/poc` branch's "My requests" list, adapted to the Rust-SDK-served
 * pass-1 services and to this backend's real `AccessLeaseStatus` (see
 * {@link historyDisplayStatus} in `./my-access-row` for the "cancelled vs revoked" adaptation).
 * Data, name resolution, and optimistic cancel/end live in {@link MyAccessService}; this component
 * owns only the view: the live countdown clock and the start/cancel/end affordance gating.
 */
@Component({
  selector: "pam-my-access",
  templateUrl: "./my-access.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    BadgeComponent,
    ButtonModule,
    HeaderModule,
    IconComponent,
    NoItemsModule,
    SectionComponent,
    SectionHeaderComponent,
    TableModule,
    TypographyModule,
    I18nPipe,
    DurationShortPipe,
    RelativeTimePipe,
  ],
})
export class MyAccessComponent implements OnInit {
  private readonly myAccess = inject(MyAccessService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  protected readonly loading = toSignal(this.myAccess.loading$, { initialValue: true });
  protected readonly cancelling = signal<Set<AccessRequestId>>(new Set());
  /** Ids of approved requests currently being activated (prevents double-click). */
  protected readonly starting = signal<Set<AccessRequestId>>(new Set());
  /** Ids of active leases currently being ended (prevents double-click). */
  protected readonly ending = signal<Set<AccessLeaseId>>(new Set());
  /** Ticks once a second so the redemption/remaining countdowns stay live. */
  private readonly nowMs = signal(Date.now());

  protected readonly pendingRows = toSignal(this.myAccess.pendingRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  protected readonly leases = toSignal(this.myAccess.leases$, {
    initialValue: [] as MyAccessLeaseRow[],
  });
  protected readonly historyRows = toSignal(this.myAccess.historyRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });

  /** Decrypted gated ciphers keyed by id; the template reads these to render an item's favicon. */
  private readonly cipherById = toSignal(this.myAccess.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  protected readonly hasAnyRows = computed(
    () =>
      this.leases().length > 0 || this.pendingRows().length > 0 || this.historyRows().length > 0,
  );

  /**
   * Each table renders from its own data source so `bit-table` can sort the rows independently.
   */
  protected readonly leasesDataSource = new TableDataSource<MyAccessLeaseRow>();
  protected readonly pendingDataSource = new TableDataSource<MyAccessRequestRow>();
  protected readonly historyDataSource = new TableDataSource<MyAccessRequestRow>();

  constructor() {
    effect(() => {
      this.leasesDataSource.data = this.leases();
    });
    effect(() => {
      this.pendingDataSource.data = this.pendingRows();
    });
    effect(() => {
      this.historyDataSource.data = this.historyRows();
    });
  }

  ngOnInit(): void {
    void this.myAccess.load();

    // Keep the countdown clock outside the Angular zone: a periodic in-zone timer never lets
    // NgZone settle, which would hang `fixture.whenStable()` for any host that embeds this view.
    // The signal write still drives change detection on its own.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });

    this.myAccess.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamMyRequestsLoadError"),
        });
      });
  }

  /**
   * The decrypted cipher for a row, or undefined when it isn't in the caller's vault. The
   * template renders `app-vault-icon` only when a cipher is present; otherwise no icon.
   */
  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  protected isCancelling(id: AccessRequestId): boolean {
    return this.cancelling().has(id);
  }

  protected isStarting(id: AccessRequestId): boolean {
    return this.starting().has(id);
  }

  protected isEnding(id: AccessLeaseId): boolean {
    return this.ending().has(id);
  }

  /**
   * A pending/approved request's window has already opened — the item shows "until X" instead of
   * "from – to" ("effectively now": this backend's `leaseNotBefore` is never absent the way the
   * poc's mocked one could be for an on-demand request).
   */
  protected startsNow(row: Pick<MyAccessRequestRow, "leaseNotBefore">): boolean {
    return Date.parse(row.leaseNotBefore) <= this.nowMs();
  }

  /**
   * A request the requester can withdraw: still pending, or an approved-but-not-activated request
   * whose window can still produce access. Once its window lapses it can no longer be started, so
   * — like Start — Cancel is withheld and it awaits server-side expiry.
   */
  protected canCancel(row: MyAccessRequestRow): boolean {
    if (row.status === "pending") {
      return true;
    }
    return row.status === "approved" && Date.parse(row.leaseNotAfter) > this.nowMs();
  }

  /**
   * An approved request is startable only while its window can still produce access; once the
   * window lapses the server rejects activation, so the Start button must not be offered.
   */
  protected canStart(row: MyAccessRequestRow): boolean {
    return row.status === "approved" && Date.parse(row.leaseNotAfter) > this.nowMs();
  }

  /** A live "activate within X" label for an approved on-demand request. */
  protected redemptionRemainingLabel(row: MyAccessRequestRow): string | null {
    if (row.status !== "approved") {
      return null;
    }
    return formatRemaining(Date.parse(row.leaseNotAfter) - this.nowMs());
  }

  /** A live "ends in X" label for an active lease. */
  protected leaseRemainingLabel(lease: MyAccessLeaseRow): string {
    return formatRemaining(Date.parse(lease.notAfter) - this.nowMs());
  }

  protected async cancel(row: MyAccessRequestRow): Promise<void> {
    if (!this.canCancel(row) || this.isCancelling(row.id)) {
      return;
    }
    this.cancelling.update((s) => new Set([...s, row.id]));
    try {
      await this.myAccess.cancel(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamMyRequestsCancelSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsCancelError"),
      });
    } finally {
      this.cancelling.update((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
    }
  }

  /** Activates an approved request (mints the lease). */
  protected async activate(row: MyAccessRequestRow): Promise<void> {
    if (!this.canStart(row) || this.isStarting(row.id)) {
      return;
    }
    this.starting.update((s) => new Set([...s, row.id]));
    try {
      await this.myAccess.activate(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      // A taken single-active-lease slot or an org-wide freeze surfaces here; the approved
      // request stays activatable for a manual retry.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamStartLeaseError"),
      });
    } finally {
      this.starting.update((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
    }
  }

  /**
   * End (revoke) an active lease early. Confirms first, then hands off to the service, which
   * removes the lease optimistically and rolls back on failure.
   */
  protected async endLease(lease: MyAccessLeaseRow): Promise<void> {
    if (this.isEnding(lease.id)) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamEndLeaseTitle" },
      content: { key: "pamEndLeaseConfirm" },
      acceptButtonText: { key: "pamEndLeaseButton" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    this.ending.update((s) => new Set([...s, lease.id]));
    try {
      await this.myAccess.endLease(lease.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamEndLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.ending.update((s) => {
        const next = new Set(s);
        next.delete(lease.id);
        return next;
      });
    }
  }
}
