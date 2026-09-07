import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { EMPTY, switchMap } from "rxjs";

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
  SearchModule,
  SortDirection,
  SortFn,
  TableDataSource,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessLeaseId, AccessRequestId, activateAccessErrorMessageKey } from "..";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { RemainingTimePipe } from "../date/remaining-time.pipe";

import {
  MyAccessLeaseRow,
  MyAccessRequestRow,
  TerminalStatusBadge,
  isRedeemableGrant,
  lapsedGrantBadge,
} from "./my-access-row";
import { MyAccessService } from "./my-access.service";

/** A row carrying the id + collection fields the toolbar filters against. */
type FilterableRow = {
  collectionId: string;
  cipherName: string | null;
  collectionName: string | null;
};

/**
 * A row of the active-access table. Exactly one of `lease` / `request` is set. `cipherName` /
 * `notAfter` are flattened onto the row, since `bit-table` sorts on top-level properties.
 */
type ActiveAccessRow = {
  readonly testId: string;
  readonly requestId: AccessRequestId;
  readonly cipherId: string;
  readonly cipherName: string | null;
  readonly collectionName: string | null;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly lease: MyAccessLeaseRow | null;
  readonly request: MyAccessRequestRow | null;
};

/** Ascending by window end; meaningful only within one row kind. */
const byWindowEnd = (a: ActiveAccessRow, b: ActiveAccessRow): number =>
  Date.parse(a.notAfter) - Date.parse(b.notAfter);

/**
 * "My requests" tab: the caller's own PAM access, in three sections — Pending, Extension
 * requests, and Active access (leases held plus approved-but-unactivated grants).
 *
 * Data, name resolution, and optimistic cancel/end live in {@link MyAccessService} (shared
 * across tabs); this component owns the view: the live countdown, the filter, and action gating.
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
    SearchModule,
    TableModule,
    TypographyModule,
    I18nPipe,
    DurationShortPipe,
    RemainingTimePipe,
  ],
})
export class MyRequestsTabComponent {
  private readonly myAccess = inject(MyAccessService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly ticker = inject(AccessBadgeTickerService);

  protected readonly cancelling = signal<Set<AccessRequestId>>(new Set());
  /** Ids of approved requests currently being activated (prevents double-click). */
  protected readonly starting = signal<Set<AccessRequestId>>(new Set());
  /** Ids of active leases currently being ended (prevents double-click). */
  protected readonly ending = signal<Set<AccessLeaseId>>(new Set());

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

  /**
   * Ticks once a second so the countdowns stay live, sharing the clock the badges use; torn down
   * while no request is listed, since leases carry their own countdowns.
   *
   * Gated on the unfiltered requests, not on anything downstream of the clock, to avoid feedback.
   */
  protected readonly nowMs = toSignal(
    toObservable(computed(() => this.allPending().length > 0)).pipe(
      switchMap((anyRequests) => (anyRequests ? this.ticker.ticks$ : EMPTY)),
    ),
    { initialValue: Date.now() },
  );

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

  private readonly filteredPending = computed(() => this.applyFilters(this.allPending()));

  /** Rows still awaiting an approver's decision — the only thing "Pending" holds. */
  protected readonly pendingRows = computed(() =>
    this.filteredPending().filter((row) => row.status === "pending"),
  );

  /**
   * Approved and awaiting activation. The exact complement of {@link pendingRows}, split on
   * `status` alone: a clock-dependent split (`canStart`) would drop a grant whose activation
   * window has lapsed out of both sections.
   */
  private readonly approvedRows = computed(() =>
    this.filteredPending().filter((row) => row.status !== "pending"),
  );

  protected readonly extensionRows = computed(() => this.applyFilters(this.allExtensions()));
  private readonly leases = computed(() => this.applyFilters(this.allLeases()));

  /**
   * Depends only on `approvedRows` and `leases`, never `nowMs()`, since a per-tick rebuild would
   * hand every badge a fresh input and restart its countdown ({@link leaseBadgeStates}).
   *
   * Held leases come first; the Window column isn't sortable, since `notAfter` means "ends" on a
   * lease but "activation deadline" on a grant. The Item column sorts but keeps the same grouping.
   */
  protected readonly activeAccessRows = computed<ActiveAccessRow[]>(() => {
    const held: ActiveAccessRow[] = this.leases().map((lease): ActiveAccessRow => ({
      testId: `my-access-lease-${lease.id}`,
      requestId: lease.requestId,
      cipherId: lease.cipherId,
      cipherName: lease.cipherName,
      collectionName: lease.collectionName,
      notBefore: lease.notBefore,
      notAfter: lease.notAfter,
      lease,
      request: null,
    }));
    const granted: ActiveAccessRow[] = this.approvedRows().map((request): ActiveAccessRow => ({
      testId: `my-access-approved-${request.id}`,
      requestId: request.id,
      cipherId: request.cipherId,
      cipherName: request.cipherName,
      collectionName: request.collectionName,
      notBefore: request.leaseNotBefore,
      notAfter: request.leaseNotAfter,
      lease: null,
      request,
    }));
    return [...held.sort(byWindowEnd), ...granted.sort(byWindowEnd)];
  });

  /**
   * Badge state is memoised per lease so the shared badge component sees a stable input across
   * the per-second tick; a fresh object each tick would restart its countdown interval. Keyed off
   * the unfiltered rows so search does not churn surviving badges.
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

  /** A stable identity so the badge input does not churn; the `ready` state carries no payload. */
  protected readonly readyBadge: AccessBadgeState = { kind: "ready" };

  /**
   * The Item column's sort. `bit-table` multiplies a custom comparator's result by its own
   * direction modifier, so the "held access first" term is pre-multiplied to cancel that out and
   * hold in both directions; the item name only decides within a group.
   */
  protected readonly byItemName: SortFn = (
    a: ActiveAccessRow,
    b: ActiveAccessRow,
    direction?: SortDirection,
  ): number => {
    const grouping = (a.lease == null ? 1 : 0) - (b.lease == null ? 1 : 0);
    if (grouping !== 0) {
      return direction === "desc" ? -grouping : grouping;
    }
    return (a.cipherName ?? "").localeCompare(b.cipherName ?? "");
  };

  /**
   * Each table renders from its own data source so `bit-table` can sort the rows independently.
   */
  protected readonly pendingDataSource = new TableDataSource<MyAccessRequestRow>();
  protected readonly extensionDataSource = new TableDataSource<MyAccessRequestRow>();
  protected readonly activeAccessDataSource = new TableDataSource<ActiveAccessRow>();

  constructor() {
    effect(() => {
      this.pendingDataSource.data = this.pendingRows();
    });
    effect(() => {
      this.extensionDataSource.data = this.extensionRows();
    });
    effect(() => {
      this.activeAccessDataSource.data = this.activeAccessRows();
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

  /** The decrypted cipher for a row, undefined when absent from the caller's vault; the template renders `app-vault-icon` only then. */
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
   * A pending/approved request's window has already opened — shown as "until X" instead of
   * "from – to". This backend's `leaseNotBefore` is never absent, unlike the poc's mocked one.
   */
  protected startsNow(row: Pick<MyAccessRequestRow, "leaseNotBefore">): boolean {
    return Date.parse(row.leaseNotBefore) <= this.nowMs();
  }

  /**
   * A request the requester can withdraw: still pending, or an approved-but-not-activated request
   * whose window can still produce access. Past that it can no longer be started, so Cancel is
   * withheld like Start, awaiting server-side expiry.
   */
  protected canCancel(row: MyAccessRequestRow): boolean {
    if (row.status === "pending") {
      return true;
    }
    return isRedeemableGrant(row, this.nowMs());
  }

  /**
   * An approved request is startable only while its window can still produce access; past that
   * the server rejects activation, so Start is not offered.
   */
  protected canStart(row: MyAccessRequestRow): boolean {
    return isRedeemableGrant(row, this.nowMs());
  }

  /**
   * The grant can be started right now: approved, unactivated, and inside its window. Only then is
   * "Ready to use" a true statement about the access the viewer holds.
   */
  protected isReadyNow(row: MyAccessRequestRow): boolean {
    return this.canStart(row) && this.startsNow(row);
  }

  /**
   * The Status badge for a grant awaiting activation. A lapsed grant sits in the same section as the
   * access the caller holds, so it must not keep the model's green "Approved".
   */
  protected grantBadge(row: MyAccessRequestRow): TerminalStatusBadge | null {
    return this.canStart(row) ? row.statusBadge : lapsedGrantBadge;
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
      // A taken slot, an org freeze, or any other server-side activation refusal surfaces here;
      // the approved request stays activatable for a manual retry.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(activateAccessErrorMessageKey(e)),
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
