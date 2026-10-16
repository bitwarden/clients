import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
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
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  DialogService,
  FILTER_CONTROL,
  FilterMenuComponent,
  FilterOptionComponent,
  IconComponent as BitIconComponent,
  IconButtonModule,
  IconTileOptions,
  SearchModule,
  SortFn,
  ToastService,
  TypographyModule,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessLeaseId, AccessRequestId, activateAccessErrorMessageKey } from "..";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { DurationCompoundPipe } from "../date/duration-compound.pipe";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { RemainingTimePipe } from "../date/remaining-time.pipe";
import { WindowInstantPipe } from "../date/window-instant.pipe";
import { WindowRangePipe } from "../date/window-range.pipe";
import { selectedFilterStrings } from "../helpers/selected-filter-strings";

import {
  MyAccessLeaseRow,
  MyAccessRequestRow,
  isRedeemableGrant,
  lapsedGrantBadge,
} from "./my-access-row";
import { MyAccessService } from "./my-access.service";
import {
  MY_REQUEST_STATUS_ICON,
  MY_REQUEST_STATUS_LABEL_KEY,
  MY_REQUEST_STATUSES,
  MyRequestRow,
  MyRequestStatus,
  buildMyRequestRows,
  myRequestStatus,
  myRequestStatusRank,
} from "./my-request-row";

type FilterOption = { label: string; value: string; iconTile?: IconTileOptions };

type FilterableRow = {
  collectionId: string;
  cipherName: string | null;
  collectionName: string | null;
};

/**
 * The toolbar's raw values by filter key, where `search` is the key the table gives a projected
 * `bit-search`. Untyped, since a chip's value is `unknown`.
 */
type MyRequestsFilterValues = { search?: unknown; collection?: unknown; status?: unknown };

/**
 * The caller's own access in one table: undecided requests, unactivated grants and held leases,
 * each row carrying the status that decides what can be done with it.
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
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    ButtonModule,
    FilterMenuComponent,
    FilterOptionComponent,
    BitIconComponent,
    IconButtonModule,
    IconComponent,
    SearchModule,
    TypographyModule,
    I18nPipe,
    DurationCompoundPipe,
    DurationShortPipe,
    WindowInstantPipe,
    WindowRangePipe,
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
  protected readonly starting = signal<Set<AccessRequestId>>(new Set());
  protected readonly ending = signal<Set<AccessLeaseId>>(new Set());

  /** Free-text search across item and collection names. */
  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });

  /**
   * `bit-filter-menu` isn't a `ControlValueAccessor`, so each chip owns its own selection and is
   * driven through the {@link FILTER_CONTROL} contract rather than a `FormControl`.
   */
  private readonly statusFilter = viewChild("statusFilter", { read: FILTER_CONTROL });
  private readonly collectionFilter = viewChild("collectionFilter", { read: FILTER_CONTROL });

  private readonly allPending = toSignal(this.myAccess.pendingRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly allExtensions = toSignal(this.myAccess.extensionRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly allLeases = toSignal(this.myAccess.leases$, {
    initialValue: [] as MyAccessLeaseRow[],
  });

  protected readonly nowMs = toSignal(
    toObservable(computed(() => this.myRequestRows().length > 0)).pipe(
      switchMap((anyRequests) => (anyRequests ? this.ticker.ticks$ : EMPTY)),
    ),
    { initialValue: Date.now() },
  );

  private readonly cipherById = toSignal(this.myAccess.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  /** Every distinct collection present across the caller's rows, for the Collection filter. */
  protected readonly collectionOptions = computed<FilterOption[]>(() => {
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

  /**
   * Overrides the host Pending table's option counts, which see only pending rows, since the chip
   * narrows all three sections. Counted without the search term, like the host's absolute counts.
   */
  protected readonly collectionCounts = computed<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const row of [...this.allPending(), ...this.allExtensions(), ...this.allLeases()]) {
      counts.set(row.collectionId, (counts.get(row.collectionId) ?? 0) + 1);
    }
    return counts;
  });

  /**
   * Memoised per lease, since a fresh state object each tick would restart the badge's countdown.
   * Keyed off the unfiltered rows so a search doesn't churn the remaining badges.
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

  /** One shared instance so the badge input stays stable. */
  protected readonly readyBadge: AccessBadgeState = { kind: "ready" };

  protected readonly myRequestRows = computed<MyRequestRow[]>(() =>
    buildMyRequestRows(this.allLeases(), this.allPending(), this.allExtensions()),
  );

  protected readonly statusOptions = computed<FilterOption[]>(() =>
    MY_REQUEST_STATUSES.map((status) => ({
      value: status,
      label: this.i18nService.t(MY_REQUEST_STATUS_LABEL_KEY[status]),
      iconTile: MY_REQUEST_STATUS_ICON[status],
    })),
  );

  protected readonly statusCounts = computed<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>(MY_REQUEST_STATUSES.map((status) => [status, 0]));
    for (const row of this.myRequestRows()) {
      const status = this.rowStatus(row);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly noCollectionOptions = computed(() => this.collectionOptions().length === 0);

  protected readonly byStatus: SortFn = (a: MyRequestRow, b: MyRequestRow): number =>
    myRequestStatusRank(this.rowStatus(a)) - myRequestStatusRank(this.rowStatus(b));

  protected readonly myRequestsTable = defineTable<MyRequestRow, "window" | "status" | "actions">(
    this.myRequestRows,
  );

  protected rowStatus(row: MyRequestRow): MyRequestStatus {
    return myRequestStatus(row, this.nowMs());
  }

  protected readonly myRequestMatchesFilter = (
    row: MyRequestRow,
    values: MyRequestsFilterValues,
  ): boolean => {
    const statuses = selectedFilterStrings(values.status);
    if (statuses.length > 0 && !statuses.includes(this.rowStatus(row))) {
      return false;
    }
    const collections = selectedFilterStrings(values.collection);
    if (collections.length > 0 && !collections.includes(row.collectionId)) {
      return false;
    }
    return matchesTerm(row, searchTerm(values));
  };

  /** Undefined when absent from the caller's vault, in which case no favicon renders. */
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

  /** An opened window renders as "until X" instead of a from-to range. */
  protected hasOpened(notBefore: string): boolean {
    return Date.parse(notBefore) <= this.nowMs();
  }

  /** A lapsed grant can no longer be started, so Cancel is withheld like Start until it expires. */
  protected canCancel(row: MyAccessRequestRow): boolean {
    if (row.status === "pending") {
      return true;
    }
    return isRedeemableGrant(row, this.nowMs());
  }

  protected canStart(row: MyAccessRequestRow): boolean {
    return isRedeemableGrant(row, this.nowMs()) && this.hasOpened(row.leaseNotBefore);
  }

  protected badgesReady(row: MyAccessRequestRow): boolean {
    return isRedeemableGrant(row, this.nowMs());
  }

  protected readonly lapsedGrantBadge = lapsedGrantBadge;

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
      // A refusal (e.g. another active lease on the item) leaves the request activatable for a
      // retry.
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

  /** Ends the caller's own lease early, which records it as canceled, not revoked. */
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

function searchTerm(values: MyRequestsFilterValues): string {
  return typeof values.search === "string" ? values.search.trim().toLowerCase() : "";
}

function matchesTerm(row: FilterableRow, term: string): boolean {
  if (term === "") {
    return true;
  }
  return `${row.cipherName ?? ""} ${row.collectionName ?? ""}`.toLowerCase().includes(term);
}
