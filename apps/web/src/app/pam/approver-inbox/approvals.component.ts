import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { lastValueFrom } from "rxjs";

import {
  ButtonModule,
  ChipFilterComponent,
  ChipFilterOption,
  DialogService,
  IconModule,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  TableModule,
  ToggleGroupModule,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { AccessDecisionVerdict, AccessRequestDetailsResponse, canApprove } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { ApprovalRow, toApprovalRow } from "./approval-row";
import { DecideDialogComponent } from "./decide-dialog.component";

/** A request the parent should action; the comment comes from the confirm dialog. */
export type DecideEvent = {
  request: AccessRequestDetailsResponse;
  verdict: AccessDecisionVerdict;
  comment: string | undefined;
};

type DisplayRow = ApprovalRow & { canDecide: boolean };
type Density = "comfortable" | "compact";

/**
 * Approvals tab: a filterable, sortable table of pending lease requests for the
 * collections the caller manages, replacing the former card list.
 *
 * The server filters the queue by Manage permission; this component only enforces
 * the self-approval guard ({@link canDecide}) as a UX safeguard. The network call,
 * optimistic removal, and toasts stay with the parent, reached via {@link decide}.
 */
@Component({
  selector: "app-pam-approvals",
  templateUrl: "./approvals.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    I18nPipe,
    ButtonModule,
    ChipFilterComponent,
    IconModule,
    NoItemsModule,
    SearchModule,
    TableModule,
    ToggleGroupModule,
    TooltipDirective,
    TypographyModule,
  ],
})
export class ApprovalsComponent {
  /** Pending requests to render (already actionable + sorted by the inbox service). */
  readonly requests = input.required<AccessRequestDetailsResponse[]>();
  /** Current user, for the self-approval guard. Null disables every row's actions. */
  readonly currentUserId = input<string | null>(null);
  /** Stable "now" reference for elapsed/relative-time fields. */
  readonly now = input<Date>(new Date());
  /** Whether the first load is still in flight (drives the loading copy). */
  readonly loading = input<boolean>(false);
  /**
   * Whether the caller manages any leasing collection. Drives the two empty states:
   * "no requests waiting" vs "you're not an approver".
   */
  readonly hasManagerCollections = input<boolean>(true);

  /** Emitted once per confirmed decision; the parent makes the network call. */
  readonly decide = output<DecideEvent>();

  private readonly dialogService = inject(DialogService);

  protected readonly density = signal<Density>("comfortable");
  protected readonly compact = computed(() => this.density() === "compact");

  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });
  protected readonly collectionControl = new FormControl<string | null>(null);
  protected readonly requesterControl = new FormControl<string | null>(null);

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });
  private readonly collectionFilter = toSignal(this.collectionControl.valueChanges, {
    initialValue: null,
  });
  private readonly requesterFilter = toSignal(this.requesterControl.valueChanges, {
    initialValue: null,
  });

  protected readonly rows = computed<DisplayRow[]>(() => {
    const userId = this.currentUserId();
    return this.requests().map((request) => ({
      ...toApprovalRow(request, this.now()),
      canDecide: userId != null && canApprove({ requesterId: request.requesterId }, { id: userId }),
    }));
  });

  protected readonly dataSource = new TableDataSource<DisplayRow>();

  /** Distinct collection names present in the loaded rows, for the Collection filter. */
  protected readonly collectionOptions = computed<ChipFilterOption<string>[]>(() =>
    [
      ...new Set(
        this.requests()
          .map((r) => r.collectionName)
          .filter((n): n is string => !!n),
      ),
    ]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ label: name, value: name, icon: "bwi-collection-shared" })),
  );

  /** Distinct requester display values present in the loaded rows, for the Requester filter. */
  protected readonly requesterOptions = computed<ChipFilterOption<string>[]>(() =>
    [
      ...new Set(
        this.requests()
          .map((r) => r.requesterName || r.requesterEmail)
          .filter((n): n is string => !!n),
      ),
    ]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ label: name, value: name, icon: "bwi-user" })),
  );

  constructor() {
    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      const text = this.searchText().trim().toLowerCase();
      const collection = this.collectionFilter();
      const requester = this.requesterFilter();
      this.dataSource.filter = (row) =>
        (text === "" || row.searchText.includes(text)) &&
        (collection == null || row.collectionName === collection) &&
        (requester == null || row.requester === requester);
    });
  }

  /** Open the confirm dialog, then forward the verdict + comment to the parent. */
  protected async openDecision(row: DisplayRow, verdict: AccessDecisionVerdict): Promise<void> {
    if (!row.canDecide) {
      return;
    }
    const ref = DecideDialogComponent.open(this.dialogService, {
      data: { verdict, request: row.request, now: this.now() },
    });
    const result = await lastValueFrom(ref.closed);
    // Only an explicit confirm carries `confirmed`. Dismissing the dialog any other way — the
    // header X, Cancel, a backdrop click, or Escape — closes with `undefined` and must NOT decide.
    if (!result?.confirmed) {
      return;
    }
    this.decide.emit({ request: row.request, verdict, comment: result.comment });
  }

  protected readonly approve = AccessDecisionVerdict.Approve;
  protected readonly deny = AccessDecisionVerdict.Deny;
}
