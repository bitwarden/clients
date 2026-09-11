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
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
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
import { AssignTargetDialogComponent } from "./assign-target-dialog.component";
import { DaemonRegisterDialogComponent } from "./daemon-register-dialog.component";
import { DaemonRow, DaemonsService } from "./daemons.service";

/**
 * A {@link DaemonRow} with the row menu's own state added.
 */
export type DaemonTabRow = DaemonRow & {
  /**
   * Why no target system can be assigned to this connector right now, as the i18n key the menu
   * item's tooltip states, or null when one can.
   */
  readonly assignTargetsBlockedKey: string | null;
};

@Component({
  selector: "app-daemons-tab",
  templateUrl: "./daemons-tab.component.html",
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
    TooltipDirective,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    I18nPipe,
  ],
})
export class DaemonsTabComponent {
  protected readonly noItemsIcon = NoResults;

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly daemonsService = inject(DaemonsService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = toSignal(this.daemonsService.loading$, { initialValue: true });
  protected readonly loadError = toSignal(this.daemonsService.loadError$, { initialValue: null });

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  /**
   * Whether the loading branch is on screen.
   */
  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly serviceRows = toSignal(this.daemonsService.rows$, {
    initialValue: [] as DaemonRow[],
  });
  private readonly activeAutomaticSystems = toSignal(
    this.targetSystemsService.activeAutomaticSystems$,
    { initialValue: [] as TargetSystem[] },
  );
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

  private readonly rows = computed<DaemonTabRow[]>(() => {
    const eligible = this.activeAutomaticSystems();
    const known = this.targetSystemsKnown();
    return this.serviceRows().map((row) => ({
      ...row,
      assignTargetsBlockedKey: this.assignTargetsBlockedKey(row, eligible, known),
    }));
  });

  protected readonly dataSource = new TableDataSource<DaemonTabRow>();
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
      const connected = this.connectionFilterChip()?.value() as boolean | null | undefined;

      this.dataSource.filter = (row) => {
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
  }

  protected readonly totalRows = computed(() => this.rows().length);

  private assignTargetsBlockedKey(
    row: DaemonRow,
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
    return assignableTargetSystems(row.daemon.assignedTargetSystemIds, eligible).length === 0
      ? "pamAccessConnectorAssignNoOptions"
      : null;
  }

  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.daemonsService.load(organizationId),
      this.targetSystemsService.load(organizationId),
    ]);
  }

  /** Whether the operator has asked for a retry, which decides where focus lands on a re-render. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.loadAll(this.organizationId());
  };

  /** Navigate to the daemon detail page (sibling of the shell). */
  protected readonly openDetail = (row: DaemonRow): Promise<boolean> =>
    this.router.navigate(["..", "access-connectors", row.id], { relativeTo: this.route });

  /**
   * Open the daemon registration dialog and refresh the shared list on success.
   * Owned by the empty state; the shell's header button covers the non-empty list.
   */
  protected readonly registerDaemon = async (): Promise<void> => {
    const orgId = this.organizationId();
    const ref = DaemonRegisterDialogComponent.open(this.dialogService, {
      data: { organizationId: orgId },
    });
    const result = await ref.closed.toPromise();
    if (result) {
      await this.daemonsService.registerCompleted(orgId);
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
  protected readonly openAssignDialog = (row: DaemonRow): Promise<void> =>
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

      const activeSystems = this.activeAutomaticSystems();
      const options = assignableTargetSystems(row.daemon.assignedTargetSystemIds, activeSystems);

      const ref = AssignTargetDialogComponent.open(this.dialogService, {
        data: { daemon: row.daemon, options, noActiveAutomaticSystems: activeSystems.length === 0 },
      });
      const targetSystemId = await ref.closed.toPromise();
      if (!targetSystemId) {
        return;
      }
      try {
        await this.daemonsService.assign(row.daemon, asUuid<TargetSystemId>(targetSystemId));
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorAssigned"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly unassign = (
    row: DaemonRow,
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
        await this.daemonsService.unassign(row.daemon, asUuid<TargetSystemId>(targetSystemId));
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorUnassigned"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly disable = (row: DaemonRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog(
        accessConnectorDeactivateConfirmOptions(row.name),
      );
      if (!confirmed) {
        return;
      }
      try {
        await this.daemonsService.setEnabled(row.daemon, false);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorDeactivated"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly enable = (row: DaemonRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      try {
        await this.daemonsService.setEnabled(row.daemon, true);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorActivated"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly confirmDelete = (row: DaemonRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog(
        accessConnectorDeleteConfirmOptions(row.name),
      );
      if (!confirmed) {
        return;
      }
      try {
        await this.daemonsService.delete(row.daemon);
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
