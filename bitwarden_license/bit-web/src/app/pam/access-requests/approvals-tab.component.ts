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
  ButtonModule,
  ChipFilterComponent,
  ChipFilterOption,
  DialogService,
  NoItemsModule,
  SearchModule,
  SpinnerComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { AccessDecisionVerdict } from "../abstractions/access-lease";
import { ApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { DecideDialogComponent } from "../approvals/decide-dialog/decide-dialog.component";

/**
 * "Approvals" tab — the requests awaiting the caller's decision, oldest first.
 *
 * Only ever rendered for an approver: `canViewApprovalsGuard` redirects a non-approver's deep
 * link to the sibling `my-requests` tab, and the shell (`access-requests.component.html`) only
 * renders the "Approvals" tab-link when `hasApprovalPrivileges$` is true — so a non-approver
 * never reaches this component.
 *
 * Data, ordering, and the optimistic decide live in {@link ApproverInboxService} (shared with the
 * History tab); this component owns the toolbar, the table, the dialog, and the toasts.
 */
@Component({
  selector: "pam-approvals-tab",
  templateUrl: "./approvals-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    ChipFilterComponent,
    IconComponent,
    NoItemsModule,
    SearchModule,
    SpinnerComponent,
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

  private readonly cipherById = toSignal(this.inbox.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  /** Every distinct collection present in the inbox, for the Collection filter. */
  protected readonly collectionOptions = computed<ChipFilterOption<string>[]>(() =>
    distinctOptions(this.allRows().map((row) => row.collectionName)),
  );

  /** Every distinct requester present in the inbox, for the Requester filter. */
  protected readonly requesterOptions = computed<ChipFilterOption<string>[]>(() =>
    distinctOptions(this.allRows().map((row) => row.requester)),
  );

  protected readonly rows = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const collection = this.collectionFilter();
    const requester = this.requesterFilter();
    return this.allRows().filter(
      (row) =>
        (term === "" || row.searchText.includes(term)) &&
        (collection == null || row.collectionName === collection) &&
        (requester == null || row.requester === requester),
    );
  });

  /**
   * How many requests await a decision before filtering. Distinguishes an empty inbox (nothing to
   * do) from a filter that matched nothing (something to do, just not visible), which need different
   * copy and, for the latter, the filter controls left on screen.
   */
  protected readonly totalRows = computed(() => this.allRows().length);

  protected readonly dataSource = new TableDataSource<ApprovalRow>();

  constructor() {
    effect(() => {
      this.dataSource.data = this.rows();
    });
  }

  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  protected isDeciding(row: ApprovalRow): boolean {
    return this.deciding().has(String(row.id));
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
}

/** Deduped, locale-sorted chip options from a list of possibly-blank labels. */
function distinctOptions(labels: Array<string | null>): ChipFilterOption<string>[] {
  const distinct = new Set(labels.filter((label): label is string => !!label));
  return [...distinct].sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
}
