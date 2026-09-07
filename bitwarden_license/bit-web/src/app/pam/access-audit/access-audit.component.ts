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
  DrawerRef,
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
  AuditRange,
  AuditRow,
  AuditTimePeriod,
  UNBOUNDED_AUDIT_RANGE,
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

/**
 * The chips' keys. A `bit-filter-menu` owns its own selection and reports it under its key rather than
 * through a form control, so these are how the filter predicate reaches each chip's value.
 */
const FILTER_KEYS = {
  kind: "kind",
  actor: "actor",
  requester: "requester",
  item: "item",
  timePeriod: "timePeriod",
} as const;

const NO_CUSTOM_RANGE: CustomRangeDialogParams = { from: "", to: "" };

const byLabel = (a: AuditChipOption, b: AuditChipOption) => a.label.localeCompare(b.label);

/** Whether a filter narrows the trail at all, which is what tells an empty answer from an empty trail. */
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

/** One identity a chip can offer, before its label has been weighed against the other options'. */
type AuditChipCandidate = { label: string; qualifier: string | null };

/**
 * Chip options for `candidates`, qualifying a label two identities share so they stay distinguishable.
 *
 * Uses the `Name (qualifier)` shape the member pickers already use.
 */
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
 * The organization's PAM access-audit trail, read from the append-only audit store.
 *
 * Cipher/collection names resolve from local vault state, not the response, since those fields
 * are encrypted; an admin who never held the item sees no name. Row cells open the shared
 * entity-events dialog, gated on this page's own AccessEventLogs permission, not the
 * request-detail page's different one.
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
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The organization whose trail to show, from the route. `requireSync` holds since `params` emits its current value on subscribe.
   */
  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as string)),
    { requireSync: true },
  );

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  /** The organization the trail belongs to, which is what every permission below is read off. */
  private readonly organization = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(this.organizationId()),
    ),
  );

  /**
   * Gates the empty state's "Access rules" link. This page's own guard, `canAccessEventLogs`, does
   * not imply `canManageAccessRules` (the target route's guard) — an auditor holding only the events
   * permission would follow the link into an "Access denied" bounce.
   */
  protected readonly canManageAccessRules = computed(
    () => this.organization()?.canManageAccessRules ?? false,
  );

  /**
   * Gates the drawer's collection link, which lands on the organization vault narrowed to that one
   * collection. That route is guarded by `canAccessVaultTab`, which reads `canViewAllCollections` —
   * neither implied by this page's own `canAccessEventLogs`, so a custom auditor holding the events
   * permission alone would follow the link into an "Access denied" bounce.
   */
  private readonly canViewCollections = computed(
    () => this.organization()?.canViewAllCollections ?? false,
  );

  protected readonly status = signal<AuditStatus>("loading");

  /** The pages read so far for the filter in force, oldest page first, newest event first within each. */
  protected readonly rows = signal<AuditRow[]>([]);

  /** Where the last page stopped, null when none remains; also answers whether more can load. */
  private readonly continuationToken = signal<string | null>(null);

  protected readonly canLoadMore = computed(() => this.continuationToken() != null);

  /** The open details drawer, or null; held as the ref so a stale close can't report the newer one closed. */
  private readonly detailsDrawer = signal<DrawerRef<unknown, AuditEventDrawerComponent> | null>(
    null,
  );

  /**
   * Whether the drawer is over the table, which drops Actor, Requester and Duration from it.
   *
   * Driven by the drawer's own state, not a viewport breakpoint, since it's the drawer's grid column that narrows the table.
   */
  protected readonly detailsOpen = computed(() => this.detailsDrawer() != null);

  /**
   * The organization's members, keyed by platform user id — the id an audit row carries, not the organization-user id the entity-events dialog expects.
   */
  private readonly members = signal(new Map<string, ResolvedMember>());

  protected readonly filterKeys = FILTER_KEYS;

  /**
   * The filter chips, read through the {@link FilterControl} contract rather than a host bridge.
   *
   * Located by template reference; only `value`, `active` and `setValue` are read, since reading `key()` before Angular sets template inputs throws NG0950.
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

  /** The bounds the table is narrowed to, stamped when chosen so it can't slide under the auditor. */
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

  /**
   * Whether a custom range is the period in force. The chip cannot reopen its own dialog — re-selecting
   * "Custom" writes the value it already holds, so the selection signal never notifies — so editing the
   * bounds is a separate affordance rather than a second trip through the menu.
   */
  protected readonly customRangeApplied = computed(() => this.appliedPeriod() === "custom");

  /**
   * The Event chip's options: the whole event vocabulary, not just the kinds the loaded page happens to hold.
   *
   * Values are the wire vocabulary, sent to the server as-is.
   */
  protected readonly kindOptions = computed<AuditChipOption[]>(() =>
    Object.values(AccessAuditEventKind)
      .map((kind) => ({ label: this.i18nService.t(auditKindLabelKey(kind)), value: kind }))
      .sort(byLabel),
  );

  protected readonly actorOptions = computed<AuditChipOption[]>(() => {
    const candidates = this.identityCandidates("actor");
    // Offered unconditionally, since the loaded page can't say whether the organization has
    // any automated rows at all.
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

  /**
   * The Item chip's options: subjects the trail names in range, narrowed to the ones this viewer can put a name to.
   *
   * Neither the page nor the vault alone can supply this menu.
   */
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
   * Which of the Item chip's values are rules. One chip carries both kinds, but they are different
   * columns on the wire, and an id sent against the wrong one would silently match nothing.
   */
  private readonly ruleItemIds = computed(
    () =>
      new Set(
        this.itemFacets()
          .items.map((item) => item.ruleId)
          .filter((ruleId): ruleId is string => ruleId != null),
      ),
  );

  /**
   * The identities a chip can offer: the organization roster, widened by anyone the loaded rows name that the roster doesn't.
   *
   * Lets a departed member still be filtered on.
   */
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

  /** A multi-select chip's selection, or null for no selection, which matches every row. */
  private selectedValues(chip: FilterControl | undefined): string[] | null {
    const value = chip?.value();
    if (!Array.isArray(value)) {
      return null;
    }
    const selected = value.filter((entry): entry is string => typeof entry === "string");
    return selected.length > 0 ? selected : null;
  }

  /** The single-select time-period chip's selection, whose value is a scalar rather than a list. */
  private selectedValue(chip: FilterControl | undefined): string | null {
    const value = chip?.value();
    return typeof value === "string" ? value : null;
  }

  private readonly selectedPeriod = computed<AuditTimePeriod | null>(
    () => this.selectedValue(this.timePeriodChip()) as AuditTimePeriod | null,
  );

  /**
   * The read the chips currently describe. The automatic bucket is a menu option but travels on the wire as a flag, not an id.
   */
  private readonly filter = computed<AuditTrailFilter>(() => {
    const { from, to } = this.range();
    const actors = this.selectedValues(this.actorChip()) ?? [];
    const items = this.selectedValues(this.itemChip()) ?? [];
    const rules = this.ruleItemIds();
    return {
      start: from ?? undefined,
      end: to ?? undefined,
      kinds: (this.selectedValues(this.kindChip()) ?? []) as AccessAuditEventKind[],
      actorIds: actors.filter((value) => value !== AUTOMATED_ACTOR),
      includeAutomatedActor: actors.includes(AUTOMATED_ACTOR),
      requesterIds: this.selectedValues(this.requesterChip()) ?? [],
      cipherIds: items.filter((value) => !rules.has(value)),
      ruleIds: items.filter((value) => rules.has(value)),
    };
  });

  /**
   * The filter the rows on screen were read with, so a chip settling back onto it doesn't trigger a redundant re-read.
   */
  private readonly loadedFilterKey = signal<string | null>(null);

  private readonly filterKey = computed(() => JSON.stringify(this.filter()));

  /** Whether anything is narrowing the table, which is what puts "Clear all" at the end of the chip row. */
  protected readonly filtersActive = computed(() => this.chips().some((chip) => chip.active()));

  constructor() {
    // The chip has no value output, so its own selection signal drives the range; guarded
    // against the rollback write after a cancelled dialog.
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

  /** The bounds the Item menu was read over. Only these re-read it. */
  private readonly itemRangeKey = computed(() => {
    const { from, to } = this.range();
    return `${from?.getTime() ?? ""}|${to?.getTime() ?? ""}`;
  });

  private readonly loadedItemRangeKey = signal<string | null>(null);

  /**
   * Reads the subjects the trail names in range and resolves what this vault can name of them.
   *
   * A failure leaves the Item menu empty rather than taking the page down.
   */
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

  /** Narrows the table to a chosen period, opening the custom-range dialog for Custom. */
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
   * A cancelled dialog rolls the chip back to the period still in force.
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
    if (result.action === "clear") {
      this.resetTimePeriod();
      return;
    }
    this.customRange.set({ from: result.from, to: result.to });
    this.range.set({ from: auditRangeStart(result.from), to: auditRangeEnd(result.to) });
    this.appliedPeriod.set("custom");
  }

  /** Reopens the range dialog on the bounds in force, which the chip itself cannot do. */
  protected readonly editCustomRange = async (): Promise<void> => {
    await this.openCustomRange();
  };

  private setPeriod(period: AuditTimePeriod | null): void {
    this.timePeriodChip()?.setValue(period);
  }

  /** Drops the time period back to the whole fetched trail, chip and bounds together. */
  private resetTimePeriod(): void {
    this.customRange.set(NO_CUSTOM_RANGE);
    this.handledPeriod.set(null);
    this.appliedPeriod.set(null);
    this.range.set(UNBOUNDED_AUDIT_RANGE);
    this.setPeriod(null);
  }

  /** Resets every chip, so an auditor who narrowed the trail four ways gets back to all of it in one click. */
  protected clearAll(): void {
    for (const chip of this.chips()) {
      chip.setValue(null);
    }
    this.resetTimePeriod();
  }

  async ngOnInit(): Promise<void> {
    // Read once and outlives every filter; a failure narrows the identity chips, not the page.
    try {
      this.members.set(await this.loadMembers());
    } catch (e) {
      this.logService.error(e);
    }
    await this.load();
  }

  /**
   * Reads the first page for the filter in force and rebuilds everything derived from it. Safe to call again from the Update button.
   *
   * Leaves the rendered table in place until the reload succeeds, rather than dropping to a loading state.
   */
  protected readonly load = async (): Promise<void> => {
    const refreshing = this.status() === "ready";
    if (!refreshing) {
      this.status.set("loading");
    }
    // Stamped before the read, so a chip changed mid-flight is measured against the filter
    // actually being read.
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

  /**
   * Appends the next page to the table without touching {@link status}, preserving the auditor's place in it.
   */
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

  /** One page of the trail, shaped for the table. */
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

  /**
   * The organization's members, keyed by platform user id, for {@link members}.
   *
   * A failure here reaches {@link load} rather than resolving to an empty map.
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

  /** The member behind a row identity, if {@link members} resolved a linkable one; null otherwise. */
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

  /**
   * Opens the subject item's own event history. Reachable only from a row whose item decrypted, which is
   * to say one the viewer already holds.
   */
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

  /**
   * Opens one event's details in the side drawer.
   *
   * Identities and permissions are resolved here, not re-derived in the drawer, so the pane can't disagree with the row it came from.
   */
  protected openDetails(row: AuditRow): void {
    void this.showDetails(row);
  }

  /**
   * Opens the pane and tracks it while it is open.
   *
   * `close()` and `forceClose()` both emit on `closed`, so one subscription covers every way out, including replacement by a second row.
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

  /**
   * Downloads the filtered trail as CSV. An arrow property so `bitAction` can call it detached from the instance.
   *
   * Walks every page of the active filter rather than serializing the rows on screen.
   */
  protected readonly exportCsv = async (): Promise<void> => {
    const csv = this.auditExportService.getAuditExport(await this.readEveryPage());
    this.fileDownloadService.download({
      fileName: this.auditExportService.getFileName(),
      blobData: csv,
      blobOptions: { type: "text/csv" },
    });
  };

  /** Every row the active filter matches, read page by page; refuses rather than looping forever on a repeated page. */
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
