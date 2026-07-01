import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import { AccessAuditEventKind, PamApiService } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  CalloutModule,
  ChipFilterComponent,
  ChipFilterOption,
  LinkModule,
  SearchModule,
  TableModule,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessRequestNameResolver } from "../../access-request-name-resolver.service";

import { AuditRow, auditKindLabelKey, auditRowMatchesFilter, toAuditRow } from "./access-audit-row";

type AuditStatus = "loading" | "ready" | "empty" | "error";

/**
 * The access-audit tab on the governance dashboard: the synthesized PAM audit trail for one organization.
 *
 * The `/organizations/{orgId}/audit` endpoint is org-scoped and authorized by the AccessEventLogs permission, so it
 * returns the whole organization's trail. Actor and requester display names come from the server's denormalized
 * fields; cipher and collection names are resolved from local vault state (see
 * {@link AccessRequestNameResolver}). Read-only — a projection, no actions; each row links to the request's detail page.
 * The toolbar filters (free-text + event kind) run client-side over the already-fetched window.
 */
@Component({
  selector: "app-pam-access-audit",
  templateUrl: "./access-audit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CalloutModule,
    ChipFilterComponent,
    LinkModule,
    SearchModule,
    TableModule,
    TooltipDirective,
    I18nPipe,
  ],
})
export class AccessAuditComponent implements OnInit {
  /** The organization whose trail to show. The user-scoped trail is filtered to this org. */
  readonly organizationId = input.required<string>();

  private readonly pamApiService = inject(PamApiService);
  private readonly nameResolver = inject(AccessRequestNameResolver);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  protected readonly status = signal<AuditStatus>("loading");
  protected readonly rows = signal<AuditRow[]>([]);

  /** Absolute route to the shareable request-detail page; each row links to `${base}/${requestId}`. */
  protected readonly requestDetailBaseUrl = "/pam/requests";

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
      const events = await this.pamApiService.listAccessAuditTrail(this.organizationId());
      // Cipher/collection names come from local vault state, not the (encrypted) denormalized response fields.
      const refs = events
        .filter((event) => event.cipherId != null && event.collectionId != null)
        .map((event) => ({ cipherId: event.cipherId!, collectionId: event.collectionId! }));
      const names = await this.nameResolver.namesFor(refs);
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
