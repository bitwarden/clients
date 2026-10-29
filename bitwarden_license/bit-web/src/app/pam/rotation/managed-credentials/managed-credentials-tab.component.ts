import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { NoResults } from "@bitwarden/assets/svg";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  BadgeVariant,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitHeaderRowComponent,
  BitRowComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  DialogService,
  FilterMenuComponent,
  FilterMenuModule,
  IconButtonModule,
  IconTileVariant,
  IconModule,
  LinkModule,
  MenuModule,
  SearchModule,
  SkeletonComponent,
  SkeletonTextComponent,
  StatusLockupComponent,
  SvgComponent,
  ToastService,
  TooltipDirective,
  defineTable,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessConnectorRegisterDialogComponent } from "../access-connectors/access-connector-register-dialog.component";
import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
import {
  TARGET_SYSTEM_QUERY_PARAM,
  THEN_MANAGED_CREDENTIAL,
  THEN_QUERY_PARAM,
} from "../create-flow";
import { filterOptions } from "../filter-options";
import { OrgCiphersService } from "../org-ciphers.service";
import {
  RotationConfigId,
  TargetSystemMethod,
  TargetSystemView,
  TargetSystemId,
} from "../rotation";
import { rotationErrorMessage } from "../rotation-error";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { lastRotatedText, nextRotationText, RelativeTimeText } from "../rotation-relative-time";
import { RowBusyTracker } from "../row-busy-tracker";
import { showSkeletonWhile } from "../skeleton-delay";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { confirmPauseRotation, confirmRotateNow } from "./rotation-action-dialogs";
import {
  ROTATION_STATUS_BADGES,
  RotationConfigRow,
  RotationRowStatus,
} from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

@Component({
  selector: "app-managed-credentials-tab",
  templateUrl: "./managed-credentials-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BadgeModule,
    ButtonModule,
    FilterMenuModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitHeaderRowComponent,
    BitRowComponent,
    BitCellComponent,
    BitCellDefDirective,
    TooltipDirective,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    I18nPipe,
  ],
})
export class ManagedCredentialsTabComponent {
  protected readonly noItemsIcon = NoResults;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly configsService = inject(RotationConfigsService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly orgCiphersService = inject(OrgCiphersService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly accessConnectorsService = inject(AccessConnectorsService);

  protected readonly loading = toSignal(this.configsService.loading$, { initialValue: true });
  protected readonly loadError = toSignal(this.configsService.loadError$, { initialValue: null });

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly rows = toSignal(this.configsService.rows$, {
    initialValue: [] as RotationConfigRow[],
  });

  /** A config needs a target system, so with none the tab offers to set one up instead. */
  private readonly targetSystems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [] as TargetSystemView[],
  });
  protected readonly hasTargetSystems = computed(() => this.targetSystems().length > 0);

  private readonly accessConnectors = toSignal(this.accessConnectorsService.accessConnectors$, {
    initialValue: [],
  });
  private readonly accessConnectorsLoading = toSignal(this.accessConnectorsService.loading$, {
    initialValue: true,
  });
  private readonly accessConnectorsLoadError = toSignal(this.accessConnectorsService.loadError$, {
    initialValue: null,
  });

  private readonly targetSystemsLoading = toSignal(this.targetSystemsService.loading$, {
    initialValue: true,
  });
  private readonly targetSystemsLoadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null,
  });

  /** Whether the target-system list has been read successfully. */
  protected readonly targetSystemsKnown = computed(
    () => !this.targetSystemsLoading() && this.targetSystemsLoadError() == null,
  );

  /**
   * What the empty table asks for first. An org needs an access connector and a target system
   * before a credential can rotate, so the empty state walks through them in that order. A read
   * that hasn't landed, or failed, is not taken as proof that something is missing, and it isn't
   * taken as proof that nothing is: the action stays "unknown" and offers no button.
   */
  protected readonly emptyStateAction = computed<EmptyStateAction>(() => {
    const connectorsKnown =
      !this.accessConnectorsLoading() && this.accessConnectorsLoadError() == null;
    if (!connectorsKnown || !this.targetSystemsKnown()) {
      return "unknown";
    }
    if (this.accessConnectors().length === 0) {
      return "access-connector";
    }
    if (!this.hasTargetSystems()) {
      return "target-system";
    }
    return "credential";
  });

  /**
   * The empty state's one primary action, or null while the prerequisites are unknown;
   * `idSuffix` keeps each variant's button addressable.
   */
  protected readonly emptyStateCta = computed(() => {
    switch (this.emptyStateAction()) {
      case "unknown":
        return null;
      case "access-connector":
        return {
          idSuffix: "add-access-connector-empty",
          labelKey: "pamRotationConfigAddAccessConnectorCta",
          run: (): void => void this.registerAccessConnector(),
        };
      case "target-system":
        return {
          idSuffix: "setup-target-system",
          labelKey: "pamRotationConfigSetUpTargetSystem",
          run: () => void this.setUpTargetSystem(),
        };
      case "credential":
        return {
          idSuffix: "new-empty",
          labelKey: "pamRotationConfigAddEmptyCta",
          run: () => void this.openCreate(),
        };
    }
  });

  protected readonly table = defineTable<RotationConfigRow, "actions">(this.rows);

  protected readonly searchControl = new FormControl("", { nonNullable: true });

  private readonly filterMenus = viewChildren(FilterMenuComponent);

  /** Resets every chip and the search box, for the empty state shown when they match nothing. */
  protected readonly clearFilters = (): void => {
    this.filterMenus().forEach((menu) => menu.clear());
    this.searchControl.setValue("");
  };

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  protected readonly TargetSystemMethod = TargetSystemMethod;

  private readonly busyRows = new RowBusyTracker<RotationConfigId>();

  protected readonly isRowBusy = this.busyRows.isBusy;

  /** The status filter offers every status a row can hold, named by the badge that shows it. */
  protected readonly statusBadges = ROTATION_STATUS_BADGES.map((badge) => ({
    ...badge,
    iconTile: { icon: badge.icon, variant: STATUS_TILE_VARIANTS[badge.variant] },
  }));

  protected readonly triggerOptions = ROTATION_TRIGGER_OPTIONS;

  /** The target system the operator drilled in from, which may have no credentials yet. */
  private readonly drillInTargetSystemId =
    this.route.snapshot.queryParamMap.get(TARGET_SYSTEM_QUERY_PARAM);

  /**
   * The target systems the loaded rows name, keyed by id, plus the one drilled in from, so a target
   * with no credentials still gets a chip and scopes the list to nothing.
   */
  protected readonly targetSystemOptions = computed(() => {
    const pairs = this.rows().map(
      (row) => [row.config.targetSystemId, row.targetSystemName] as const,
    );
    const drillIn = this.targetSystems().find(
      (system) => String(system.id) === this.drillInTargetSystemId,
    );
    if (drillIn != null) {
      pairs.push([drillIn.id, drillIn.name] as const);
    }
    return filterOptions(pairs);
  });

  private readonly ciphers = toSignal(this.orgCiphersService.ciphers$, {
    initialValue: [] as CipherView[],
  });

  private readonly cipherCollectionIdsById = computed(() => {
    const map = new Map<CipherId, string[]>();
    for (const cipher of this.ciphers()) {
      map.set(asUuid<CipherId>(cipher.id), cipher.collectionIds);
    }
    return map;
  });

  /** The org's collections, for naming the chip's options. */
  private readonly collections = signal<CollectionAdminView[]>([]);

  /** Whether the collection read failed, as opposed to answering with nothing. */
  private readonly collectionsUnavailable = signal(false);

  /** Only the collections a loaded row's cipher is in, not every collection in the org. */
  protected readonly collectionOptions = computed(() => {
    if (this.collectionsUnavailable()) {
      return [];
    }
    const nameById = new Map(this.collections().map((c) => [uuidAsString(c.id), c.name]));
    return filterOptions(
      this.rows().flatMap((row) =>
        (this.cipherCollectionIds(row) ?? []).map((id) => [id, nameById.get(id) ?? id] as const),
      ),
    );
  });

  /**
   * The names of the shared folders each row's cipher is in. A folder whose name hasn't resolved is
   * left out rather than shown as an id.
   */
  protected readonly folderNamesByRowId = computed(() => {
    const nameById = new Map(this.collections().map((c) => [uuidAsString(c.id), c.name]));
    const names = new Map<RotationConfigId, string[]>();
    for (const row of this.rows()) {
      const folders = (this.cipherCollectionIds(row) ?? []).flatMap((id) => {
        const name = nameById.get(id);
        return name == null ? [] : [name];
      });
      names.set(row.id, folders);
    }
    return names;
  });

  /** `undefined` when the row's cipher never loaded. */
  private cipherCollectionIds(row: RotationConfigRow): string[] | undefined {
    return this.cipherCollectionIdsById().get(row.config.cipherId);
  }

  /** The table's row test; the toolbar passes the chip and search values as `values`. */
  protected readonly rowMatchesFilter = (
    row: RotationConfigRow,
    values: ManagedCredentialFilterValues,
  ): boolean => this.matchesFilter(row, toManagedCredentialFilter(values));

  /**
   * A row whose cipher never loaded passes the collection chip, since its collections are unknown
   * rather than empty.
   */
  private matchesFilter(row: RotationConfigRow, filter: ManagedCredentialFilter): boolean {
    const { text, statuses, targetSystemIds, collectionIds, method, triggers } = filter;
    if (text !== "" && !this.searchHaystack(row).some((value) => value.includes(text))) {
      return false;
    }
    if (statuses.length > 0 && !statuses.includes(row.status)) {
      return false;
    }
    if (targetSystemIds.length > 0 && !targetSystemIds.includes(row.config.targetSystemId)) {
      return false;
    }
    const rowCollectionIds = this.cipherCollectionIds(row);
    if (
      collectionIds.length > 0 &&
      rowCollectionIds !== undefined &&
      !collectionIds.some((id) => rowCollectionIds.includes(id))
    ) {
      return false;
    }
    if (method != null && row.config.targetSystemMethod !== method) {
      return false;
    }
    if (triggers.length > 0 && !rowTriggers(row).some((trigger) => triggers.includes(trigger))) {
      return false;
    }
    return true;
  }

  private searchHaystack(row: RotationConfigRow): string[] {
    return [
      row.cipherName,
      row.accountIdentity ?? "",
      ...(this.folderNamesByRowId().get(row.id) ?? []),
    ].map((value) => value.toLowerCase());
  }

  private readonly targetSystemFilter = viewChild<FilterMenuComponent>("targetSystemFilter");

  /** The target system the operator drilled in from, applied once its option exists. */
  private readonly pendingTargetSystemId = signal<string | null>(this.drillInTargetSystemId);

  constructor() {
    // The rotation shell loads the configs on mount, so the tab only adds its collections and the
    // access connectors the empty state asks about.
    effect(() => {
      void this.loadCollections(this.organizationId());
      void this.accessConnectorsService.load(this.organizationId());
    });

    // Seeds the target system chip from the drill-down link on the Target systems tab.
    effect(() => {
      const filter = this.targetSystemFilter();
      const id = this.pendingTargetSystemId();
      if (filter == null || id == null || this.loadingVisible() || !this.targetSystemsKnown()) {
        return;
      }
      this.pendingTargetSystemId.set(null);
      if (this.targetSystemOptions().some((option) => String(option.value) === id)) {
        filter.setValue([id]);
      }
    });
  }

  private async loadCollections(organizationId: OrganizationId): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const collections = await firstValueFrom(
        this.collectionAdminService.collectionAdminViews$(organizationId, userId),
      );
      this.collections.set(collections);
      this.collectionsUnavailable.set(false);
    } catch {
      this.collections.set([]);
      this.collectionsUnavailable.set(true);
    }
  }

  protected readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);

  /** `configsService.load` loads the org's target systems as part of its own read. */
  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.configsService.load(organizationId),
      this.accessConnectorsService.load(organizationId),
      this.loadCollections(organizationId),
    ]);
  }

  /** Whether the operator has asked for a retry. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.loadAll(this.organizationId());
  };

  /** Bound to the empty state shown when the org has no access connector yet. */
  protected readonly registerAccessConnector = async (): Promise<void> => {
    const orgId = this.organizationId();
    const ref = AccessConnectorRegisterDialogComponent.open(this.dialogService, {
      data: { organizationId: orgId },
    });
    const result = await ref.closed.toPromise();
    if (result) {
      await this.accessConnectorsService.registerCompleted(orgId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessConnectorRegistered"),
      });
    }
  };

  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", "new"], { relativeTo: this.route });

  /**
   * Shown when no target system exists. After creating one, the operator lands on the managed
   * credential create page.
   */
  protected readonly setUpTargetSystem = (): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", "new"], {
      relativeTo: this.route,
      queryParams: { [THEN_QUERY_PARAM]: THEN_MANAGED_CREDENTIAL },
    });

  protected readonly openEdit = (row: RotationConfigRow): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", row.id], { relativeTo: this.route });

  protected readonly openHistory = (row: RotationConfigRow): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", row.id, "history"], {
      relativeTo: this.route,
    });

  protected readonly sortByStatus = withNameTieBreak(
    (a, b) => a.statusSortOrder - b.statusSortOrder,
  );

  protected readonly sortByLastRotated = withNameTieBreak(
    (a, b) => (a.lastRotationAtMs ?? -Infinity) - (b.lastRotationAtMs ?? -Infinity) || 0,
  );

  protected readonly sortByNextRotation = withNameTieBreak((a, b) => {
    const now = Date.now();
    const rankA = nextRotationRank(a, now);
    const rankB = nextRotationRank(b, now);
    return rankA.bucket - rankB.bucket || rankA.ms - rankB.ms;
  });

  protected folderLine(row: RotationConfigRow): string {
    return (this.folderNamesByRowId().get(row.id) ?? []).join(", ");
  }

  /** `null` when the design shows no wording for the span, so the cell falls back to a date. */
  protected lastRotatedLabel(row: RotationConfigRow): string | null {
    return this.relativeLabel(lastRotatedText(row.lastRotationAtMs, Date.now()));
  }

  protected nextRotationLabel(row: RotationConfigRow): string | null {
    const next = row.nextRotation;
    if (next.kind === "in-progress") {
      return this.i18nService.t("pamRotationNextInProgress");
    }
    if (next.kind === "none") {
      return this.i18nService.t("pamRotationNextNone");
    }
    return this.relativeLabel(nextRotationText(next.ms, Date.now()));
  }

  private relativeLabel(text: RelativeTimeText | null): string | null {
    if (text == null) {
      return null;
    }
    return text.count == null
      ? this.i18nService.t(text.key)
      : this.i18nService.t(text.key, text.count);
  }

  /** Why Rotate now is unavailable, or `null` when it is available or no reason is known. */
  protected rotateNowReasonKey(row: RotationConfigRow): string | null {
    if (row.config.hasActiveJob) {
      return "pamRotationConfigRotateNowInProgress";
    }
    if (!row.config.enabled) {
      return "pamRotationConfigRotateNowPaused";
    }
    if (row.notConnected) {
      return "pamRotationConfigRotateNowNotConnected";
    }
    return null;
  }

  protected canRotateNow(row: RotationConfigRow): boolean {
    return row.canRotateNow && !row.notConnected;
  }

  protected readonly rotateNow = (row: RotationConfigRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      if (row.config.sealed?.terminateSessions && !(await confirmRotateNow(this.dialogService))) {
        return;
      }
      try {
        await this.configsService.rotateNow(row.config);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamRotationConfigRotateNowStarted"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly confirmRecordManual = (row: RotationConfigRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamRotationConfigMarkRotatedTitle" },
        content: { key: "pamRotationConfigMarkRotatedContent" },
        acceptButtonText: { key: "pamRotationConfigMarkRotated" },
        cancelButtonText: { key: "cancel" },
        type: "info",
      });
      if (!confirmed) {
        return;
      }
      try {
        await this.configsService.recordManual(row.config);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamRotationConfigMarkedRotated"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly pause = (row: RotationConfigRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await confirmPauseRotation(this.dialogService);
      if (!confirmed) {
        return;
      }
      try {
        const wasRotating = row.hasActiveJob;
        await this.configsService.pause(row.config);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t(
            wasRotating
              ? "pamRotationConfigPauseWhileRotatingSuccess"
              : "pamRotationConfigPauseSuccess",
          ),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly resume = (row: RotationConfigRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      try {
        await this.configsService.resume(row.config);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamRotationConfigResumeSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly confirmDelete = (row: RotationConfigRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamRotationConfigDeleteConfirmTitle" },
        content: { key: "pamRotationConfigDeleteConfirmContent" },
        acceptButtonText: { key: "pamRotationConfigRemoveFromRotation" },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      });
      if (!confirmed) {
        return;
      }
      try {
        await this.configsService.delete(row.config);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamRotationConfigDeleteSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  private showError(e: unknown): void {
    const message =
      rotationErrorMessage(e) ??
      (e instanceof ErrorResponse ? e.message : undefined) ??
      this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}

type EmptyStateAction = "access-connector" | "target-system" | "credential" | "unknown";

const ROTATION_TRIGGER_OPTIONS = [
  { value: "schedule", labelKey: "pamRotationTriggerSchedule" },
  { value: "access-end", labelKey: "pamRotationTriggerAccessEnd" },
  { value: "on-demand", labelKey: "pamRotationTriggerOnDemand" },
] as const;

type RotationTrigger = (typeof ROTATION_TRIGGER_OPTIONS)[number]["value"];

const STATUS_TILE_VARIANTS: Partial<Record<BadgeVariant, IconTileVariant>> = {
  primary: "primary",
  success: "success",
  warning: "warning",
  danger: "danger",
  subtle: "gray",
};

/** A row can have a schedule and rotate on access end at once; with neither it runs on demand. */
function rowTriggers(row: RotationConfigRow): RotationTrigger[] {
  const triggers: RotationTrigger[] = [];
  if (row.config.scheduleCron != null) {
    triggers.push("schedule");
  }
  if (row.config.rotateOnAccessEnd) {
    triggers.push("access-end");
  }
  return triggers.length > 0 ? triggers : ["on-demand"];
}

type RowComparator = (a: RotationConfigRow, b: RotationConfigRow) => number;

/**
 * The table multiplies a comparator's result by the sort direction, so the name tie-break is
 * flipped for descending to keep ties A to Z either way.
 */
function withNameTieBreak(compare: RowComparator) {
  return (a: RotationConfigRow, b: RotationConfigRow, direction?: "asc" | "desc"): number =>
    compare(a, b) || a.cipherName.localeCompare(b.cipherName) * (direction === "desc" ? -1 : 1);
}

/** Overdue first, then soonest, then in progress, then none. */
function nextRotationRank(row: RotationConfigRow, now: number): { bucket: number; ms: number } {
  const next = row.nextRotation;
  if (next.kind === "at") {
    return { bucket: next.ms < now ? 0 : 1, ms: next.ms };
  }
  return { bucket: next.kind === "in-progress" ? 2 : 3, ms: 0 };
}

/** The toolbar's raw values by filter key, untyped because each chip reports its own value type. */
type ManagedCredentialFilterValues = {
  search?: string;
  status?: unknown;
  targetSystem?: unknown;
  collection?: unknown;
  method?: unknown;
  trigger?: unknown;
};

type ManagedCredentialFilter = {
  text: string;
  statuses: RotationRowStatus[];
  targetSystemIds: TargetSystemId[];
  collectionIds: string[];
  method: TargetSystemMethod | null;
  triggers: RotationTrigger[];
};

/** A multi-select chip reports an array and a single-select one a scalar or `null`. */
function toArray<T>(value: unknown): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

function toManagedCredentialFilter(values: ManagedCredentialFilterValues): ManagedCredentialFilter {
  return {
    text: (values.search ?? "").trim().toLowerCase(),
    statuses: toArray<RotationRowStatus>(values.status),
    targetSystemIds: toArray<TargetSystemId>(values.targetSystem),
    collectionIds: toArray<string>(values.collection),
    method: (values.method ?? null) as TargetSystemMethod | null,
    triggers: toArray<RotationTrigger>(values.trigger),
  };
}
