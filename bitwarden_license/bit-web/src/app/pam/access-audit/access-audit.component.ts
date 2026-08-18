import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  BadgeModule,
  CalloutModule,
  ChipFilterComponent,
  ChipFilterOption,
  SearchModule,
  TableModule,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessNameResolverService } from "../access-requests/access-name-resolver.service";

import { AuditRow, auditKindLabelKey, auditRowMatchesFilter, toAuditRow } from "./access-audit-row";
import { AuditApiService } from "./audit-api.service";
import { AccessAuditEventKind } from "./responses/access-audit-event.response";

type AuditStatus = "loading" | "ready" | "empty" | "error";

/**
 * The organization's PAM access-audit trail, read from the dedicated append-only audit store.
 *
 * `GET /organizations/{orgId}/audit` is org-scoped and authorized by the AccessEventLogs permission,
 * so it returns the whole organization's trail regardless of which collections the viewer manages;
 * the route guard mirrors that permission. Actor and requester display names come from the fields
 * the server snapshotted into each row at write time. Cipher and collection names are resolved from
 * local vault state ({@link AccessNameResolverService}) rather than the response's equivalents,
 * because those are Vault Data — encrypted EncStrings this client only decrypts for items already in
 * the viewer's own vault. An admin who never held the item sees no item name, by design.
 *
 * Read-only, and deliberately without a drill-down: the request-detail page is authorized for the
 * request's requester or a managing approver, which is a different permission from the one that opens
 * this trail, so an auditor holding only AccessEventLogs would follow such a link into a 404. The
 * toolbar filters (free-text + event kind) run client-side over the already-fetched window.
 */
@Component({
  selector: "app-pam-access-audit",
  templateUrl: "./access-audit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BadgeModule,
    CalloutModule,
    ChipFilterComponent,
    SearchModule,
    TableModule,
    TooltipDirective,
    I18nPipe,
  ],
})
export class AccessAuditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auditApiService = inject(AuditApiService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  /**
   * The organization whose trail to show, from the route. `requireSync` holds because `params` emits
   * its current value on subscribe, matching the sibling access-rules page.
   */
  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as string)),
    { requireSync: true },
  );

  protected readonly status = signal<AuditStatus>("loading");
  protected readonly rows = signal<AuditRow[]>([]);

  // --- Toolbar filters (client-side over the fetched window) ---
  protected readonly searchControl = new FormControl("", { nonNullable: true });
  protected readonly kindControl = new FormControl<AccessAuditEventKind | null>(null);

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });
  private readonly kindValue = toSignal(this.kindControl.valueChanges, { initialValue: null });

  /** Event-kind chip options, limited to the kinds actually present in the trail, labelled and sorted. */
  protected readonly kindOptions = computed<ChipFilterOption<AccessAuditEventKind>[]>(() =>
    [...new Set(this.rows().map((row) => row.kind))]
      .map((kind) => ({ label: this.i18nService.t(auditKindLabelKey(kind)), value: kind }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  protected readonly filteredRows = computed(() =>
    this.rows().filter((row) =>
      auditRowMatchesFilter(row, { text: this.searchText(), kind: this.kindValue() }),
    ),
  );

  async ngOnInit(): Promise<void> {
    try {
      const events = await this.auditApiService.listAccessAuditTrail(this.organizationId());
      // Only events naming both a cipher and its collection can be resolved to a local vault item.
      const refs = events
        .filter((event) => event.cipherId != null && event.collectionId != null)
        .map((event) => ({ cipherId: event.cipherId!, collectionId: event.collectionId! }));
      const names = await this.nameResolver.resolveNames(refs);
      const rows = events.map((event) =>
        toAuditRow(event, names.cipherNameById, names.collectionNameById),
      );
      this.rows.set(rows);
      this.status.set(rows.length === 0 ? "empty" : "ready");
    } catch (e) {
      this.logService.error(e);
      this.status.set("error");
    }
  }
}
