import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
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
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessConnectorId, DaemonStatus, TargetSystemId, TargetSystem } from "../rotation";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RowBusyTracker } from "../row-busy-tracker";
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
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    SpinnerComponent,
    StatusLockupComponent,
    SvgComponent,
    TableModule,
    TooltipDirective,
    RotationLoadErrorComponent,
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
  protected readonly loadError = toSignal(this.daemonsService.loadError$, { initialValue: null });
  private readonly rows = toSignal(this.daemonsService.rows$, { initialValue: [] as DaemonRow[] });
  private readonly activeAutomaticSystems = toSignal(
    this.targetSystemsService.activeAutomaticSystems$,
    { initialValue: [] as TargetSystem[] },
  );
  private readonly targetSystemsLoadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null as unknown | null,
  });

  protected readonly dataSource = new TableDataSource<DaemonRow>();
  protected readonly searchControl = new FormControl("", { nonNullable: true });
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

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
      this.dataSource.filter = (row) => !text || row.name.toLowerCase().includes(text);
    });
  }

  protected readonly totalRows = computed(() => this.rows().length);

  /**
   * The assignment badges and the assign-dialog options join against the target-systems map, so
   * this tab loads it alongside its own list, in case it is visited first (the shell-scoped
   * TargetSystemsService instance starts empty).
   */
  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.daemonsService.load(organizationId),
      this.targetSystemsService.load(organizationId),
    ]);
  }

  protected readonly retryLoad = (): Promise<void> => this.loadAll(this.organizationId());

  /** Navigate to the daemon detail page (sibling of the shell). */
  protected readonly openDetail = (row: DaemonRow): Promise<boolean> =>
    this.router.navigate(["..", "daemons", row.id], { relativeTo: this.route });

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
        message: this.i18nService.t("pamDaemonRegistered"),
      });
    }
  };

  /**
   * A failed target-systems load leaves the shared list empty, which is indistinguishable from an
   * org that genuinely has none — so the failure is surfaced rather than letting the dialog assert
   * the org has no active automatic target system.
   */
  protected readonly openAssignDialog = (row: DaemonRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const targetSystemsError = this.targetSystemsLoadError();
      if (targetSystemsError) {
        this.showError(targetSystemsError);
        return;
      }

      const activeSystems = this.activeAutomaticSystems();
      const assigned = new Set(row.daemon.assignedTargetSystemIds);
      const options = activeSystems.filter((s) => !assigned.has(s.id));

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
          message: this.i18nService.t("pamDaemonAssigned"),
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
        title: { key: "pamDaemonUnassignConfirmTitle" },
        content: { key: "pamDaemonUnassignConfirmContent", placeholders: [targetName] },
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
          message: this.i18nService.t("pamDaemonUnassigned"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly disable = (row: DaemonRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamDaemonDisableConfirmTitle" },
        content: { key: "pamDaemonDisableConfirmContent", placeholders: [row.name] },
        acceptButtonText: { key: "pamDaemonDisable" },
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
          message: this.i18nService.t("pamDaemonDisabled"),
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
          message: this.i18nService.t("pamDaemonEnabled"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly confirmDelete = (row: DaemonRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamDaemonDeleteConfirmTitle" },
        content: { key: "pamDaemonDeleteConfirmContent", placeholders: [row.name] },
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
          message: this.i18nService.t("pamDaemonDeleted"),
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
