import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  DialogService,
  IconButtonModule,
  IconModule,
  MenuModule,
  SearchModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { TargetSystemKind, TargetSystemMethod, TargetSystemStatus, TargetSystemView } from "../rotation";

import {
  TargetSystemsEmptyStateComponent,
  TargetSystemTemplateKey,
} from "./target-systems-empty-state.component";
import { TargetSystemsService } from "./target-systems.service";

/** A flattened, presentation-ready view of a {@link TargetSystemView}. */
export type TargetSystemRow = {
  id: string;
  system: TargetSystemView;
  name: string;
  methodLabel: string;
  kindLabel: string | null;
  statusLabel: string;
  active: boolean;
};

/**
 * Tab component for the target-systems list in the PAM Rotation shell.
 *
 * Shows a searchable table of all target systems, with row menus for Edit, Enable, and Disable.
 * Row edit navigates to the sibling routed page (outside the shell, which has no tab bar); the
 * "New target system" create action lives in the shell header.
 */
@Component({
  templateUrl: "./target-systems-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BadgeModule,
    IconButtonModule,
    IconModule,
    MenuModule,
    SearchModule,
    TableModule,
    TargetSystemsEmptyStateComponent,
    I18nPipe,
  ],
})
export class TargetSystemsTabComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  protected readonly loading = toSignal(this.targetSystemsService.loading$, { initialValue: true });
  private readonly systems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [] as TargetSystemView[],
  });

  protected readonly dataSource = new TableDataSource<TargetSystemRow>();
  protected readonly searchControl = new FormControl("", { nonNullable: true });

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  /** Expose const objects for template comparisons. */
  protected readonly TargetSystemStatus = TargetSystemStatus;
  protected readonly TargetSystemMethod = TargetSystemMethod;

  constructor() {
    effect(() => {
      void this.targetSystemsService.load(this.organizationId());
    });

    effect(() => {
      this.dataSource.data = this.buildRows(this.systems());
    });

    effect(() => {
      const text = this.searchText().trim().toLowerCase();
      this.dataSource.filter = (row) =>
        text === "" ||
        row.name.toLowerCase().includes(text) ||
        (row.kindLabel?.toLowerCase().includes(text) ?? false);
    });
  }

  /** Navigate to the create page (sibling of the shell), shown from the empty state. */
  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", "new"], { relativeTo: this.route });

  /** Navigate to the create page seeded from a starter template. */
  protected readonly openFromTemplate = (key: TargetSystemTemplateKey): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", "new"], {
      relativeTo: this.route,
      queryParams: { template: key },
    });

  /** Navigate to the edit page for a target system. */
  protected readonly openEdit = (system: TargetSystemView): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", system.id], { relativeTo: this.route });

  /** Disable a target system after confirming with the operator. */
  protected readonly disable = async (system: TargetSystemView): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamTargetSystemDisableTitle" },
      content: { key: "pamTargetSystemDisableContent" },
      acceptButtonText: { key: "pamTargetSystemDisableConfirm" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.targetSystemsService.setEnabled(system, false);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemDisableSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /** Re-enable a disabled target system. */
  protected readonly enable = async (system: TargetSystemView): Promise<void> => {
    try {
      await this.targetSystemsService.setEnabled(system, true);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemEnableSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  private buildRows(systems: TargetSystemView[]): TargetSystemRow[] {
    return systems.map((system) => ({
      id: system.id,
      system,
      name: system.name,
      methodLabel: this.methodLabel(system.method),
      kindLabel: system.kind != null ? this.kindLabel(system.kind) : null,
      statusLabel: this.i18nService.t(
        system.status === TargetSystemStatus.Active
          ? "pamTargetSystemStatusActive"
          : "pamTargetSystemStatusDisabled",
      ),
      active: system.status === TargetSystemStatus.Active,
    }));
  }

  private methodLabel(method: TargetSystemMethod): string {
    return this.i18nService.t(
      method === TargetSystemMethod.Automatic
        ? "pamTargetSystemMethodAutomatic"
        : "pamTargetSystemMethodManual",
    );
  }

  private kindLabel(kind: TargetSystemKind): string {
    switch (kind) {
      case TargetSystemKind.Entra:
        return this.i18nService.t("pamTargetSystemKindEntra");
      case TargetSystemKind.Mssql:
        return this.i18nService.t("pamTargetSystemKindMssql");
      case TargetSystemKind.CustomScript:
        return this.i18nService.t("pamTargetSystemKindCustomScript");
      default:
        return "";
    }
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}
