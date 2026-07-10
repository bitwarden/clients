import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { DaemonStatus, RotationDaemonResponse, TargetSystemResponse } from "@bitwarden/bit-pam";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  DialogService,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  SearchModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { TargetSystemsService } from "../target-systems/target-systems.service";

import { AssignTargetDialogComponent } from "./assign-target-dialog.component";
import { DaemonRow, DaemonsService } from "./daemons.service";

@Component({
  selector: "app-daemons-tab",
  templateUrl: "./daemons-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BadgeModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    TableModule,
    I18nPipe,
  ],
})
export class DaemonsTabComponent {
  /** Exposed for template comparisons (status badge variant). */
  protected readonly DaemonStatus = DaemonStatus;

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
    { initialValue: [] as TargetSystemResponse[] },
  );

  protected readonly dataSource = new TableDataSource<DaemonRow>();
  protected readonly searchControl = new FormControl("", { nonNullable: true });
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

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
      this.dataSource.filter = (row) => !text || row.name.toLowerCase().includes(text);
    });
  }

  protected readonly totalRows = computed(() => this.rows().length);

  /** Navigate to the daemon detail page (sibling of the shell). */
  protected readonly openDetail = (row: DaemonRow): Promise<boolean> =>
    this.router.navigate(["..", "daemons", row.id], { relativeTo: this.route });

  protected readonly openAssignDialog = async (row: DaemonRow): Promise<void> => {
    const assigned = new Set(row.daemon.assignments);
    const options = this.activeAutomaticSystems().filter((s) => !assigned.has(s.id));

    const ref = AssignTargetDialogComponent.open(this.dialogService, {
      data: { daemon: row.daemon, options },
    });
    const targetSystemId = await ref.closed.toPromise();
    if (!targetSystemId) {
      return;
    }
    try {
      await this.daemonsService.assign(row.daemon, targetSystemId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("pamDaemonAssigned"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly unassign = async (
    daemon: RotationDaemonResponse,
    targetSystemId: string,
    targetName: string,
  ): Promise<void> => {
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
      await this.daemonsService.unassign(daemon, targetSystemId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("pamDaemonUnassigned"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly revoke = async (row: DaemonRow): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamDaemonRevokeConfirmTitle" },
      content: { key: "pamDaemonRevokeConfirmContent", placeholders: [row.name] },
      acceptButtonText: { key: "pamDaemonRevokeConfirmAccept" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.daemonsService.revoke(row.daemon);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("pamDaemonRevoked"),
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
    this.toastService.showToast({ variant: "error", title: null, message });
  }
}
