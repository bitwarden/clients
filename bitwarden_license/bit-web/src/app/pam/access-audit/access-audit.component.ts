import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { firstValueFrom, map, switchMap } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { NoResults } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc/rxjs-operators";
import {
  AsyncActionsModule,
  BadgeModule,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  CalloutModule,
  ColumnName,
  DialogService,
  DrawerRef,
  FILTER_CONTROL,
  FilterControl,
  FilterMenuModule,
  LinkModule,
  StatusLockupComponent,
  SvgComponent,
  TableModule,
  TooltipDirective,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/dirt/event-logs/components/entity-events/entity-events.component";
import {
  ResolvedMember,
  isLinkableMember,
} from "@bitwarden/web-vault/app/dirt/event-logs/components/send-access-member";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AccessNameResolverService } from "../access-requests/access-name-resolver.service";
import { selectedFilterStrings } from "../helpers/selected-filter-strings";

import {
  AUDIT_TIME_PERIOD_LABEL_KEYS,
  AUDIT_TIME_PRESETS,
  AUTOMATED_ACTOR,
  AuditRange,
  AuditRow,
  AuditTimePeriod,
  UNBOUNDED_AUDIT_RANGE,
  UNEMITTED_AUDIT_KINDS,
  auditKindLabelKey,
  auditPresetRange,
  auditRangeEnd,
  auditRangeStart,
  toAuditRow,
} from "./access-audit-row";
import { AuditApiService, AuditTrailFilter, AuditTrailPage } from "./audit-api.service";
import { AuditEventDrawerComponent } from "./audit-event-drawer/audit-event-drawer.component";
import { AuditExportService } from "./audit-export.service";
import {
  CustomRangeDialogComponent,
  CustomRangeDialogParams,
} from "./custom-range-dialog/custom-range-dialog.component";
import { AccessAuditEventKind } from "./responses/access-audit-event.response";
import { AccessAuditItemResponse } from "./responses/access-audit-item.response";

type AuditStatus = "loading" | "ready" | "empty" | "error";

type AuditChipOption = { label: string; value: string };

const FILTER_KEYS = {
  kind: "kind",
  actor: "actor",
  requester: "requester",
  item: "item",
  timePeriod: "timePeriod",
} as const;

const NO_CUSTOM_RANGE: CustomRangeDialogParams = { from: "", to: "" };

const byLabel = (a: AuditChipOption, b: AuditChipOption) => a.label.localeCompare(b.label);

/** Tells an empty answer from an empty trail. */
function isNarrowed(filter: AuditTrailFilter): boolean {
  return (
    filter.start != null ||
    filter.end != null ||
    (filter.kinds?.length ?? 0) > 0 ||
    (filter.actorIds?.length ?? 0) > 0 ||
    filter.includeAutomatedActor === true ||
    (filter.requesterIds?.length ?? 0) > 0 ||
    (filter.cipherIds?.length ?? 0) > 0 ||
    (filter.ruleIds?.length ?? 0) > 0
  );
}

type AuditChipCandidate = { label: string; qualifier: string | null };

/** Qualifies a label two identities share as `Name (qualifier)`, as the member pickers do. */
function qualifiedOptions(candidates: Map<string, AuditChipCandidate>): AuditChipOption[] {
  const labelCounts = new Map<string, number>();
  for (const { label } of candidates.values()) {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  return [...candidates].map(([value, { label, qualifier }]) => ({
    value,
    label:
      (labelCounts.get(label) ?? 0) > 1 && qualifier != null && qualifier !== label
        ? `${label} (${qualifier})`
        : label,
  }));
}

/**
 * The organization's PAM access-audit trail. Cipher and collection names come from local vault
 * state, so an admin who never held an item sees no name.
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
    BitTableToolbarComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly configService = inject(ConfigService);

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  /** `requireSync` holds, since `params` emits its current value on subscribe. */
  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as string)),
    { requireSync: true },
  );

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly organization = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(this.organizationId()),
    ),
  );

  /**
   * Gates the links into access rules, whose route guard this page's `canAccessEventLogs` does not
   * imply. Without it, an auditor would follow the link into an "Access denied" bounce.
   */
  protected readonly canManageAccessRules = computed(
    () => this.organization()?.canManageAccessRules ?? false,
  );

  /**
   * Gates the drawer's collection link. The organization vault's guard, `canAccessVaultTab`, reads
   * `canViewAllCollections`, which this page's `canAccessEventLogs` does not imply.
   */
  private readonly canViewCollections = computed(
    () => this.organization()?.canViewAllCollections ?? false,
  );

  protected readonly status = signal<AuditStatus>("loading");

  /** Every page read so far for the filter in force, newest event first. */
  protected readonly rows = signal<AuditRow[]>([]);

  /** Null once the last page has loaded. */
  private readonly continuationToken = signal<string | null>(null);

  protected readonly canLoadMore = computed(() => this.continuationToken() != null);

  protected readonly table = defineTable<AuditRow, "item">(this.rows);

  /**
   * The v2 cell templates get no index, so per-row ids key on this. It matches the rendered order,
   * since the table neither sorts nor filters here.
   */
  protected readonly rowIndex = computed(
    () => new Map(this.rows().map((row, index) => [row, index] as const)),
  );

  /** Held as the ref, so a stale close can't mark a newer drawer closed. */
  private readonly detailsDrawer = signal<DrawerRef<unknown, AuditEventDrawerComponent> | null>(
    null,
  );

  /**
   * Drops Actor, Requester and Duration from the table. Driven by the drawer rather than a
   * breakpoint, since the drawer's grid column is what narrows the table.
   */
  protected readonly detailsOpen = computed(() => this.detailsDrawer() != null);

  protected readonly displayedColumns = computed<ColumnName<AuditRow, "item">[]>(() =>
    this.detailsOpen()
      ? ["occurredAt", "kindLabelKey", "item"]
      : ["occurredAt", "kindLabelKey", "actor", "requester", "item", "duration"],
  );

  /**
   * Keyed by user id, which audit rows carry, rather than the organization-user id the
   * entity-events dialog expects.
   */
  private readonly members = signal(new Map<string, ResolvedMember>());

  protected readonly filterKeys = FILTER_KEYS;

  /**
   * Only `value`, `active` and `setValue` are read, since reading `key()` before Angular sets
   * template inputs throws NG0950.
   */
  private readonly kindChip = viewChild("kindFilter", { read: FILTER_CONTROL });
  private readonly actorChip = viewChild("actorFilter", { read: FILTER_CONTROL });
  private readonly requesterChip = viewChild("requesterFilter", { read: FILTER_CONTROL });
  private readonly itemChip = viewChild("itemFilter", { read: FILTER_CONTROL });
  private readonly timePeriodChip = viewChild("timePeriodFilter", { read: FILTER_CONTROL });

  private readonly chips = computed(() =>
    [
      this.kindChip(),
      this.actorChip(),
      this.requesterChip(),
      this.itemChip(),
      this.timePeriodChip(),
    ].filter((chip): chip is FilterControl => chip != null),
  );

  /** Stamped when chosen, so a preset's bounds don't move under the auditor. */
  private readonly range = signal<AuditRange>(UNBOUNDED_AUDIT_RANGE);

  /** The period whose bounds {@link range} holds. A canceled dialog rolls the chip back to this. */
  private readonly appliedPeriod = signal<AuditTimePeriod | null>(null);

  /** The last chip selection {@link applyTimePeriod} was run for, so a rollback does not re-enter it. */
  private readonly handledPeriod = signal<AuditTimePeriod | null>(null);

  /** Kept so reopening the dialog shows the range in force. */
  private readonly customRange = signal<CustomRangeDialogParams>(NO_CUSTOM_RANGE);

  /** "All time" is the chip's reset row rather than an option, so one entry means no bounds. */
  protected readonly timePresets = AUDIT_TIME_PRESETS.map((period) => ({
    value: period,
    label: this.i18nService.t(AUDIT_TIME_PERIOD_LABEL_KEYS[period]),
  }));

  protected readonly customPeriodLabel = this.i18nService.t(AUDIT_TIME_PERIOD_LABEL_KEYS.custom);

  /**
   * Shows a separate edit button, since re-selecting "Custom" writes the value the chip already
   * holds and its selection signal never notifies.
   */
  protected readonly customRangeApplied = computed(() => this.appliedPeriod() === "custom");

  /** Every kind an action can emit, as wire values, whether or not the loaded page has one. */
  protected readonly kindOptions = computed<AuditChipOption[]>(() =>
    Object.values(AccessAuditEventKind)
      .filter((kind) => !UNEMITTED_AUDIT_KINDS.has(kind))
      .map((kind) => ({ label: this.i18nService.t(auditKindLabelKey(kind)), value: kind }))
      .sort(byLabel),
  );

  protected readonly actorOptions = computed<AuditChipOption[]>(() => {
    const candidates = this.identityCandidates("actor");
    // Offered unconditionally, since the loaded page can't say whether any system events exist.
    candidates.set(AUTOMATED_ACTOR, {
      label: this.i18nService.t("pamAuditSystem"),
      qualifier: null,
    });
    return qualifiedOptions(candidates).sort(byLabel);
  });

  protected readonly requesterOptions = computed<AuditChipOption[]>(() =>
    qualifiedOptions(this.identityCandidates("requester")).sort(byLabel),
  );

  /** The subjects named in the active range, resolved once here since a `computed` can't await. */
  private readonly itemFacets = signal<{
    items: AccessAuditItemResponse[];
    cipherNameById: Map<string, string>;
    collectionNameById: Map<string, string>;
  }>({ items: [], cipherNameById: new Map(), collectionNameById: new Map() });

  /** Subjects the trail names in range, narrowed to those this viewer can name. */
  protected readonly itemOptions = computed<AuditChipOption[]>(() => {
    const { items, cipherNameById, collectionNameById } = this.itemFacets();
    const candidates = new Map<string, AuditChipCandidate>();
    for (const item of items) {
      if (item.cipherId != null) {
        const label = cipherNameById.get(item.cipherId);
        if (label != null) {
          candidates.set(item.cipherId, {
            label,
            qualifier:
              item.collectionId == null
                ? null
                : (collectionNameById.get(item.collectionId) ?? null),
          });
        }
      } else if (item.ruleId != null && item.ruleName != null) {
        candidates.set(item.ruleId, { label: item.ruleName, qualifier: null });
      }
    }
    return qualifiedOptions(candidates).sort(byLabel);
  });

  /**
   * The Item chip carries both ciphers and rules, which travel as different parameters; an id sent
   * as the wrong one silently matches nothing.
   */
  private readonly ruleItemIds = computed(
    () =>
      new Set(
        this.itemFacets()
          .items.map((item) => item.ruleId)
          .filter((ruleId): ruleId is string => ruleId != null),
      ),
  );

  /** The roster plus anyone the loaded rows name, so a departed member can still be filtered on. */
  private identityCandidates(identity: "actor" | "requester"): Map<string, AuditChipCandidate> {
    const candidates = new Map<string, AuditChipCandidate>();
    for (const [userId, member] of this.members()) {
      if (member.name != null && member.name !== "") {
        candidates.set(userId, { label: member.name, qualifier: member.email });
      }
    }
    for (const row of this.rows()) {
      const value = row[`${identity}Id`];
      const label = row[identity];
      if (value != null && label != null && !candidates.has(value)) {
        candidates.set(value, { label, qualifier: row[`${identity}Email`] });
      }
    }
    return candidates;
  }

  private selectedValues(chip: FilterControl | undefined): string[] {
    return selectedFilterStrings(chip?.value());
  }

  private selectedValue(chip: FilterControl | undefined): string | null {
    const value = chip?.value();
    return typeof value === "string" ? value : null;
  }

  private readonly selectedPeriod = computed<AuditTimePeriod | null>(
    () => this.selectedValue(this.timePeriodChip()) as AuditTimePeriod | null,
  );

  private readonly filter = computed<AuditTrailFilter>(() => {
    const { from, to } = this.range();
    const actors = this.selectedValues(this.actorChip());
    const items = this.selectedValues(this.itemChip());
    const rules = this.ruleItemIds();
    return {
      start: from ?? undefined,
      end: to ?? undefined,
      kinds: this.selectedValues(this.kindChip()) as AccessAuditEventKind[],
      actorIds: actors.filter((value) => value !== AUTOMATED_ACTOR),
      includeAutomatedActor: actors.includes(AUTOMATED_ACTOR),
      requesterIds: this.selectedValues(this.requesterChip()),
      cipherIds: items.filter((value) => !rules.has(value)),
      ruleIds: items.filter((value) => rules.has(value)),
    };
  });

  /** So a chip settling back onto the loaded filter doesn't trigger a redundant read. */
  private readonly loadedFilterKey = signal<string | null>(null);

  private readonly filterKey = computed(() => JSON.stringify(this.filter()));

  protected readonly filtersActive = computed(() => this.chips().some((chip) => chip.active()));

  constructor() {
    // The chip has no value output, so its own selection signal drives the range; guarded
    // against the rollback write after a canceled dialog.
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

    // Driven off the combined filter rather than each chip, so one interaction settles into
    // a single read.
    effect(() => {
      const key = this.filterKey();
      untracked(() => {
        if (key === this.loadedFilterKey() || this.status() === "loading") {
          return;
        }
        void this.load();
      });
    });

    // The Item menu tracks the time period only; narrowing by another chip must not drop
    // items an auditor could still select.
    effect(() => {
      const key = this.itemRangeKey();
      untracked(() => {
        if (key === this.loadedItemRangeKey()) {
          return;
        }
        void this.loadItemFacets();
      });
    });
  }

  private readonly itemRangeKey = computed(() => {
    const { from, to } = this.range();
    return `${from?.getTime() ?? ""}|${to?.getTime() ?? ""}`;
  });

  private readonly loadedItemRangeKey = signal<string | null>(null);

  private async loadItemFacets(): Promise<void> {
    const range = this.range();
    this.loadedItemRangeKey.set(this.itemRangeKey());
    try {
      const items = await this.auditApiService.listAccessAuditItems(this.organizationId(), {
        start: range.from ?? undefined,
        end: range.to ?? undefined,
      });
      const refs = items
        .filter((item) => item.cipherId != null && item.collectionId != null)
        .map((item) => ({ cipherId: item.cipherId!, collectionId: item.collectionId! }));
      const names = await this.nameResolver.resolveNames(refs);
      this.itemFacets.set({
        items,
        cipherNameById: names.cipherNameById,
        collectionNameById: names.collectionNameById,
      });
    } catch (e) {
      this.logService.error(e);
    }
  }

  private async applyTimePeriod(period: AuditTimePeriod | null): Promise<void> {
    if (period === "custom") {
      await this.openCustomRange();
      return;
    }
    this.range.set(period == null ? UNBOUNDED_AUDIT_RANGE : auditPresetRange(period, new Date()));
    this.appliedPeriod.set(period);
  }

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
    if (result.action === "clear") {
      this.resetTimePeriod();
      return;
    }
    this.customRange.set({ from: result.from, to: result.to });
    this.range.set({ from: auditRangeStart(result.from), to: auditRangeEnd(result.to) });
    this.appliedPeriod.set("custom");
  }

  protected readonly editCustomRange = async (): Promise<void> => {
    await this.openCustomRange();
  };

  private setPeriod(period: AuditTimePeriod | null): void {
    this.timePeriodChip()?.setValue(period);
  }

  private resetTimePeriod(): void {
    this.customRange.set(NO_CUSTOM_RANGE);
    this.handledPeriod.set(null);
    this.appliedPeriod.set(null);
    this.range.set(UNBOUNDED_AUDIT_RANGE);
    this.setPeriod(null);
  }

  protected clearAll(): void {
    for (const chip of this.chips()) {
      chip.setValue(null);
    }
    this.resetTimePeriod();
  }

  async ngOnInit(): Promise<void> {
    // Read once for every filter; a failure narrows the identity chips, not the page.
    try {
      this.members.set(await this.loadMembers());
    } catch (e) {
      this.logService.error(e);
    }
    await this.load();
  }

  /** A refresh keeps the table in place until it succeeds, rather than dropping to loading. */
  protected readonly load = async (): Promise<void> => {
    const refreshing = this.status() === "ready";
    if (!refreshing) {
      this.status.set("loading");
    }
    // Stamped before the read, so a chip changed mid-flight is measured against the filter being
    // read.
    const filter = this.filter();
    const read = this.reads() + 1;
    this.reads.set(read);
    this.loadedFilterKey.set(this.filterKey());
    try {
      const page = await this.readPage(filter);
      if (this.superseded(read)) {
        return;
      }
      this.rows.set(page.rows);
      this.continuationToken.set(page.continuationToken);
      // Read off the filter this page was fetched with, not the chips' live state, so a chip
      // changed mid-flight can't pick the wrong empty state.
      const narrowed = isNarrowed(filter);
      this.status.set(page.rows.length === 0 && !narrowed ? "empty" : "ready");
    } catch (e) {
      if (this.superseded(read)) {
        return;
      }
      if (refreshing) {
        throw e;
      }
      this.logService.error(e);
      this.status.set("error");
    }
  };

  /** Leaves {@link status} alone, so the auditor keeps their place in the table. */
  protected readonly loadMore = async (): Promise<void> => {
    const continuationToken = this.continuationToken();
    if (continuationToken == null) {
      return;
    }
    const read = this.reads();
    const page = await this.readPage({ ...this.filter(), continuationToken });
    if (this.superseded(read)) {
      return;
    }
    this.rows.update((rows) => [...rows, ...page.rows]);
    this.continuationToken.set(page.continuationToken);
  };

  /** Which read the rows on screen belong to, so a stale response can't overwrite a newer one. */
  private readonly reads = signal(0);

  private superseded(read: number): boolean {
    return read !== this.reads();
  }

  private async readPage(
    filter: AuditTrailFilter,
  ): Promise<{ rows: AuditRow[]; continuationToken: string | null }> {
    const page = await this.auditApiService.listAccessAuditTrail(this.organizationId(), filter);
    return { rows: await this.toRows(page), continuationToken: page.continuationToken };
  }

  private async toRows(page: AuditTrailPage): Promise<AuditRow[]> {
    // Only events naming both a cipher and its collection can be resolved to a local vault item.
    const refs = page.data
      .filter((event) => event.cipherId != null && event.collectionId != null)
      .map((event) => ({ cipherId: event.cipherId!, collectionId: event.collectionId! }));
    const names = await this.nameResolver.resolveNames(refs);
    return page.data.map((event) =>
      toAuditRow(event, names.cipherNameById, names.collectionNameById),
    );
  }

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

  protected linkedMember(userId: string | null, label: string | null): ResolvedMember | null {
    if (userId == null || label == null) {
      return null;
    }
    const members = this.members();
    return isLinkableMember(userId, members) ? (members.get(userId) ?? null) : null;
  }

  /**
   * Unlike the organization event log, does not then route to the members page, which would lose
   * the auditor's place and needs `manageUsers`.
   */
  protected openMemberEvents(event: Event, member: ResolvedMember): void {
    event.preventDefault();
    event.stopPropagation();
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

  /** Reachable only from a row whose item the viewer's own vault holds. */
  protected openCipherEvents(event: Event, row: AuditRow): void {
    event.preventDefault();
    event.stopPropagation();
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

  /** Identities and permissions resolve here, so the drawer can't disagree with its row. */
  protected openDetails(row: AuditRow): void {
    void this.showDetails(row);
  }

  /**
   * `close()` and `forceClose()` both emit on `closed`, so one subscription covers every way out,
   * including replacement by a second row.
   */
  private async showDetails(row: AuditRow): Promise<void> {
    const drawer = await AuditEventDrawerComponent.open(this.dialogService, {
      closeOnNavigation: true,
      data: {
        row,
        organizationId: this.organizationId(),
        actor: row.automated ? null : this.linkedMember(row.actorId, row.actor),
        requester: this.linkedMember(row.requesterId, row.requester),
        canManageAccessRules: this.canManageAccessRules(),
        canViewCollections: this.canViewCollections(),
      },
    });
    if (drawer == null) {
      return;
    }
    drawer.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.detailsDrawer.update((open) => (open === drawer ? null : open));
    });
    this.detailsDrawer.set(drawer);
  }

  /** Walks every page of the active filter, beyond the rows on screen. */
  protected readonly exportCsv = async (): Promise<void> => {
    const csv = this.auditExportService.getAuditExport(await this.readEveryPage());
    this.fileDownloadService.download({
      fileName: this.auditExportService.getFileName(),
      blobData: csv,
      blobOptions: { type: "text/csv" },
    });
  };

  /** Throws rather than looping forever when the server repeats a page. */
  private async readEveryPage(): Promise<AuditRow[]> {
    const filter = this.filter();
    const all: AuditRow[] = [];
    const seen = new Set<string>();
    let continuationToken: string | undefined;

    for (;;) {
      const page = await this.readPage({ ...filter, continuationToken });
      all.push(...page.rows);
      if (page.continuationToken == null) {
        return all;
      }
      if (seen.has(page.continuationToken)) {
        throw new Error(
          "The audit trail returned the same page twice; the export was not written.",
        );
      }
      seen.add(page.continuationToken);
      continuationToken = page.continuationToken;
    }
  }
}
