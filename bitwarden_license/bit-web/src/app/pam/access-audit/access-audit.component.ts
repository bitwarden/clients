import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule, ValidatorFn } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map, switchMap } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc/rxjs-operators";
import {
  AsyncActionsModule,
  BadgeModule,
  ButtonModule,
  CalloutModule,
  ChipFilterComponent,
  ChipFilterOption,
  FilterMenuComponent,
  FilterOptionComponent,
  FormFieldModule,
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

import {
  AUTOMATED_ACTOR,
  AuditFilter,
  AuditRow,
  auditRangeEnd,
  auditRangeStart,
  auditRowMatchesFilter,
  toAuditRow,
} from "./access-audit-row";
import { AuditApiService } from "./audit-api.service";
import { AuditExportService } from "./audit-export.service";

type AuditStatus = "loading" | "ready" | "empty" | "error";

type AuditChipOption = { label: string; value: string };

const byLabel = (a: AuditChipOption, b: AuditChipOption) => a.label.localeCompare(b.label);

/**
 * One chip option per distinct identity in `rows`, labelled the way the cells label it. A row whose identity
 * resolved to neither a name nor an email is skipped rather than offered under its raw id.
 *
 * Two members can share a display name, and a menu offering the same words twice would let an auditor read a
 * filtered half of the trail as the whole of one person's activity. A shared label is therefore qualified with
 * the identity's email, in the `Name (email)` shape the member pickers already use
 * (`apps/web/src/app/admin-console/organizations/shared/components/access-selector/access-selector.models.ts`).
 * Where the trail carries no email for a namesake, the two stay indistinguishable.
 */
function identityOptions(rows: AuditRow[], identity: "actor" | "requester"): AuditChipOption[] {
  const identities = new Map<string, { label: string; email: string | null }>();
  for (const row of rows) {
    const value = row[`${identity}Id`];
    const label = row[identity];
    if (value != null && label != null && !identities.has(value)) {
      identities.set(value, { label, email: row[`${identity}Email`] });
    }
  }
  const labelCounts = new Map<string, number>();
  for (const { label } of identities.values()) {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  return [...identities].map(([value, { label, email }]) => ({
    value,
    label:
      (labelCounts.get(label) ?? 0) > 1 && email != null && email !== label
        ? `${label} (${email})`
        : label,
  }));
}

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
 * toolbar filters (free text, event kind, actor, requester, date range) run client-side over the
 * already-fetched window: the endpoint takes no query parameters and returns the whole 90 days at once,
 * so changing a filter never re-reads it.
 */
@Component({
  selector: "app-pam-access-audit",
  templateUrl: "./access-audit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AsyncActionsModule,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    ChipFilterComponent,
    FilterMenuComponent,
    FilterOptionComponent,
    FormFieldModule,
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
  private readonly auditExportService = inject(AuditExportService);
  private readonly fileDownloadService = inject(FileDownloadService);
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

  protected readonly searchControl = new FormControl("", { nonNullable: true });
  protected readonly actorControl = new FormControl<string | null>(null);
  protected readonly requesterControl = new FormControl<string | null>(null);
  protected readonly fromControl = new FormControl("", { nonNullable: true });
  protected readonly toControl = new FormControl("", { nonNullable: true });

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  /**
   * The Event chip. `bit-filter-menu` is not a `ControlValueAccessor` — it owns its selection and
   * publishes it as a signal, so the filter reads the chip directly rather than a form control
   * bound to it.
   */
  private readonly kindMenu = viewChild(FilterMenuComponent);

  private readonly kindValue = computed(() => (this.kindMenu()?.value() ?? null) as string | null);

  private readonly actorValue = toSignal(this.actorControl.valueChanges, { initialValue: null });
  private readonly requesterValue = toSignal(this.requesterControl.valueChanges, {
    initialValue: null,
  });
  private readonly fromValue = toSignal(this.fromControl.valueChanges, { initialValue: "" });
  private readonly toValue = toSignal(this.toControl.valueChanges, { initialValue: "" });

  private readonly rangeStart = computed(() => auditRangeStart(this.fromValue()));
  private readonly rangeEnd = computed(() => auditRangeEnd(this.toValue()));

  /** From after To. Surfaced to the auditor, who otherwise reads an empty table as a trail with no events. */
  protected readonly invertedRange = computed(() => {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    return start != null && end != null && end.getTime() < start.getTime();
  });

  /**
   * The inverted range as the To control's own error, so the field carries the danger border, `aria-invalid`
   * and the message that `bit-form-field` already renders for a control in error.
   *
   * A validator rather than a `setErrors` call: `setUpControl` re-validates the control whenever the ready
   * branch is created, which would wipe an imperatively set error.
   */
  private readonly invertedRangeValidator: ValidatorFn = () =>
    this.invertedRange()
      ? { invalidDateRange: { message: this.i18nService.t("invalidDateRange") } }
      : null;

  protected readonly kindOptions = computed(() =>
    [...new Set(this.rows().map((row) => row.kindLabelKey))]
      .map((labelKey) => ({ label: this.i18nService.t(labelKey), value: labelKey }))
      .sort(byLabel),
  );

  protected readonly actorOptions = computed<ChipFilterOption<string>[]>(() => {
    const rows = this.rows();
    const options = identityOptions(
      rows.filter((row) => !row.automated),
      "actor",
    );
    if (rows.some((row) => row.automated)) {
      options.push({ label: this.i18nService.t("pamAuditSystem"), value: AUTOMATED_ACTOR });
    }
    return options.sort(byLabel);
  });

  protected readonly requesterOptions = computed<ChipFilterOption<string>[]>(() =>
    identityOptions(this.rows(), "requester").sort(byLabel),
  );

  protected readonly filteredRows = computed(() => {
    const inverted = this.invertedRange();
    const filter: AuditFilter = {
      text: this.searchText(),
      kindLabelKey: this.kindValue(),
      actorId: this.actorValue(),
      requesterId: this.requesterValue(),
      from: inverted ? null : this.rangeStart(),
      to: inverted ? null : this.rangeEnd(),
    };
    return this.rows().filter((row) => auditRowMatchesFilter(row, filter));
  });

  constructor() {
    this.toControl.addValidators(this.invertedRangeValidator);

    // Editing From leaves To's value alone, so nothing else would re-run a cross-field rule. The control is
    // marked touched on every inverted edit rather than only when the range flips, because
    // `BitInputDirective.onInput` marks it untouched on each keystroke and
    // `BitFormFieldControlDirective.hasError` paints nothing on an untouched control — the message would
    // otherwise blink out mid-edit and stay hidden until the next blur.
    effect(() => {
      this.fromValue();
      this.toValue();
      this.toControl.updateValueAndValidity();
      if (this.invertedRange()) {
        this.toControl.markAsTouched();
      }
    });
  }

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

  /**
   * Downloads the filtered trail as CSV. An arrow property so `bitAction` can call it detached from the
   * instance.
   *
   * Exports {@link filteredRows}, not {@link rows}: an auditor who narrowed the table to one requester and
   * one week is asking for that week, and the whole 90-day window would hand them back the events they
   * deliberately filtered out. The file is built from what the browser already holds — the endpoint takes no
   * parameters and is not re-read — and every name in it is one this viewer could already read on screen.
   */
  protected readonly exportCsv = (): void => {
    const csv = this.auditExportService.getAuditExport(this.filteredRows());
    this.fileDownloadService.download({
      fileName: this.auditExportService.getFileName(),
      blobData: csv,
      blobOptions: { type: "text/csv" },
    });
  };
}
