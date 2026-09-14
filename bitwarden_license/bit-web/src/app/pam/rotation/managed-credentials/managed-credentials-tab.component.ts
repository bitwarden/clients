import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
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
  ButtonModule,
  DialogService,
  FILTER_CONTROL,
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
  TableDataSource,
  TableModule,
  ToastService,
  TooltipDirective,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { THEN_MANAGED_CREDENTIAL, THEN_QUERY_PARAM } from "../create-flow";
import { filterOptions } from "../filter-options";
import { OrgCiphersService } from "../org-ciphers.service";
import { RotationConfigId, TargetSystemMethod, TargetSystem, TargetSystemId } from "../rotation";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RowBusyTracker } from "../row-busy-tracker";
import { showSkeletonWhile } from "../skeleton-delay";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { ROTATION_STATUS_BADGES, RotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

/**
 * Managed credentials tab: lists all rotation configs for the organisation.
 *
 * Row menu actions call the service methods directly, toasting on success or failure;
 * confirmations use `DialogService.openSimpleDialog`. The edit page is a shell sibling, so
 * navigation uses `["..", "managed-credentials", id]`.
 */
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
    TableModule,
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

  protected readonly loading = toSignal(this.configsService.loading$, { initialValue: true });
  protected readonly loadError = toSignal(this.configsService.loadError$, { initialValue: null });

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  /** Whether the loading branch is on screen. */
  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly rows = toSignal(this.configsService.rows$, {
    initialValue: [] as RotationConfigRow[],
  });

  /**
   * Whether any target systems exist. A rotation config always references a target system, so
   * with none the tab directs the user to set one up first instead of offering to create a config.
   */
  private readonly targetSystems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [] as TargetSystem[],
  });
  protected readonly hasTargetSystems = computed(() => this.targetSystems().length > 0);

  private readonly targetSystemsLoading = toSignal(this.targetSystemsService.loading$, {
    initialValue: true,
  });
  private readonly targetSystemsLoadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null,
  });

  /** Whether the target-system list has actually been read. */
  protected readonly targetSystemsKnown = computed(
    () => !this.targetSystemsLoading() && this.targetSystemsLoadError() == null,
  );

  protected readonly dataSource = new TableDataSource<RotationConfigRow>();

  protected readonly searchControl = new FormControl("", { nonNullable: true });
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  /** Expose for template. */
  protected readonly TargetSystemMethod = TargetSystemMethod;

  private readonly busyRows = new RowBusyTracker<RotationConfigId>();

  protected readonly isRowBusy = this.busyRows.isBusy;

  /** Status/target-system/collection toolbar chips. */
  /** The status filter offers every status a row can hold, named by the badge that shows it. */
  protected readonly statusBadges = ROTATION_STATUS_BADGES;

  private readonly statusFilterChip = viewChild("statusFilter", { read: FILTER_CONTROL });
  private readonly targetSystemFilterChip = viewChild("targetSystemFilter", {
    read: FILTER_CONTROL,
  });
  private readonly collectionFilterChip = viewChild("collectionFilter", { read: FILTER_CONTROL });

  /**
   * Distinct target systems present in the currently-loaded rows, keyed by id and sorted by name
   * for the chip.
   */
  protected readonly targetSystemOptions = computed(() =>
    filterOptions(
      this.rows().map((row) => [row.config.targetSystemId, row.targetSystemName] as const),
    ),
  );

  private readonly ciphers = toSignal(this.orgCiphersService.ciphers$, {
    initialValue: [] as CipherView[],
  });

  /** Each cipher's collection ids, keyed by its id, for resolving a row's collections via `cipherId`. */
  private readonly cipherCollectionIdsById = computed(() => {
    const map = new Map<CipherId, string[]>();
    for (const cipher of this.ciphers()) {
      map.set(asUuid<CipherId>(cipher.id), cipher.collectionIds);
    }
    return map;
  });

  /** The org's collections, for resolving the ids above to names. */
  private readonly collections = signal<CollectionAdminView[]>([]);

  /** Whether the collection read failed, as opposed to answering with nothing. */
  private readonly collectionsUnavailable = signal(false);

  /**
   * Collection filter options: only the collections actually reachable from a visible row's
   * cipher, not every collection in the org.
   */
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
   * `row`'s cipher's collection ids, via {@link cipherCollectionIdsById}, or `undefined` when the
   * cipher never loaded.
   */
  private cipherCollectionIds(row: RotationConfigRow): string[] | undefined {
    return this.cipherCollectionIdsById().get(row.config.cipherId);
  }

  constructor() {
    effect(() => {
      void this.loadAll(this.organizationId());
    });

    effect(() => {
      this.dataSource.data = this.rows();
    });

    effect(() => {
      const text = this.searchText().trim().toLowerCase();
      const status = this.statusFilterChip()?.value() as string | null | undefined;
      const targetSystemId = this.targetSystemFilterChip()?.value() as
        TargetSystemId | null | undefined;
      const collectionId = this.collectionFilterChip()?.value() as string | null | undefined;

      this.dataSource.filter = (row) => {
        if (
          text !== "" &&
          !row.cipherName.toLowerCase().includes(text) &&
          !row.targetSystemName.toLowerCase().includes(text)
        ) {
          return false;
        }
        if (status != null && row.statusLabelKey !== status) {
          return false;
        }
        if (targetSystemId != null && row.config.targetSystemId !== targetSystemId) {
          return false;
        }
        const rowCollectionIds = this.cipherCollectionIds(row);
        if (
          collectionId != null &&
          rowCollectionIds !== undefined &&
          !rowCollectionIds.includes(collectionId)
        ) {
          return false;
        }
        return true;
      };
    });
  }

  /** Read the collections the filter chip names its options with. */
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

  protected readonly processedRows = toSignal(this.dataSource.connect(), {
    initialValue: [] as RotationConfigRow[],
  });

  protected readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);
  protected readonly noResults = computed(
    () => !this.loading() && this.rows().length > 0 && this.processedRows().length === 0,
  );

  /** `configsService.load` loads the org's target systems as part of its own read. */
  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.configsService.load(organizationId),
      this.loadCollections(organizationId),
    ]);
  }

  /** Whether the operator has asked for a retry. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.loadAll(this.organizationId());
  };

  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", "new"], { relativeTo: this.route });

  /**
   * Set up the first target system (shown when none exist yet), then come back here to create the
   * credential that needed it.
   */
  protected readonly setUpTargetSystem = (): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", "new"], {
      relativeTo: this.route,
      queryParams: { [THEN_QUERY_PARAM]: THEN_MANAGED_CREDENTIAL },
    });

  protected readonly openEdit = (row: RotationConfigRow): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", row.id], { relativeTo: this.route });

  protected readonly rotateNow = (row: RotationConfigRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      try {
        await this.configsService.rotateNow(row.config);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamRotationConfigRotateNowSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly confirmRecordManual = (row: RotationConfigRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamRotationConfigMarkRotatedTitle" },
        content: { key: "pamRotationConfigRecordManualContent" },
        acceptButtonText: { key: "pamRotationConfigRecordManualConfirm" },
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
          message: this.i18nService.t("pamRotationConfigRecordManualSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly pause = (row: RotationConfigRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      try {
        await this.configsService.pause(row.config);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamRotationConfigPauseSuccess"),
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
        acceptButtonText: { key: "remove" },
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
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}
