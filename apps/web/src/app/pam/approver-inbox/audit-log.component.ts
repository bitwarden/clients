import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from "@angular/core";

import {
  ButtonModule,
  TableDataSource,
  TableModule,
  ToggleGroupModule,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { AccessRequestDetailsResponse } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { FlatHistoryRow, HistoryFilter, flattenHistory } from "./history-row";

/**
 * Audit log tab: every request/lease the viewer can see — the decision history for the
 * collections they manage, merged with their own resolved requests — as one time-sorted,
 * bucketable table.
 *
 * Reuses the inbox bucketing/labeling helpers ({@link flattenHistory}). The per-row Revoke /
 * Cancel-approval affordances appear only on rows the viewer manages ({@link managedIds}); the
 * network calls stay with the parent, reached via {@link revoke} / {@link cancelApproval}.
 */
@Component({
  selector: "app-pam-audit-log",
  templateUrl: "./audit-log.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    I18nPipe,
    ButtonModule,
    TableModule,
    ToggleGroupModule,
    TooltipDirective,
    TypographyModule,
  ],
})
export class AuditLogComponent {
  /** Merged, de-duplicated history items (managed-collection decisions + the viewer's own). */
  readonly items = input.required<AccessRequestDetailsResponse[]>();
  /** Ids of items the viewer can act on (the managed-collection decisions). */
  readonly managedIds = input<Set<string>>(new Set());
  /** Stable "now" reference for relative-time labels. */
  readonly now = input<Date>(new Date());
  /** Lease ids currently being revoked (drives per-row button loading). */
  readonly revoking = input<Set<string>>(new Set());
  /** Request ids whose approval is currently being cancelled. */
  readonly cancelling = input<Set<string>>(new Set());

  readonly revoke = output<AccessRequestDetailsResponse>();
  readonly cancelApproval = output<AccessRequestDetailsResponse>();

  /** Active filter pill. "all" shows every row. */
  protected readonly filter = signal<HistoryFilter>("all");

  protected readonly flatHistory = computed<FlatHistoryRow[]>(() => {
    const managed = this.managedIds();
    return flattenHistory(this.items(), this.now(), (item) => managed.has(item.id));
  });

  protected readonly filtered = computed<FlatHistoryRow[]>(() => {
    const f = this.filter();
    if (f === "all") {
      return this.flatHistory();
    }
    return this.flatHistory().filter((row) => row.bucket === f);
  });

  protected readonly dataSource = new TableDataSource<FlatHistoryRow>();

  constructor() {
    effect(() => {
      this.dataSource.data = this.filtered();
    });
  }
}
