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

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
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
  TableDataSource,
  TableModule,
  ToastService,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { assignableConnectors, eligibleConnectors } from "../assignable";
import { TARGET_SYSTEM_QUERY_PARAM } from "../create-flow";
import { DaemonsService } from "../daemons/daemons.service";
import { filterOptions } from "../filter-options";
import {
  AccessConnector,
  AccessConnectorId,
  TargetSystemId,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystem,
} from "../rotation";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RowBusyTracker } from "../row-busy-tracker";
import { showSkeletonWhile } from "../skeleton-delay";

import { AssignConnectorDialogComponent } from "./assign-connector-dialog.component";
import { targetSystemKindLabelKey, targetSystemMethodLabelKey } from "./target-system-label";
import {
  TargetSystemsEmptyStateComponent,
  TargetSystemTemplateKey,
} from "./target-systems-empty-state.component";
import { TargetSystemsService } from "./target-systems.service";

/** A flattened, presentation-ready view of a {@link TargetSystem}. */
export type TargetSystemRow = {
  id: TargetSystemId;
  system: TargetSystem;
  name: string;
  /**
   * The i18n key naming how this target rotates, or null for a method this version cannot model.
   *
   * The Method chip keys its options on this rather than on `system.method`, so a value with no
   * label of its own cannot arrive in the menu wearing another method's label.
   */
  methodLabelKey: string | null;
  /** {@link methodLabelKey} rendered, or null when there is no method to name. */
  methodLabel: string | null;
  kindLabel: string | null;
  /** Status is stated as two states, so an unmodellable one reads as inactive rather than as its own option. */
  statusLabelKey: "pamTargetSystemStatusActive" | "pamTargetSystemStatusInactive";
  statusLabel: string;
  active: boolean;
  /** Only an automatic-method target can claim a connector assignment. */
  canAssignConnectors: boolean;
  /** Only an active target can take a new managed credential. */
  canAddManagedCredential: boolean;
  /**
   * Why no access connector can be assigned to this target right now, as the i18n key the menu
   * item's tooltip states, or null when one can.
   */
  assignConnectorsBlockedKey: string | null;
};

/**
 * Tab component for the target-systems list in the PAM Rotation shell.
 *
 * Shows a searchable table of all target systems, with row menus for Edit, Enable, Disable, and
 * Delete.
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
    FilterMenuModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
    TableModule,
    TooltipDirective,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    TargetSystemsEmptyStateComponent,
    I18nPipe,
  ],
})
export class TargetSystemsTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly daemonsService = inject(DaemonsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  protected readonly loading = toSignal(this.targetSystemsService.loading$, { initialValue: true });
  protected readonly loadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null,
  });

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  /** Whether the loading branch is on screen. */
  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly systems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [] as TargetSystem[],
  });
  private readonly daemons = toSignal(this.daemonsService.daemons$, {
    initialValue: [] as AccessConnector[],
  });
  private readonly daemonsLoading = toSignal(this.daemonsService.loading$, { initialValue: true });
  private readonly daemonsLoadError = toSignal(this.daemonsService.loadError$, {
    initialValue: null,
  });

  /** Whether the connector list has actually been read. */
  private readonly connectorsKnown = computed(
    () => !this.daemonsLoading() && this.daemonsLoadError() == null,
  );

  /**
   * Whether the connector read failed outright, which is a different answer from not having
   * finished.
   */
  private readonly connectorsUnavailable = computed(
    () => !this.daemonsLoading() && this.daemonsLoadError() != null,
  );

  /** The table's rows, and the set the toolbar chips derive their options from. */
  private readonly rows = computed(() => this.buildRows(this.systems(), this.daemons()));

  protected readonly dataSource = new TableDataSource<TargetSystemRow>();
  protected readonly searchControl = new FormControl("", { nonNullable: true });

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  /** Method/kind/status toolbar chips. */
  private readonly methodFilterChip = viewChild("methodFilter", { read: FILTER_CONTROL });
  private readonly kindFilterChip = viewChild("kindFilter", { read: FILTER_CONTROL });
  private readonly statusFilterChip = viewChild("statusFilter", { read: FILTER_CONTROL });

  /** A method this version cannot name contributes no option, so this chip can be empty. */
  protected readonly methodOptions = computed(() =>
    filterOptions(
      this.rows().flatMap((row) =>
        row.methodLabelKey != null && row.methodLabel != null
          ? [[row.methodLabelKey, row.methodLabel] as const]
          : [],
      ),
    ),
  );

  protected readonly kindOptions = computed(() =>
    filterOptions(
      this.rows().flatMap((row) =>
        row.system.kind != null && row.kindLabel != null
          ? [[row.system.kind, row.kindLabel] as const]
          : [],
      ),
    ),
  );

  protected readonly statusOptions = computed(() =>
    filterOptions(this.rows().map((row) => [row.statusLabelKey, row.statusLabel] as const)),
  );

  private readonly busyRows = new RowBusyTracker<TargetSystemId>();

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
      const method = this.methodFilterChip()?.value() as string | null | undefined;
      const kind = this.kindFilterChip()?.value() as TargetSystemKind | null | undefined;
      const status = this.statusFilterChip()?.value() as string | null | undefined;

      this.dataSource.filter = (row) => {
        if (
          text !== "" &&
          !row.name.toLowerCase().includes(text) &&
          !(row.kindLabel?.toLowerCase().includes(text) ?? false)
        ) {
          return false;
        }
        if (method != null && row.methodLabelKey !== method) {
          return false;
        }
        if (kind != null && row.system.kind !== kind) {
          return false;
        }
        if (status != null && row.statusLabelKey !== status) {
          return false;
        }
        return true;
      };
    });
  }

  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.targetSystemsService.load(organizationId),
      this.daemonsService.load(organizationId),
    ]);
  }

  /** Whether the operator has asked for a retry. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.loadAll(this.organizationId());
  };

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
  protected readonly openEdit = (system: TargetSystem): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", system.id], { relativeTo: this.route });

  /** Navigate to the managed-credential create page with this target already chosen. */
  protected readonly openCreateManagedCredential = (system: TargetSystem): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", "new"], {
      relativeTo: this.route,
      queryParams: { [TARGET_SYSTEM_QUERY_PARAM]: system.id },
    });

  /**
   * Open the mirror of the access-connectors tab's "Assign targets" dialog: pick an enabled
   * connector for this target instead of picking a target for a fixed connector.
   *
   * The menu item is live while the connector read is still in flight, so a click can arrive
   * before there is a list to offer. The read settles first: opening on an empty list would leave
   * the dialog stating an emptiness the org may not have, and a read that failed says so instead
   * of opening at all. Which emptiness it is once the read has landed is `noneEligible`, taken
   * from the same active-connector set the options come from. The wait is gated on the component,
   * so leaving the tab mid-wait opens nothing over whichever tab the admin landed on. The row is
   * busy throughout, which is what its own {@link isRowBusy} binding reflects and what keeps a
   * delete from racing the assignment's optimistic patch.
   */
  protected readonly openAssignConnectorDialog = (system: TargetSystem): Promise<void> =>
    this.busyRows.run(system.id, async () => {
      const stillMounted = await firstValueFrom(
        this.daemonsService.loading$.pipe(
          filter((inFlight) => !inFlight),
          map(() => true),
          takeUntilDestroyed(this.destroyRef),
        ),
        { defaultValue: false },
      );
      if (!stillMounted) {
        return;
      }
      if (this.connectorsUnavailable()) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamTargetSystemConnectorAssignmentsLoadError"),
        });
        return;
      }

      const connectors = this.daemons();
      const options = assignableConnectors(system.id, connectors);
      const noneEligible = eligibleConnectors(connectors).length === 0;

      const ref = AssignConnectorDialogComponent.open(this.dialogService, {
        data: { targetSystem: system, options, noneEligible },
      });
      const selectedId = await ref.closed.toPromise();
      if (!selectedId) {
        return;
      }
      const accessConnectorId = asUuid<AccessConnectorId>(selectedId);
      const daemon = this.daemons().find((d) => d.id === accessConnectorId);
      if (!daemon) {
        return;
      }
      try {
        await this.daemonsService.assign(daemon, system.id);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamTargetSystemAssignConnectorSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  /** Disable a target system after confirming with the operator. */
  protected readonly disable = (system: TargetSystem): Promise<void> =>
    this.busyRows.run(system.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamTargetSystemDeactivateTitle" },
        content: { key: "pamTargetSystemDeactivateContent" },
        acceptButtonText: { key: "pamTargetSystemDeactivateConfirm" },
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
          message: this.i18nService.t("pamTargetSystemDeactivateSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  /** Re-enable a disabled target system. */
  protected readonly enable = (system: TargetSystem): Promise<void> =>
    this.busyRows.run(system.id, async () => {
      try {
        await this.targetSystemsService.setEnabled(system, true);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamTargetSystemActivateSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  /**
   * Permanently delete a target system after confirming with the operator.
   *
   * The server, not this component, decides whether the delete is allowed: it refuses while
   * any rotation config still names the target, surfaced as an ordinary error for
   * {@link showError}. Offering the action unconditionally keeps one authority on the rule.
   */
  protected readonly confirmDelete = (system: TargetSystem): Promise<void> =>
    this.busyRows.run(system.id, async () => {
      const dropsAssignments =
        this.connectorsKnown() &&
        this.daemons().some((connector) => connector.assignedTargetSystemIds.includes(system.id));
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamTargetSystemDeleteTitle" },
        content: {
          key: dropsAssignments
            ? "pamTargetSystemDeleteAssignedConnectorsContent"
            : "pamTargetSystemDeleteContentDeactivateInstead",
          placeholders: [system.name],
        },
        acceptButtonText: { key: "delete" },
        cancelButtonText: { key: "cancel" },
        type: "danger",
      });
      if (!confirmed) {
        return;
      }
      try {
        await this.targetSystemsService.delete(system);
        // The server drops the connector assignments with the target; mirror that locally so the
        // daemons tab does not keep projecting the dangling ID.
        this.daemonsService.forgetTargetSystem(system.id);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamTargetSystemDeleteSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  private buildRows(systems: TargetSystem[], connectors: AccessConnector[]): TargetSystemRow[] {
    const connectorsKnown = this.connectorsKnown();
    const connectorsUnavailable = this.connectorsUnavailable();
    const hasAnyConnector = eligibleConnectors(connectors).length > 0;
    return systems.map((system) => {
      const methodLabelKey = targetSystemMethodLabelKey(system.method);
      const active = system.status === TargetSystemStatus.Active;
      const statusLabelKey = active
        ? ("pamTargetSystemStatusActive" as const)
        : ("pamTargetSystemStatusInactive" as const);
      return {
        id: system.id,
        system,
        name: system.name,
        methodLabelKey,
        methodLabel: methodLabelKey == null ? null : this.i18nService.t(methodLabelKey),
        kindLabel: system.kind != null ? this.kindLabel(system.kind) : null,
        statusLabelKey,
        statusLabel: this.i18nService.t(statusLabelKey),
        active,
        canAssignConnectors: system.method === TargetSystemMethod.Automatic,
        canAddManagedCredential: system.status === TargetSystemStatus.Active,
        assignConnectorsBlockedKey: connectorsUnavailable
          ? "pamTargetSystemConnectorAssignmentsLoadError"
          : !connectorsKnown || assignableConnectors(system.id, connectors).length > 0
            ? null
            : hasAnyConnector
              ? "pamTargetSystemAssignConnectorNoOptions"
              : "pamTargetSystemAssignConnectorNone",
      };
    });
  }

  /** Null for a kind a newer server named that this SDK version cannot model. */
  private kindLabel(kind: TargetSystemKind): string | null {
    const key = targetSystemKindLabelKey(kind);
    return key == null ? null : this.i18nService.t(key);
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}
