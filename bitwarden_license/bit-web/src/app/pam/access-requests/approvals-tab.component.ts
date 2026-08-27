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
import { EMPTY, distinctUntilChanged, firstValueFrom, switchMap } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
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
  SkeletonComponent,
  SkeletonTextComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { AccessDecisionVerdict } from "../abstractions/access-lease";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { ApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { DecideDialogComponent } from "../approvals/decide-dialog/decide-dialog.component";
import { ManagedLeaseRow } from "../approvals/managed-lease-row";
import { DurationShortPipe } from "../date/duration-short.pipe";

/** The fields the toolbar filters against, carried by both sections' row models. */
type FilterableRow = { searchText: string; collectionName: string | null; requester: string };

/**
 * "Approvals" tab — the requests awaiting the caller's decision, oldest first, and the access
 * already running on the collections they manage.
 *
 * Only ever rendered for an approver: `canViewApprovalsGuard` redirects a non-approver's deep
 * link to the sibling `my-requests` tab, and the shell (`access-requests.component.html`) only
 * renders the "Approvals" tab-link when {@link ApprovalPrivilegeService} says so — so a non-approver
 * never reaches this component.
 *
 * Data, ordering, and the optimistic decide/revoke live in {@link ApproverInboxService} (shared with
 * the History tab); this component owns the toolbar, the tables, the dialogs, and the toasts.
 */
@Component({
  selector: "pam-approvals-tab",
  templateUrl: "./approvals-tab.component.html",
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
    DurationShortPipe,
    IconComponent,
    NoItemsModule,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
    TableModule,
    TooltipDirective,
    TypographyModule,
    I18nPipe,
  ],
})
export class ApprovalsTabComponent {
  private readonly inbox = inject(ApproverInboxService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly ticker = inject(AccessBadgeTickerService);

  /** Ids currently being decided, so a second click on the same row is a no-op. */
  private readonly deciding = signal<Set<string>>(new Set());

  /** Lease ids currently being revoked, for the same reason as {@link deciding}. */
  private readonly revoking = signal<Set<string>>(new Set());

  protected readonly loading = toSignal(this.inbox.loading$, { initialValue: true });

  /**
   * The skeleton is held back until the load has run for a second, per the component library's
   * display guidance, so an inbox that arrives quickly never flashes it.
   */
  protected readonly showSkeleton = toSignal(
    this.inbox.loading$.pipe(distinctUntilChanged(), skeletonLoadingDelay()),
    { initialValue: false },
  );

  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });
  protected readonly collectionControl = new FormControl<string | null>(null);
  protected readonly requesterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: "" });
  private readonly collectionFilter = toSignal(this.collectionControl.valueChanges, {
    initialValue: null,
  });
  private readonly requesterFilter = toSignal(this.requesterControl.valueChanges, {
    initialValue: null,
  });

  private readonly allRows = toSignal(this.inbox.inboxRows$, { initialValue: [] as ApprovalRow[] });

  private readonly allLeases = toSignal(this.inbox.activeLeaseRows$, {
    initialValue: [] as ManagedLeaseRow[],
  });

  /**
   * Ticks once a second so a lease that lapses while the tab is open stops being listed. Shares the
   * one clock the badges already run on, and only observes it while there is a lease to expire — an
   * approver sitting on a pending-only queue leaves that clock torn down rather than scheduling a
   * round of change detection every second that can never change anything.
   */
  private readonly nowMs = toSignal(
    toObservable(computed(() => this.allLeases().length > 0)).pipe(
      switchMap((anyLeases) => (anyLeases ? this.ticker.ticks$ : EMPTY)),
    ),
    { initialValue: Date.now() },
  );

  private readonly cipherById = toSignal(this.inbox.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  /**
   * The leases still inside their window. `activeLeaseRows$` tests the window too, but against the
   * clock stamped at load, and a lease lapsing on its own produces no server push to reload it away
   * — so without a live clock here the row would stay listed, counted and revocable indefinitely.
   *
   * Compared by identity so the once-a-second tick only reaches `leasesDataSource` when the rows
   * really change; reassigning its data every second would re-create every row.
   */
  private readonly liveLeases = computed(
    () => this.allLeases().filter((row) => row.endsAtMs > this.nowMs()),
    { equal: sameRows },
  );

  /** Both sections' rows before filtering — what the chip filters offer options from. */
  private readonly filterableRows = computed<FilterableRow[]>(() => [
    ...this.allRows(),
    ...this.liveLeases(),
  ]);

  /** Every distinct collection present on the tab, for the Collection filter. */
  protected readonly collectionOptions = computed<ChipFilterOption<string>[]>(() =>
    distinctOptions(this.filterableRows().map((row) => row.collectionName)),
  );

  /** Every distinct requester present on the tab, for the Requester filter. */
  protected readonly requesterOptions = computed<ChipFilterOption<string>[]>(() =>
    distinctOptions(this.filterableRows().map((row) => row.requester)),
  );

  protected readonly rows = computed(() => this.applyFilters(this.allRows()));

  protected readonly leaseRows = computed(() => this.applyFilters(this.liveLeases()));

  /**
   * Whether a section is empty only because the toolbar filters excluded its own rows. Its empty
   * copy asserts an absolute, so rendering it in this case tells an operator that no privileged
   * access is running while a lease the filters hid is still live and still revocable.
   */
  protected readonly pendingHiddenByFilters = computed(
    () => this.rows().length === 0 && this.allRows().length > 0,
  );

  protected readonly activeAccessHiddenByFilters = computed(
    () => this.leaseRows().length === 0 && this.liveLeases().length > 0,
  );

  /**
   * Whether the tab has anything at all before filtering, across both sections. Distinguishes an
   * empty inbox (nothing to do) from a filter that matched nothing (something to do, just not
   * visible), which need different copy and, for the latter, the filter controls left on screen.
   */
  protected readonly hasRows = computed(() => this.filterableRows().length > 0);

  /**
   * Whether the skeleton table is on screen. Drives the `role="status"` announcement as well, so
   * that a load finishing inside the delay never announces a screen the user was not shown.
   */
  protected readonly skeletonVisible = computed(() => this.showSkeleton() && !this.hasRows());

  /** Five fills the space the table occupies without implying a row count the inbox may not have. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly dataSource = new TableDataSource<ApprovalRow>();
  protected readonly leasesDataSource = new TableDataSource<ManagedLeaseRow>();

  /**
   * Badge state is memoised per lease so the `[state]` input does not change identity on every
   * change-detection pass. Keyed off the unfiltered rows so that typing in the search box does not
   * churn the surviving badges.
   */
  private readonly leaseBadgeStates = computed(
    () =>
      new Map<string, AccessBadgeState>(
        this.allLeases().map((row) => [
          String(row.leaseId),
          { kind: "active", expiresAt: new Date(row.endsAt) },
        ]),
      ),
  );

  constructor() {
    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.leasesDataSource.data = this.leaseRows();
    });
  }

  /**
   * The toolbar's three filters, applied to either section's rows. Both row models carry the same
   * three fields, so one predicate keeps the two sections from drifting apart.
   */
  private applyFilters<T extends FilterableRow>(rows: readonly T[]): T[] {
    const term = this.searchTerm().trim().toLowerCase();
    const collection = this.collectionFilter();
    const requester = this.requesterFilter();
    return rows.filter(
      (row) =>
        (term === "" || row.searchText.includes(term)) &&
        (collection == null || row.collectionName === collection) &&
        (requester == null || row.requester === requester),
    );
  }

  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  protected leaseBadgeState(id: ManagedLeaseRow["leaseId"]): AccessBadgeState | null {
    return this.leaseBadgeStates().get(String(id)) ?? null;
  }

  protected isDeciding(row: ApprovalRow): boolean {
    return this.deciding().has(String(row.id));
  }

  protected isRevoking(row: ManagedLeaseRow): boolean {
    return this.revoking().has(String(row.leaseId));
  }

  /**
   * Confirm and record a decision. Only an explicit confirm decides — dismissing the dialog by any
   * other route (Cancel, the header X, Escape, a backdrop click) closes with `undefined` and must
   * leave the request untouched.
   *
   * `verdict` is only what the dialog OPENS on. The approve variant offers "Deny request", which
   * switches it in place, so the decision recorded here has to be the verdict the dialog closed
   * with — recording the requested one would approve a request the approver denied.
   */
  protected async decide(row: ApprovalRow, verdict: AccessDecisionVerdict): Promise<void> {
    if (!row.canDecide || this.isDeciding(row)) {
      return;
    }
    const result = await firstValueFrom(
      DecideDialogComponent.open(this.dialogService, {
        data: { verdict, row, cipher: this.cipherFor(row.cipherId) },
      }).closed,
    );
    if (!result?.confirmed) {
      return;
    }

    const key = String(row.id);
    this.deciding.update((ids) => new Set([...ids, key]));
    try {
      await this.inbox.decide(row.id, result.verdict, result.comment);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          result.verdict === "approve" ? "pamInboxApprovedToast" : "pamInboxDeniedToast",
        ),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxDecisionFailed"),
      });
    } finally {
      this.deciding.update((ids) => {
        const next = new Set(ids);
        next.delete(key);
        return next;
      });
    }
  }

  /**
   * Confirm and end a lease that is running right now. The confirm is not optional: this cuts off
   * access someone is already using, and every dismissal route resolves false.
   */
  protected async revoke(row: ManagedLeaseRow): Promise<void> {
    if (this.isRevoking(row)) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamInboxRevoke" },
      content: { key: "pamInboxRevokeConfirm" },
      acceptButtonText: { key: "pamInboxRevoke" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    const key = String(row.leaseId);
    this.revoking.update((ids) => new Set([...ids, key]));
    try {
      await this.inbox.revokeLease(row.requestId, row.leaseId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamInboxRevokedToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxRevokeFailed"),
      });
    } finally {
      this.revoking.update((ids) => {
        const next = new Set(ids);
        next.delete(key);
        return next;
      });
    }
  }
}

/** Whether two row lists hold the same row objects in the same order. */
function sameRows(a: readonly ManagedLeaseRow[], b: readonly ManagedLeaseRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row === b[index]);
}

/** Deduped, locale-sorted chip options from a list of possibly-blank labels. */
function distinctOptions(labels: Array<string | null>): ChipFilterOption<string>[] {
  const distinct = new Set(labels.filter((label): label is string => !!label));
  return [...distinct].sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
}
