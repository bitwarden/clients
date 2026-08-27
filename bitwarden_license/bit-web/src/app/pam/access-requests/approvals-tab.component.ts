import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

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
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { AccessDecisionVerdict } from "../abstractions/access-lease";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";
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

  /** Ids currently being decided, so a second click on the same row is a no-op. */
  private readonly deciding = signal<Set<string>>(new Set());

  /** Lease ids currently being revoked, for the same reason as {@link deciding}. */
  private readonly revoking = signal<Set<string>>(new Set());

  protected readonly loading = toSignal(this.inbox.loading$, { initialValue: true });

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

  private readonly cipherById = toSignal(this.inbox.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  /** Both sections' rows before filtering — what the chip filters offer options from. */
  private readonly filterableRows = computed<FilterableRow[]>(() => [
    ...this.allRows(),
    ...this.allLeases(),
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

  protected readonly leaseRows = computed(() => this.applyFilters(this.allLeases()));

  /**
   * Whether the tab has anything at all before filtering, across both sections. Distinguishes an
   * empty inbox (nothing to do) from a filter that matched nothing (something to do, just not
   * visible), which need different copy and, for the latter, the filter controls left on screen.
   */
  protected readonly hasRows = computed(
    () => this.allRows().length > 0 || this.allLeases().length > 0,
  );

  protected readonly dataSource = new TableDataSource<ApprovalRow>();
  protected readonly leasesDataSource = new TableDataSource<ManagedLeaseRow>();

  /**
   * Badge state is memoised per lease so the shared badge component sees a stable input. A fresh
   * object would re-run the badge's own effect and restart the countdown interval it runs itself.
   * Keyed off the unfiltered rows so that typing in the search box does not churn the surviving
   * badges.
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
  private applyFilters<T extends FilterableRow>(rows: T[]): T[] {
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
   */
  protected async decide(row: ApprovalRow, verdict: AccessDecisionVerdict): Promise<void> {
    if (!row.canDecide || this.isDeciding(row)) {
      return;
    }
    const result = await firstValueFrom(
      DecideDialogComponent.open(this.dialogService, { data: { verdict, row } }).closed,
    );
    if (!result?.confirmed) {
      return;
    }

    const key = String(row.id);
    this.deciding.update((ids) => new Set([...ids, key]));
    try {
      await this.inbox.decide(row.id, verdict, result.comment);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          verdict === "approve" ? "pamInboxApprovedToast" : "pamInboxDeniedToast",
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

/** Deduped, locale-sorted chip options from a list of possibly-blank labels. */
function distinctOptions(labels: Array<string | null>): ChipFilterOption<string>[] {
  const distinct = new Set(labels.filter((label): label is string => !!label));
  return [...distinct].sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
}
