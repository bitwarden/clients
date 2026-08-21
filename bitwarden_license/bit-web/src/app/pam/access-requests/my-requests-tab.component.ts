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
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AccordionComponent,
  AccordionGroupComponent,
  BadgeComponent,
  ButtonModule,
  ChipFilterComponent,
  ChipFilterOption,
  DialogService,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessLeaseId, AccessRequestId, LeasingErrorService } from "..";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { RemainingTimePipe } from "../date/remaining-time.pipe";

import { MyAccessLeaseRow, MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

/** A row carrying the id + collection fields the toolbar filters against. */
type FilterableRow = {
  collectionId: string;
  cipherName: string | null;
  collectionName: string | null;
};

/**
 * "My requests" tab — the caller's own PAM access, grouped into three accordion sections mirroring
 * the design:
 *  - Pending — requests still awaiting a decision, or approved and awaiting activation.
 *  - Extension requests — open requests to extend a lease already held.
 *  - Currently checked out — the leases the caller holds right now.
 *
 * Data, name resolution, and optimistic cancel/end live in {@link MyAccessService} (provided on the
 * shell route and shared across tabs); this component owns only the view: the live countdown clock,
 * the search/collection filter, and the start/cancel/end affordance gating.
 */
@Component({
  selector: "pam-my-requests-tab",
  templateUrl: "./my-requests-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AccessStateBadgeComponent,
    AccordionComponent,
    AccordionGroupComponent,
    BadgeComponent,
    ButtonModule,
    ChipFilterComponent,
    IconComponent,
    NoItemsModule,
    SearchModule,
    TableModule,
    TypographyModule,
    I18nPipe,
    DurationShortPipe,
    RemainingTimePipe,
  ],
})
export class MyRequestsTabComponent implements OnInit {
  private readonly myAccess = inject(MyAccessService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly leasingErrorService = inject(LeasingErrorService);

  protected readonly cancelling = signal<Set<AccessRequestId>>(new Set());
  /** Ids of approved requests currently being activated (prevents double-click). */
  protected readonly starting = signal<Set<AccessRequestId>>(new Set());
  /** Ids of active leases currently being ended (prevents double-click). */
  protected readonly ending = signal<Set<AccessLeaseId>>(new Set());
  /** Ticks once a second so the redemption/remaining countdowns stay live. */
  protected readonly nowMs = signal(Date.now());

  /** Free-text search across item + collection names; the Collection filter selects one collection. */
  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });
  protected readonly collectionControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: "" });
  private readonly selectedCollection = toSignal(this.collectionControl.valueChanges, {
    initialValue: null,
  });

  private readonly allPending = toSignal(this.myAccess.pendingRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly allExtensions = toSignal(this.myAccess.extensionRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly allLeases = toSignal(this.myAccess.leases$, {
    initialValue: [] as MyAccessLeaseRow[],
  });

  /** Decrypted gated ciphers keyed by id; the template reads these to render an item's favicon. */
  private readonly cipherById = toSignal(this.myAccess.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  /** Every distinct collection present across the caller's rows, for the Collection filter. */
  protected readonly collectionOptions = computed<ChipFilterOption<string>[]>(() => {
    const byId = new Map<string, string>();
    for (const row of [...this.allPending(), ...this.allExtensions(), ...this.allLeases()]) {
      if (row.collectionName != null && !byId.has(row.collectionId)) {
        byId.set(row.collectionId, row.collectionName);
      }
    }
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  protected readonly pendingRows = computed(() => this.applyFilters(this.allPending()));
  protected readonly extensionRows = computed(() => this.applyFilters(this.allExtensions()));
  protected readonly leases = computed(() => this.applyFilters(this.allLeases()));

  /**
   * Badge state is memoised per lease so the shared badge component sees a stable input across the
   * one-second `nowMs` tick. A fresh object every tick would re-run the badge's own effect and
   * restart its countdown interval, so the label could never settle on a whole second. Keyed off
   * the unfiltered rows so that typing in the search box does not churn the surviving badges.
   */
  private readonly leaseBadgeStates = computed(
    () =>
      new Map<AccessLeaseId, AccessBadgeState>(
        this.allLeases().map((lease) => [
          lease.id,
          { kind: "active", expiresAt: new Date(lease.notAfter) },
        ]),
      ),
  );

  /**
   * Each table renders from its own data source so `bit-table` can sort the rows independently.
   */
  protected readonly pendingDataSource = new TableDataSource<MyAccessRequestRow>();
  protected readonly extensionDataSource = new TableDataSource<MyAccessRequestRow>();
  protected readonly leasesDataSource = new TableDataSource<MyAccessLeaseRow>();

  constructor() {
    effect(() => {
      this.pendingDataSource.data = this.pendingRows();
    });
    effect(() => {
      this.extensionDataSource.data = this.extensionRows();
    });
    effect(() => {
      this.leasesDataSource.data = this.leases();
    });
  }

  ngOnInit(): void {
    // Keep the countdown clock outside the Angular zone: a periodic in-zone timer never lets NgZone
    // settle, which would hang `fixture.whenStable()` for any host that embeds this view. The signal
    // write still drives change detection on its own.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });
  }

  /** Filter a row set by the free-text search term and the selected collection. */
  private applyFilters<T extends FilterableRow>(rows: T[]): T[] {
    const term = this.searchTerm().trim().toLowerCase();
    const collection = this.selectedCollection();
    return rows.filter((row) => {
      if (collection != null && row.collectionId !== collection) {
        return false;
      }
      if (term === "") {
        return true;
      }
      const haystack = `${row.cipherName ?? ""} ${row.collectionName ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  /**
   * The decrypted cipher for a row, or undefined when it isn't in the caller's vault. The template
   * renders `app-vault-icon` only when a cipher is present; otherwise no icon.
   */
  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  protected leaseBadgeState(id: AccessLeaseId): AccessBadgeState | null {
    return this.leaseBadgeStates().get(id) ?? null;
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
   * whose window can still produce access. Once its window lapses it can no longer be started, so —
   * like Start — Cancel is withheld and it awaits server-side expiry.
   */
  protected canCancel(row: MyAccessRequestRow): boolean {
    if (row.status === "pending") {
      return true;
    }
    return (
      row.status === "approved" &&
      row.producedLeaseId == null &&
      Date.parse(row.leaseNotAfter) > this.nowMs()
    );
  }

  /**
   * An approved request is startable only while its window can still produce access; once the window
   * lapses the server rejects activation, so the Start button must not be offered.
   */
  protected canStart(row: MyAccessRequestRow): boolean {
    return (
      row.status === "approved" &&
      row.producedLeaseId == null &&
      Date.parse(row.leaseNotAfter) > this.nowMs()
    );
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
        message: this.i18nService.t("pamMyRequestsCanceledToast"),
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
      // A taken single-active-lease slot, an org-wide freeze, or anything else the server rejects
      // activation for surfaces here. The "Api" variant carries the server's own message, shown
      // verbatim; other variants fall back to the generic string. Either way the approved request
      // stays activatable for a manual retry.
      const serverMessage =
        this.leasingErrorService.isLeasingError(e) && e.variant === "Api" ? e.message : undefined;
      this.toastService.showToast({
        variant: "error",
        message: serverMessage ?? this.i18nService.t("pamStartLeaseError"),
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
   * End (revoke) an active lease early. Confirms first, then hands off to the service, which removes
   * the lease optimistically and rolls back on failure.
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
