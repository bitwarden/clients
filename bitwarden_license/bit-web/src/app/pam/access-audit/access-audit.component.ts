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
 * Chip options for `candidates`, with a label two of them share qualified by whatever tells those two apart.
 *
 * The options are keyed on the identity rather than the label, but a menu offering the same words twice would
 * still let an auditor read a filtered half of the trail as the whole of one identity's activity — the very
 * outcome that keying was meant to prevent, arriving through the label instead. The qualifier is therefore
 * appended in the `Name (qualifier)` shape the member pickers already use
 * (`apps/web/src/app/admin-console/organizations/shared/components/access-selector/access-selector.models.ts`).
 * Where the trail carries no qualifier for a namesake, the two stay indistinguishable.
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
 * has no such dialog. The row itself opens {@link AuditEventDrawerComponent} over the same trail this
 * page already holds, which is where the fields too wide for a column live.
 *
 * The read is bounded and the toolbar filters (event kind, actor, requester, time period) are query
 * parameters on it, so changing one re-reads the trail rather than hiding rows already fetched — which is
 * what makes a filtered result the whole of what matches rather than the whole of what happened to be
 * loaded. The table holds one page at a time and grows through "Load more"; "All time" is the store's
 * ninety-day retention window, which is as far back as anything exists to show.
 *
 * The chip menus are therefore sourced from something other than the loaded page, since a page no longer
 * contains every distinct value: the event kinds are the vocabulary itself, and the identities are the
 * organization's roster, widened by any former member the loaded rows still name. There is no Item chip —
 * its options could only ever have come from the page, because an item is named by a cipher this viewer
 * decrypted locally and the server has no way to offer that list.
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
   * The organization whose trail to show, from the route. `requireSync` holds because `params` emits
   * its current value on subscribe, matching the sibling access-rules page.
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

  /**
   * Where the last page stopped, or null once the trail has none left. The server sets it only while more
   * remain, so this is also the answer to whether there is anything more to offer.
   */
  private readonly continuationToken = signal<string | null>(null);

  protected readonly canLoadMore = computed(() => this.continuationToken() != null);

  /**
   * The open details drawer, or null when none is open. Held as the ref rather than a bare flag so a
   * ref closing late — the drawer being replaced by activating a second row, which closes the first
   * one on the way — cannot report the newer drawer as closed.
   */
  private readonly detailsDrawer = signal<DrawerRef<unknown, AuditEventDrawerComponent> | null>(
    null,
  );

  /**
   * Whether the drawer is over the table, which is what drops Actor, Requester and Duration from it.
   *
   * Driven by the drawer's own state rather than a viewport breakpoint. What narrows the table is the
   * drawer taking its own grid column beside it, which a media query cannot see: a wide window with no
   * drawer would lose columns it has room for, and a window narrow enough for the drawer to overlay
   * rather than push would lose them while nothing was covering the table at all.
   */
  protected readonly detailsOpen = computed(() => this.detailsDrawer() != null);

  /**
   * The organization's members, keyed by PLATFORM user id — the id an audit row carries. The entity-events
   * dialog is keyed on the ORGANIZATION USER id instead, so an identity can only be linked once this map
   * has bridged the two.
   */
  private readonly members = signal(new Map<string, ResolvedMember>());

  protected readonly filterKeys = FILTER_KEYS;

  /**
   * The filter chips, which own their own selections. Read through the {@link FilterControl} contract
   * rather than a host bridge: this page is not a filterable surface with rows to facet, it is a few
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

  /**
   * Whether a custom range is the period in force. The chip cannot reopen its own dialog — re-selecting
   * "Custom" writes the value it already holds, so the selection signal never notifies — so editing the
   * bounds is a separate affordance rather than a second trip through the menu.
   */
  protected readonly customRangeApplied = computed(() => this.appliedPeriod() === "custom");

  /**
   * The Event chip's options: the whole vocabulary, not the kinds this page happens to be holding.
   *
   * A page is fifty rows, so deriving the menu from it would offer an auditor only the events they had
   * already scrolled past — and quietly withhold the filter for the one they came looking for. The cost is
   * options that match nothing in a given organization, which is the honest way round: an empty result
   * says the event never happened, where a missing option says nothing at all.
   *
   * The values are the wire vocabulary, so a selection goes to the server as it stands. That folds the
   * "Lease ended by holder" label into "Lease revoked" as a filter — the server records one kind and tells
   * the two apart by actor, and the Event column still labels each row for what it was.
   */
  protected readonly kindOptions = computed<AuditChipOption[]>(() =>
    Object.values(AccessAuditEventKind)
      .map((kind) => ({ label: this.i18nService.t(auditKindLabelKey(kind)), value: kind }))
      .sort(byLabel),
  );

  protected readonly actorOptions = computed<AuditChipOption[]>(() => {
    const candidates = this.identityCandidates("actor");
    // Offered unconditionally rather than only when a loaded row is automated: the page can no longer
    // answer whether the organization has any, and a filter that appears and disappears with the scroll
    // position is worse than one that sometimes finds nothing.
    candidates.set(AUTOMATED_ACTOR, {
      label: this.i18nService.t("pamAuditSystem"),
      qualifier: null,
    });
    return qualifiedOptions(candidates).sort(byLabel);
  });

  protected readonly requesterOptions = computed<AuditChipOption[]>(() =>
    qualifiedOptions(this.identityCandidates("requester")).sort(byLabel),
  );

  /**
   * The subjects the trail names in the range in force, with whatever this vault could make of them.
   *
   * Held together as one value so the menu never renders items whose names have not landed yet. The
   * names are resolved once, here, rather than per option: a `computed` cannot await, and re-resolving
   * on every recomputation would decrypt the same ciphers again for each keystroke elsewhere.
   */
  private readonly itemFacets = signal<{
    items: AccessAuditItemResponse[];
    cipherNameById: Map<string, string>;
    collectionNameById: Map<string, string>;
  }>({ items: [], cipherNameById: new Map(), collectionNameById: new Map() });

  /**
   * The Item chip's options: the subjects the trail actually names in range, narrowed to the ones this
   * viewer can put a name to.
   *
   * That intersection is the whole point of reading the subjects from the server. The page cannot supply
   * the menu — fifty rows name only some of what is in range — and this vault cannot either, since it
   * holds credentials the trail never mentions. A cipher that did not decrypt here has no label to
   * render and so is not offered, the same rule the Actor chip follows for an unresolved member; a rule
   * always has one, because its name is plaintext organization configuration.
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
   * The identities a chip can offer: the organization's roster first, widened by anyone the loaded rows
   * name that the roster does not.
   *
   * The roster is what makes the menu independent of the page. It cannot be the whole answer, though — a
   * former member is gone from it while the events they left behind still name them, and those events are
   * often exactly what an audit is about. So the rows contribute what the roster no longer can, which
   * means those particular options do still come and go with what is loaded. Naming them is better than
   * dropping them: the alternative is an auditor unable to filter to the person who left.
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

  /** A multi-select chip's selection, or null when it has none — which matches every row. */
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
   * The read the chips currently describe. The automatic bucket is split back out of the actor selection
   * here: it is a chip option because that is where an auditor looks for it, but on the wire it is a flag
   * rather than an id, since the events it selects have no actor to name.
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
   * What the rows on screen were read with, so a chip settling on the selection already in force does not
   * re-read the trail. The chips mount only once the first page has rendered, and their first report is
   * "nothing selected" — the very filter that page was read with — so without this every load would be
   * followed immediately by an identical second one.
   */
  private readonly loadedFilterKey = signal<string | null>(null);

  private readonly filterKey = computed(() => JSON.stringify(this.filter()));

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

    // Every chip re-reads the trail, because the filters are query parameters rather than a predicate over
    // rows already here. Driven off the resulting filter rather than off each chip, so the several signals
    // a single interaction touches -- the time-period chip writes its selection and then its bounds --
    // settle into one read instead of one per signal.
    effect(() => {
      const key = this.filterKey();
      untracked(() => {
        if (key === this.loadedFilterKey() || this.status() === "loading") {
          return;
        }
        void this.load();
      });
    });

    // The Item menu follows the time period and nothing else. The range is what changes which items exist,
    // so a menu ignoring it would offer options the page can never match; the other dimensions are not,
    // and narrowing to one actor must not quietly drop the credentials they never touched from a menu an
    // auditor is using to look for exactly that.
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
   * A failure leaves the Item menu empty rather than taking the page down: the trail is still readable
   * without one of its filters, and an auditor who cannot narrow by item is better off than one looking
   * at an error page.
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
    // The roster is read once and outlives every filter: it is what lets the identity chips offer someone
    // the current page does not happen to name. A failure here leaves the chips narrower, not the trail
    // unreadable, so it does not take the page down with it.
    try {
      this.members.set(await this.loadMembers());
    } catch (e) {
      this.logService.error(e);
    }
    await this.load();
  }

  /**
   * Reads the first page of the trail for the filter in force and rebuilds everything derived from it. An
   * arrow property so `bitAction` can call it detached from the instance, and safe to call on an
   * already-rendered page: the Update button re-runs it so events recorded since the page opened appear.
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
    // Stamped before the read rather than after it, so a chip touched while this one is in flight is
    // measured against the filter being read and not against the one before it.
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
      // Nothing to show is two different states, and they must not be confused now that a filter can
      // produce one: an organization with no PAM activity yet gets the trail's own empty state, while a
      // filter that matched nothing stays "ready" so the chip row -- and the way back out of it --
      // remains on the page. Read off the filter this page was fetched with rather than the chips'
      // current state, so a chip touched mid-flight cannot decide which empty state the answer lands in.
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
   * Appends the next page to the table.
   *
   * Appends rather than replaces, and never touches {@link status}: an auditor reading down a trail is
   * holding their place in it, and swapping the table out from under them to reload what they were already
   * looking at would lose it. A failure is raised to `bitAction`, which reports it while what is already on
   * screen stays there.
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

  /**
   * Which read the rows on screen belong to.
   *
   * A refresh deliberately leaves the table rendered rather than dropping to "loading", so the chips stay
   * live and a second read can start while the first is still out. Without a sequence, whichever came back
   * last would win — and a slow answer to a filter the auditor has already moved off would overwrite the
   * one they are waiting for, leaving the table disagreeing with the chips above it.
   */
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
   * The identities are resolved here rather than in the drawer so the pane links exactly what the row
   * under it links — the member lookup ran once for the whole trail, and a second answer could
   * disagree with the first. An automated row has no actor to resolve: its cell reads "System",
   * which is a value, not a member.
   *
   * The two permissions travel with the data for the same reason: this page already reads the viewer's
   * membership once, and a drawer re-deriving them could offer a link the page would not.
   */
  protected openDetails(row: AuditRow): void {
    void this.showDetails(row);
  }

  /**
   * Opens the pane and tracks it for as long as it is open.
   *
   * A drawer has no backdrop to dismiss — it occupies its own column beside the table rather than
   * covering the page — so every way out of one ends in `DrawerRef.close()` or `_forceClose()`, and
   * both emit on `closed`: the X button, Escape, a route change under `closeOnNavigation`, and
   * `openDrawer` itself tearing the stack down when a second row is activated. Subscribing to that one
   * observable therefore covers every route, including the replacement, where the outgoing ref emits
   * before this call has the incoming one.
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
   * Downloads the filtered trail as CSV. An arrow property so `bitAction` can call it detached from the
   * instance.
   *
   * Walks every page of the active filter rather than serializing the rows on screen. An auditor who
   * narrowed the table to one requester and one week is asking for that week — all of it, not the first
   * fifty of it — and a file that silently stops at the page boundary is the one outcome an audit export
   * must not produce: it looks complete. The filters are what bound how much this pulls, and every name in
   * the file is one this viewer could already have read on screen.
   */
  protected readonly exportCsv = async (): Promise<void> => {
    const csv = this.auditExportService.getAuditExport(await this.readEveryPage());
    this.fileDownloadService.download({
      fileName: this.auditExportService.getFileName(),
      blobData: csv,
      blobOptions: { type: "text/csv" },
    });
  };

  /**
   * Every row the active filter matches, read page by page.
   *
   * Guarded on the position advancing rather than on a row count: a server that answered every request
   * with the same token would otherwise spin here forever, writing the same page into the file until the
   * tab died. Refusing outright is the right failure — `bitAction` reports it, and no file is written that
   * claims to be the trail and is not.
   */
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
