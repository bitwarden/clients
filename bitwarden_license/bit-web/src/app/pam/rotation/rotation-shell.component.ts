import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule, ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  TabsModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { DaemonRegisterDialogComponent } from "./daemons/daemon-register-dialog.component";
import { DaemonsService } from "./daemons/daemons.service";
import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";
import { AccessConnector, RotationConfig, TargetSystem } from "./rotation";
import { TargetSystemsService } from "./target-systems/target-systems.service";

/**
 * Rotation feature shell: renders the page header and the three routed tabs (Managed
 * credentials / Target systems / Access connectors); page-scoped services stay shared across tab
 * navigation since the shell stays mounted.
 *
 * The header hosts the active tab's primary create action, driven by the active child route, so
 * each tab renders only its list.
 *
 * The Managed credentials tab label shows a warning berry when configs await a manual rotation
 * confirmation.
 */
@Component({
  selector: "app-rotation-shell",
  templateUrl: "./rotation-shell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, I18nPipe, HeaderModule, TabsModule, ButtonModule, AsyncActionsModule],
})
export class RotationShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly configsService = inject(RotationConfigsService);
  private readonly daemonsService = inject(DaemonsService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  /** organizationId from the route params (inherited via paramsInheritanceStrategy "always"). */
  protected readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  /** The path of the active child route ("target-systems" / "access-connectors" / ...), driving the header button. */
  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? null),
    ),
    { initialValue: this.route.snapshot.firstChild?.routeConfig?.path ?? null },
  );

  /** Whether any target systems exist; hides the "New target system" header button, since the empty state owns that action. */
  private readonly targetSystems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [] as TargetSystem[],
  });
  protected readonly hasTargetSystems = computed(() => this.targetSystems().length > 0);

  /** Number of configs awaiting a manual rotation confirmation — drives the tab berry. */
  protected readonly awaitingManualCount = toSignal(this.configsService.awaitingManualCount$, {
    initialValue: 0,
  });

  /** Whether any managed credentials exist; hides the "New managed credential" header button, since the empty state owns that action. */
  private readonly configs = toSignal(this.configsService.configs$, {
    initialValue: [] as RotationConfig[],
  });
  protected readonly hasConfigs = computed(() => this.configs().length > 0);

  /** Whether any access connectors exist; hides the "New access connector" header button, since the empty state owns that action. */
  private readonly daemons = toSignal(this.daemonsService.daemons$, {
    initialValue: [] as AccessConnector[],
  });
  protected readonly hasDaemons = computed(() => this.daemons().length > 0);

  constructor() {
    // Loads on org change, and again on remount when the user navigates back from a form page.
    effect(() => {
      void this.configsService.load(this.organizationId());
    });
  }

  /** Navigate to the managed-credential create page (sibling of the shell). */
  protected readonly createManagedCredential = (): Promise<boolean> =>
    this.router.navigate(["managed-credentials", "new"], { relativeTo: this.route });

  /** Navigate to the target-system create page (sibling of the shell). */
  protected readonly createTargetSystem = (): Promise<boolean> =>
    this.router.navigate(["target-systems", "new"], { relativeTo: this.route });

  /** Open the access-connector registration dialog and refresh the shared list on success. */
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
}
