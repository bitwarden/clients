import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { firstValueFrom, map, switchMap } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
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
  DialogService,
  FILTER_CONTROL,
  FilterControl,
  FilterMenuModule,
  LinkModule,
  StatusLockupComponent,
  SvgComponent,
  TableModule,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/dirt/event-logs/components/entity-events/entity-events.component";
import {
  ResolvedMember,
  isLinkableMember,
} from "@bitwarden/web-vault/app/dirt/event-logs/components/send-access-member";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AccessNameResolverService } from "../access-requests/access-name-resolver.service";

import {
  AUDIT_TIME_PERIOD_LABEL_KEYS,
  AUDIT_TIME_PRESETS,
  AUTOMATED_ACTOR,
  AuditFilter,
  AuditRange,
  AuditRow,
  AuditTimePeriod,
  UNBOUNDED_AUDIT_RANGE,
  auditPresetRange,
  auditRangeEnd,
  auditRangeStart,
  auditRowMatchesFilter,
  toAuditRow,
} from "./access-audit-row";
import { AuditApiService } from "./audit-api.service";
import { AuditExportService } from "./audit-export.service";
import {
  CustomRangeDialogComponent,
  CustomRangeDialogParams,
} from "./custom-range-dialog/custom-range-dialog.component";

type AuditStatus = "loading" | "ready" | "empty" | "error";

type AuditChipOption = { label: string; value: string };

/**
 * The chips' keys. A `bit-filter-menu` owns its own selection and reports it under its key rather than
 * through a form control, so these are how the filter predicate reaches each chip's value.
 */
const FILTER_KEYS = {
  kind: "kind",
  actor: "actor",
  requester: "requester",
  timePeriod: "timePeriod",
} as const;

const NO_CUSTOM_RANGE: CustomRangeDialogParams = { from: "", to: "" };

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
 * Read-only, and deliberately without a drill-down to another PAM page: the request-detail page is
 * authorized for the request's requester or a managing approver, which is a different permission from
 * the one that opens this trail, so an auditor holding only AccessEventLogs would follow such a link
 * into a 404. What the cells do open is the shared entity-events dialog, over the same AccessEventLogs
 * permission that authorized this page — an actor, a requester or a cipher, never an access rule, which
 * has no such dialog.
 *
 * The toolbar filters (event kind, actor, requester, time period) run client-side over the already-fetched
 * window: the endpoint takes no query parameters and returns the whole 90 days at once, so changing a
 * filter never re-reads it. Update is therefore not "apply these filters" as it is on the organization
 * event log — those are already live — but the only way to pull in events recorded since the page opened.
 * For the same reason the time period's "All time" means the whole fetched trail, which is those 90 days
 * and no more; nothing on this page claims to reach further back.
 */
@Component({
  selector: "app-pam-access-audit",
  templateUrl: "./access-audit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    AsyncActionsModule,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    FilterMenuModule,
    HeaderModule,
    LinkModule,
    StatusLockupComponent,
    SvgComponent,
    TableModule,
    TooltipDirective,
    I18nPipe,
  ],
  providers: [UserNamePipe],
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
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly userNamePipe = inject(UserNamePipe);
  private readonly dialogService = inject(DialogService);

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

  /**
   * The organization's members, keyed by PLATFORM user id — the id an audit row carries. The entity-events
   * dialog is keyed on the ORGANIZATION USER id instead, so an identity can only be linked once this map
   * has bridged the two.
   */
  private readonly members = signal(new Map<string, ResolvedMember>());

  protected readonly filterKeys = FILTER_KEYS;

  /**
   * The filter chips, which own their own selections. Read through the {@link FilterControl} contract
   * rather than a host bridge: this page is not a filterable surface with rows to facet, it is four
   * independent chips over one already-fetched array.
   *
   * Located by template reference rather than by matching `key()`, and only `value`, `active` and
   * `setValue` are ever read. `key` is a required input, and the Export button's disabled state reads the
   * filtered rows from above the chip row — one binding before Angular has set those inputs, which reading
   * `key()` there would answer with NG0950.
   */
  private readonly kindChip = viewChild("kindFilter", { read: FILTER_CONTROL });
  private readonly actorChip = viewChild("actorFilter", { read: FILTER_CONTROL });
  private readonly requesterChip = viewChild("requesterFilter", { read: FILTER_CONTROL });
  private readonly timePeriodChip = viewChild("timePeriodFilter", { read: FILTER_CONTROL });

  private readonly chips = computed(() =>
    [this.kindChip(), this.actorChip(), this.requesterChip(), this.timePeriodChip()].filter(
      (chip): chip is FilterControl => chip != null,
    ),
  );

  /**
   * The bounds the table is narrowed to. Stamped when a period is chosen rather than recomputed on every
   * filter pass, so "Past 7 days" does not slide forward under a table the auditor is still reading, and
   * so nothing in the row predicate consults the clock.
   */
  private readonly range = signal<AuditRange>(UNBOUNDED_AUDIT_RANGE);

  /** The period whose bounds {@link range} holds. A cancelled dialog rolls the chip back to this. */
  private readonly appliedPeriod = signal<AuditTimePeriod | null>(null);

  /** The last chip selection {@link applyTimePeriod} was run for, so a rollback does not re-enter it. */
  private readonly handledPeriod = signal<AuditTimePeriod | null>(null);

  /** The custom bounds last confirmed, kept so reopening the dialog shows the range in force. */
  private readonly customRange = signal<CustomRangeDialogParams>(NO_CUSTOM_RANGE);

  /**
   * The Time period options. "All time" is the chip's own reset row rather than a fifth option, so the
   * menu offers one way to mean "no bounds" instead of two that read differently.
   */
  protected readonly timePresets = AUDIT_TIME_PRESETS.map((period) => ({
    value: period,
    label: this.i18nService.t(AUDIT_TIME_PERIOD_LABEL_KEYS[period]),
  }));

  protected readonly customPeriodLabel = this.i18nService.t(AUDIT_TIME_PERIOD_LABEL_KEYS.custom);

  protected readonly kindOptions = computed<AuditChipOption[]>(() =>
    [...new Set(this.rows().map((row) => row.kindLabelKey))]
      .map((labelKey) => ({ label: this.i18nService.t(labelKey), value: labelKey }))
      .sort(byLabel),
  );

  protected readonly actorOptions = computed<AuditChipOption[]>(() => {
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

  protected readonly requesterOptions = computed<AuditChipOption[]>(() =>
    identityOptions(this.rows(), "requester").sort(byLabel),
  );

  /** One chip's selection, or null when that chip has none. Single-select, so the value is a scalar. */
  private selectedValue(chip: FilterControl | undefined): string | null {
    const value = chip?.value();
    return typeof value === "string" ? value : null;
  }

  private readonly selectedPeriod = computed<AuditTimePeriod | null>(
    () => this.selectedValue(this.timePeriodChip()) as AuditTimePeriod | null,
  );

  protected readonly filteredRows = computed(() => {
    const { from, to } = this.range();
    const filter: AuditFilter = {
      kindLabelKey: this.selectedValue(this.kindChip()),
      actorId: this.selectedValue(this.actorChip()),
      requesterId: this.selectedValue(this.requesterChip()),
      from,
      to,
    };
    return this.rows().filter((row) => auditRowMatchesFilter(row, filter));
  });

  /** Whether anything is narrowing the table, which is what puts "Clear all" at the end of the chip row. */
  protected readonly filtersActive = computed(() => this.chips().some((chip) => chip.active()));

  constructor() {
    // A `bit-filter-menu` has no value output to subscribe to, so the chip's own selection signal is what
    // drives the range. Guarded on the last handled selection because rolling the chip back after a
    // cancelled dialog writes to that same signal.
    effect(() => {
      const period = this.selectedPeriod();
      untracked(() => {
        if (period === this.handledPeriod()) {
          return;
        }
        this.handledPeriod.set(period);
        void this.applyTimePeriod(period);
      });
    });
  }

  /** Narrows the table to a chosen period, or collects bounds in the dialog when that period is Custom. */
  private async applyTimePeriod(period: AuditTimePeriod | null): Promise<void> {
    if (period === "custom") {
      await this.openCustomRange();
      return;
    }
    this.range.set(period == null ? UNBOUNDED_AUDIT_RANGE : auditPresetRange(period, new Date()));
    this.appliedPeriod.set(period);
  }

  /**
   * Collects custom bounds, applying them only on confirm.
   *
   * A cancelled dialog rolls the chip back to the period still in force, so it is never left reading
   * "Custom" over a range that was never applied. The dialog blocks its own confirm on an inverted range,
   * so a range that would hide every row cannot arrive here.
   */
  private async openCustomRange(): Promise<void> {
    const result = await firstValueFrom(
      CustomRangeDialogComponent.open(this.dialogService, { data: this.customRange() }).closed,
    );
    if (result == null) {
      const previous = this.appliedPeriod();
      this.handledPeriod.set(previous);
      this.setPeriod(previous);
      return;
    }
    this.customRange.set(result);
    this.range.set({ from: auditRangeStart(result.from), to: auditRangeEnd(result.to) });
    this.appliedPeriod.set("custom");
  }

  private setPeriod(period: AuditTimePeriod | null): void {
    this.timePeriodChip()?.setValue(period);
  }

  /** Resets every chip, so an auditor who narrowed the trail four ways gets back to all of it in one click. */
  protected clearAll(): void {
    for (const chip of this.chips()) {
      chip.setValue(null);
    }
    this.customRange.set(NO_CUSTOM_RANGE);
    this.handledPeriod.set(null);
    this.appliedPeriod.set(null);
    this.range.set(UNBOUNDED_AUDIT_RANGE);
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  /**
   * Reads the trail and rebuilds everything derived from it. An arrow property so `bitAction` can call it
   * detached from the instance, and safe to call on an already-rendered page: the Update button re-runs it
   * so events recorded since the page opened appear.
   *
   * A refresh deliberately leaves the rendered table in place until it has something to replace it with.
   * Dropping back to "loading" would take the whole ready branch — the toolbar, the filters and the very
   * button being pressed — out of the DOM mid-refresh, and a failed refresh that swapped a readable trail
   * for an error callout would lose the auditor their place over a transient error. The failure is raised
   * to `bitAction` instead, which reports it while the table stays as it was.
   */
  protected readonly load = async (): Promise<void> => {
    const refreshing = this.status() === "ready";
    if (!refreshing) {
      this.status.set("loading");
    }
    try {
      const events = await this.auditApiService.listAccessAuditTrail(this.organizationId());
      // Only events naming both a cipher and its collection can be resolved to a local vault item.
      const refs = events
        .filter((event) => event.cipherId != null && event.collectionId != null)
        .map((event) => ({ cipherId: event.cipherId!, collectionId: event.collectionId! }));
      const [names, members] = await Promise.all([
        this.nameResolver.resolveNames(refs),
        this.loadMembers(),
      ]);
      this.members.set(members);
      const rows = events.map((event) =>
        toAuditRow(event, names.cipherNameById, names.collectionNameById),
      );
      this.rows.set(rows);
      this.status.set(rows.length === 0 ? "empty" : "ready");
    } catch (e) {
      if (refreshing) {
        throw e;
      }
      this.logService.error(e);
      this.status.set("error");
    }
  };

  /**
   * The organization's members, keyed by platform user id, for {@link members}.
   *
   * `mini-details` is authorized for any member of the organization, which reaching this page already
   * requires, so a failure here is a failed read rather than a permission this auditor lacks. It reaches
   * {@link load} with the trail's own failures instead of being swallowed into an empty map.
   */
  private async loadMembers(): Promise<Map<string, ResolvedMember>> {
    const members = new Map<string, ResolvedMember>();
    const response = await this.organizationUserApiService.getAllMiniUserDetails(
      this.organizationId(),
    );
    for (const user of response.data) {
      members.set(user.userId, {
        name: this.userNamePipe.transform(user),
        email: user.email,
        organizationUserId: user.id,
      });
    }
    return members;
  }

  /**
   * The member behind one of a row's identities, when the trail carries a label to render for them and
   * {@link members} resolved them to someone whose event history can be opened. Null otherwise, and the
   * cell then renders that label as plain text — a former member, or a row whose actor is the automated
   * bucket. An identity that cannot be resolved is ordinary, so it must never be given an anchor: a dead
   * link on an audit surface invites a click that reports nothing.
   */
  protected linkedMember(userId: string | null, label: string | null): ResolvedMember | null {
    if (userId == null || label == null) {
      return null;
    }
    const members = this.members();
    return isLinkableMember(userId, members) ? (members.get(userId) ?? null) : null;
  }

  /**
   * Opens a member's own event history over this organization.
   *
   * Unlike the organization event log's equivalent, this deliberately does not route on to the members
   * page afterwards: an auditor mid-table expects to keep their place, and that page is behind
   * `manageUsers`, which this page's viewer need not hold.
   */
  protected openMemberEvents(event: Event, member: ResolvedMember): void {
    event.preventDefault();
    if (member.organizationUserId == null) {
      return;
    }
    openEntityEventsDialog(this.dialogService, {
      data: {
        entity: "user",
        entityId: member.organizationUserId,
        organizationId: this.organizationId(),
        name: member.name,
        showUser: true,
      },
    });
  }

  /**
   * Opens the subject item's own event history. Reachable only from a row whose item decrypted, which is
   * to say one the viewer already holds.
   */
  protected openCipherEvents(event: Event, row: AuditRow): void {
    event.preventDefault();
    if (row.cipherId == null || row.cipherName == null) {
      return;
    }
    openEntityEventsDialog(this.dialogService, {
      data: {
        entity: "cipher",
        entityId: row.cipherId,
        organizationId: this.organizationId(),
        name: row.cipherName,
        showUser: true,
      },
    });
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
