import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
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
  SpinnerComponent,
  StatusLockupComponent,
  SvgComponent,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { filterOptions } from "../filter-options";
import { AccessConnector, DaemonStatus, TargetSystemId, TargetSystem } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { AssignTargetDialogComponent } from "./assign-target-dialog.component";
import { DaemonRegisterDialogComponent } from "./daemon-register-dialog.component";
import { DaemonRow, DaemonsService } from "./daemons.service";

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
    FilterMenuModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    SpinnerComponent,
    StatusLockupComponent,
    SvgComponent,
    TableModule,
    I18nPipe,
  ],
})
export class DaemonsTabComponent {
  /** Exposed for template comparisons (status badge variant). */
  protected readonly DaemonStatus = DaemonStatus;

  protected readonly noItemsIcon = NoResults;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly daemonsService = inject(DaemonsService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = toSignal(this.daemonsService.loading$, { initialValue: true });
  private readonly rows = toSignal(this.daemonsService.rows$, { initialValue: [] as DaemonRow[] });
  private readonly activeAutomaticSystems = toSignal(
    this.targetSystemsService.activeAutomaticSystems$,
    { initialValue: [] as TargetSystem[] },
  );

  protected readonly dataSource = new TableDataSource<DaemonRow>();
  protected readonly searchControl = new FormControl("", { nonNullable: true });
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  /** Status/connection toolbar chips; read directly rather than via a form control. */
  private readonly statusFilterChip = viewChild("statusFilter", { read: FILTER_CONTROL });
  private readonly connectionFilterChip = viewChild("connectionFilter", { read: FILTER_CONTROL });

  protected readonly statusOptions = computed(() =>
    filterOptions(
      this.rows().map(
        (row) => [row.statusLabelKey, this.i18nService.t(row.statusLabelKey)] as const,
      ),
    ),
  );

  /**
   * Connection options carry the row's `isConnected` as their value, so "Offline" selects `false`.
   * The filter below must therefore test the chip against `null`, not for truthiness.
   */
  protected readonly connectionOptions = computed(() =>
    filterOptions(
      this.rows().map(
        (row) =>
          [
            row.isConnected,
            this.i18nService.t(
              row.isConnected ? "pamAccessConnectorConnected" : "pamAccessConnectorOffline",
            ),
          ] as const,
      ),
    ),
  );

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p["organizationId"] as OrganizationId)),
    { requireSync: true },
  );

  constructor() {
    effect(() => {
      const organizationId = this.organizationId();
      void this.daemonsService.load(organizationId);
      // The assignment badges and the assign-dialog options join against the
      // target-systems map — load it too, in case this tab is visited first
      // (the shell-scoped TargetSystemsService instance starts empty).
      void this.targetSystemsService.load(organizationId);
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

  /** Navigate to the access-connector detail page (sibling of the shell). */
  protected readonly openDetail = (row: DaemonRow): Promise<boolean> =>
    this.router.navigate(["..", "access-connectors", row.id], { relativeTo: this.route });

  /**
   * Open the access-connector registration dialog and refresh the shared list on success.
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

  protected readonly openAssignDialog = async (row: DaemonRow): Promise<void> => {
    const assigned = new Set(row.daemon.assignedTargetSystemIds);
    const options = this.activeAutomaticSystems().filter((s) => !assigned.has(s.id));

    const ref = AssignTargetDialogComponent.open(this.dialogService, {
      data: { daemon: row.daemon, options },
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
  };

  protected readonly unassign = async (
    daemon: AccessConnector,
    targetSystemId: string,
    targetName: string,
  ): Promise<void> => {
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
      await this.daemonsService.unassign(daemon, asUuid<TargetSystemId>(targetSystemId));
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessConnectorUnassigned"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly disable = async (row: DaemonRow): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamAccessConnectorDisableConfirmTitle" },
      content: { key: "pamAccessConnectorDisableConfirmContent", placeholders: [row.name] },
      acceptButtonText: { key: "pamAccessConnectorDisable" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.daemonsService.setEnabled(row.daemon, false);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessConnectorDisabled"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly enable = async (row: DaemonRow): Promise<void> => {
    try {
      await this.daemonsService.setEnabled(row.daemon, true);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessConnectorEnabled"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly confirmDelete = async (row: DaemonRow): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamAccessConnectorDeleteConfirmTitle" },
      content: { key: "pamAccessConnectorDeleteConfirmContent", placeholders: [row.name] },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });
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
  };

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}
