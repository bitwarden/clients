import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { filter, firstValueFrom, map } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableV2Component,
  ButtonModule,
  ChipActionComponent,
  DialogService,
  FILTER_CONTROL,
  FilterMenuModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  PopoverModule,
  SearchModule,
  SkeletonComponent,
  SkeletonTextComponent,
  StatusLockupComponent,
  SvgComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TooltipDirective,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  accessConnectorDeactivateConfirmOptions,
  accessConnectorDeleteConfirmOptions,
} from "../../helpers/access-connector-confirm";
import { assignableTargetSystems } from "../assignable";
import { filterOptions } from "../filter-options";
import { AccessConnectorId, TargetSystemId, TargetSystem } from "../rotation";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RowBusyTracker } from "../row-busy-tracker";
import { showSkeletonWhile } from "../skeleton-delay";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { accessConnectorConnectionLabelKey } from "./access-connector-label";
import { AccessConnectorRegisterDialogComponent } from "./access-connector-register-dialog.component";
import { AccessConnectorRow, AccessConnectorsService } from "./access-connectors.service";
import { AssignTargetDialogComponent } from "./assign-target-dialog.component";

/**
 * A {@link AccessConnectorRow} with the row menu's own state added.
 */
export type AccessConnectorTabRow = AccessConnectorRow & {
  /**
   * Why no target system can be assigned to this connector right now, as the i18n key the menu
   * item's tooltip states, or null when one can.
   */
  readonly assignTargetsBlockedKey: string | null;
};

@Component({
  selector: "app-access-connectors-tab",
  templateUrl: "./access-connectors-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    BadgeModule,
    ButtonModule,
    ChipActionComponent,
    FilterMenuModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    PopoverModule,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
    TableModule,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    TooltipDirective,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    I18nPipe,
  ],
})
export class AccessConnectorsTabComponent {
  protected readonly noItemsIcon = NoResults;

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accessConnectorsService = inject(AccessConnectorsService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly configService = inject(ConfigService);

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected readonly loading = toSignal(this.accessConnectorsService.loading$, {
    initialValue: true,
  });
  protected readonly loadError = toSignal(this.accessConnectorsService.loadError$, {
    initialValue: null,
  });

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  /**
   * Whether the loading branch is on screen.
   */
  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly serviceRows = toSignal(this.accessConnectorsService.rows$, {
    initialValue: [] as AccessConnectorRow[],
  });
  private readonly automaticSystems = toSignal(this.targetSystemsService.automaticSystems$, {
    initialValue: [] as TargetSystem[],
  });
  private readonly targetSystemsLoading = toSignal(this.targetSystemsService.loading$, {
    initialValue: true,
  });
  private readonly targetSystemsLoadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null,
  });

  /**
   * Whether the target-system list has actually been read.
   */
  private readonly targetSystemsKnown = computed(
    () => !this.targetSystemsLoading() && this.targetSystemsLoadError() == null,
  );

  /**
   * Whether the target-system read has landed and failed, so there is no list to offer.
   */
  private readonly targetSystemsUnavailable = computed(
    () => !this.targetSystemsLoading() && this.targetSystemsLoadError() != null,
  );

  private readonly rows = computed<AccessConnectorTabRow[]>(() => {
    const eligible = this.automaticSystems();
    const known = this.targetSystemsKnown();
    return this.serviceRows().map((row) => ({
      ...row,
      assignTargetsBlockedKey: this.assignTargetsBlockedKey(row, eligible, known),
    }));
  });

  protected readonly dataSource = new TableDataSource<AccessConnectorTabRow>();
  protected readonly table = defineTable<AccessConnectorTabRow, "actions">(this.rows);
  /**
   * Model for the loading placeholder, which draws no data rows: while a load is in flight, rows
   * already held from an earlier load would otherwise show through before the skeleton's delay.
   */
  protected readonly loadingTable = defineTable<AccessConnectorTabRow, "actions">(
    signal<AccessConnectorTabRow[]>([]),
  );
  protected readonly searchControl = new FormControl("", { nonNullable: true });
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  /** Status/connection toolbar chips. */
  private readonly statusFilterChip = viewChild("statusFilter", { read: FILTER_CONTROL });
  private readonly connectionFilterChip = viewChild("connectionFilter", { read: FILTER_CONTROL });

  protected readonly statusOptions = computed(() =>
    filterOptions(
      this.rows().map(
        (row) => [row.statusLabelKey, this.i18nService.t(row.statusLabelKey)] as const,
      ),
    ),
  );

  protected readonly connectionOptions = computed(() =>
    filterOptions(
      this.rows().map(
        (row) =>
          [
            row.isConnected,
            this.i18nService.t(accessConnectorConnectionLabelKey(row.isConnected)),
          ] as const,
      ),
    ),
  );

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p["organizationId"] as OrganizationId)),
    { requireSync: true },
  );

  private readonly busyRows = new RowBusyTracker<AccessConnectorId>();

  protected readonly isRowBusy = this.busyRows.isBusy;

  protected readonly rowFilter = computed(() => {
    const text = this.searchText().trim().toLowerCase();
    const status = this.statusFilterChip()?.value() as string | null | undefined;
    const connected = this.connectionFilterChip()?.value() as boolean | null | undefined;

    return (row: AccessConnectorTabRow): boolean => {
      if (text !== "" && !row.name.toLowerCase().includes(text)) {
        return false;
      }
      if (status != null && row.statusLabelKey !== status) {
        return false;
      }
      if (connected != null && row.isConnected !== connected) {
        return false;
      }
      return true;
    };
  });

  constructor() {
    effect(() => {
      void this.loadAll(this.organizationId());
    });

    effect(() => {
      this.dataSource.data = this.rows();
    });

    effect(() => {
      this.dataSource.filter = this.rowFilter();
    });
  }

  protected readonly totalRows = computed(() => this.rows().length);

  private assignTargetsBlockedKey(
    row: AccessConnectorRow,
    eligible: readonly TargetSystem[],
    targetSystemsKnown: boolean,
  ): string | null {
    if (!row.canAssign) {
      return "pamAccessConnectorAssignTargetDisabled";
    }
    if (!targetSystemsKnown) {
      return null;
    }
    if (eligible.length === 0) {
      return "pamAccessConnectorAssignNoTargetSystems";
    }
    return assignableTargetSystems(row.accessConnector.assignedTargetSystemIds, eligible).length ===
      0
      ? "pamAccessConnectorAssignNoOptions"
      : null;
  }

  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.accessConnectorsService.load(organizationId),
      this.targetSystemsService.load(organizationId),
    ]);
  }

  /** Whether the operator has asked for a retry, which decides where focus lands on a re-render. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.loadAll(this.organizationId());
  };

  /** Navigate to the access connector detail page (sibling of the shell). */
  protected readonly openDetail = (row: AccessConnectorRow): Promise<boolean> =>
    this.router.navigate(["..", "access-connectors", row.id], { relativeTo: this.route });

  /**
   * Open the access connector registration dialog and refresh the shared list on success.
   * Owned by the empty state; the shell's header button covers the non-empty list.
   */
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

  /**
   * Open the dialog that picks an active automatic target system for this connector.
   *
   * The menu item is live while the target-system read is still in flight, so a click can arrive
   * before there is a list to offer. The read settles first: opening on an empty list would state
   * an emptiness the org may not have, and a read that failed says so instead of opening at all.
   * The wait is gated on the component, so leaving the tab mid-wait opens nothing.
   */
  protected readonly openAssignDialog = (row: AccessConnectorRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const stillMounted = await firstValueFrom(
        this.targetSystemsService.loading$.pipe(
          filter((inFlight) => !inFlight),
          map(() => true),
          takeUntilDestroyed(this.destroyRef),
        ),
        { defaultValue: false },
      );
      if (!stillMounted) {
        return;
      }
      if (this.targetSystemsUnavailable()) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamAccessConnectorTargetSystemsLoadError"),
        });
        return;
      }

      const activeSystems = this.automaticSystems();
      const options = assignableTargetSystems(
        row.accessConnector.assignedTargetSystemIds,
        activeSystems,
      );

      const ref = AssignTargetDialogComponent.open(this.dialogService, {
        data: {
          accessConnector: row.accessConnector,
          options,
          noActiveAutomaticSystems: activeSystems.length === 0,
        },
      });
      const targetSystemId = await ref.closed.toPromise();
      if (!targetSystemId) {
        return;
      }
      try {
        await this.accessConnectorsService.assign(
          row.accessConnector,
          asUuid<TargetSystemId>(targetSystemId),
        );
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorAssigned"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly unassign = (
    row: AccessConnectorRow,
    targetSystemId: string,
    targetName: string,
  ): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamAccessConnectorUnassignConfirmTitle" },
        content: { key: "pamAccessConnectorUnassignConfirmContent", placeholders: [targetName] },
        acceptButtonText: { key: "remove" },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      });
      if (!confirmed) {
        return;
      }
      try {
        await this.accessConnectorsService.unassign(
          row.accessConnector,
          asUuid<TargetSystemId>(targetSystemId),
        );
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorUnassigned"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly disable = (row: AccessConnectorRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog(
        accessConnectorDeactivateConfirmOptions(row.name),
      );
      if (!confirmed) {
        return;
      }
      try {
        await this.accessConnectorsService.setEnabled(row.accessConnector, false);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorDeactivated"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly enable = (row: AccessConnectorRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      try {
        await this.accessConnectorsService.setEnabled(row.accessConnector, true);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorActivated"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly confirmDelete = (row: AccessConnectorRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog(
        accessConnectorDeleteConfirmOptions(row.name),
      );
      if (!confirmed) {
        return;
      }
      try {
        await this.accessConnectorsService.delete(row.accessConnector);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorDeleted"),
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
