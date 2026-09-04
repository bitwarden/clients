import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  IconModule,
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

import { RotationConfigId, TargetSystemMethod, TargetSystem } from "../rotation";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RowBusyTracker } from "../row-busy-tracker";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

/**
 * Managed credentials tab: lists all rotation configs for the organisation.
 *
 * Row menu actions call the service methods directly and show toasts on success,
 * or display an error toast on failure. Confirmations use DialogService.openSimpleDialog.
 * The edit page is a sibling of the shell, so navigation uses ["..", "managed-credentials", id].
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
    IconButtonModule,
    IconModule,
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
export class ManagedCredentialsTabComponent {
  protected readonly noItemsIcon = NoResults;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly configsService = inject(RotationConfigsService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = toSignal(this.configsService.loading$, { initialValue: true });
  protected readonly loadError = toSignal(this.configsService.loadError$, { initialValue: null });

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

  constructor() {
    effect(() => {
      void this.loadAll(this.organizationId());
    });

    effect(() => {
      this.dataSource.data = this.rows();
    });

    effect(() => {
      const text = this.searchText().trim().toLowerCase();
      this.dataSource.filter = (row) =>
        text === "" ||
        row.cipherName.toLowerCase().includes(text) ||
        row.targetSystemName.toLowerCase().includes(text);
    });
  }

  protected readonly processedRows = toSignal(this.dataSource.connect(), {
    initialValue: [] as RotationConfigRow[],
  });

  protected readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);
  protected readonly noResults = computed(
    () => !this.loading() && this.rows().length > 0 && this.processedRows().length === 0,
  );

  /**
   * Target systems are loaded alongside the configs so the empty state can tell whether the user
   * must set one up first (the shell-scoped instance may be empty if this tab is visited before
   * the others).
   */
  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.configsService.load(organizationId),
      this.targetSystemsService.load(organizationId),
    ]);
  }

  protected readonly retryLoad = (): Promise<void> => this.loadAll(this.organizationId());

  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", "new"], { relativeTo: this.route });

  /** Navigate to the sibling Target systems tab (shown when none exist yet). */
  protected readonly goToTargetSystems = (): Promise<boolean> =>
    this.router.navigate(["..", "target-systems"], { relativeTo: this.route });

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
        title: { key: "pamRotationConfigRecordManualTitle" },
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
