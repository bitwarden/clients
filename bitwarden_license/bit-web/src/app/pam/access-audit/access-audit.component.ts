import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map, switchMap } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc/rxjs-operators";
import {
  BadgeModule,
  ButtonModule,
  CalloutModule,
  FilterMenuComponent,
  FilterOptionComponent,
  LinkModule,
  StatusLockupComponent,
  SvgComponent,
  SearchModule,
  TableModule,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AccessNameResolverService } from "../access-requests/access-name-resolver.service";

import { AuditRow, auditRowMatchesFilter, toAuditRow } from "./access-audit-row";
import { AuditApiService } from "./audit-api.service";

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
    RouterLink,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    FilterMenuComponent,
    FilterOptionComponent,
    HeaderModule,
    LinkModule,
    StatusLockupComponent,
    SvgComponent,
    SearchModule,
    TableModule,
    TooltipDirective,
    I18nPipe,
  ],
})
export class AccessAuditComponent implements OnInit {
  protected readonly noResultsSvg = NoResults;

  private readonly route = inject(ActivatedRoute);
  private readonly auditApiService = inject(AuditApiService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);

  /**
   * The organization whose trail to show, from the route. `requireSync` holds because `params` emits
   * its current value on subscribe, matching the sibling access-rules page.
   */
  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as string)),
    { requireSync: true },
  );

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  /**
   * Gates the empty state's "Access rules" link. This page's own guard, `canAccessEventLogs`, does
   * not imply `canManageAccessRules` (the target route's guard) — an auditor holding only the events
   * permission would follow the link into an "Access denied" bounce.
   */
  protected readonly canManageAccessRules = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(this.organizationId()),
      map((organization) => organization?.canManageAccessRules ?? false),
    ),
    { initialValue: false },
  );

  protected readonly status = signal<AuditStatus>("loading");
  protected readonly rows = signal<AuditRow[]>([]);

  // --- Toolbar filters (client-side over the fetched window) ---
  protected readonly searchControl = new FormControl("", { nonNullable: true });

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  /**
   * The Event chip. `bit-filter-menu` is not a `ControlValueAccessor` — it owns its selection and
   * publishes it as a signal, so the filter reads the chip directly rather than a form control
   * bound to it.
   */
  private readonly kindMenu = viewChild(FilterMenuComponent);

  private readonly kindValue = computed(() => (this.kindMenu()?.value() ?? null) as string | null);

  /** Event-kind chip options, limited to the labels actually present in the trail, sorted. */
  protected readonly kindOptions = computed(() =>
    [...new Set(this.rows().map((row) => row.kindLabelKey))]
      .map((labelKey) => ({ label: this.i18nService.t(labelKey), value: labelKey }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  protected readonly filteredRows = computed(() =>
    this.rows().filter((row) =>
      auditRowMatchesFilter(row, { text: this.searchText(), kindLabelKey: this.kindValue() }),
    ),
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.status.set("loading");
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
