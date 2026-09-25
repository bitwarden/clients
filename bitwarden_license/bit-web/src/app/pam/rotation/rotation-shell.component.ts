import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule, ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter, map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

import { AccessConnectorRegisterDialogComponent } from "./access-connectors/access-connector-register-dialog.component";
import { AccessConnectorsService } from "./access-connectors/access-connectors.service";
import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";
import { AccessConnector, RotationConfig, TargetSystem } from "./rotation";
import { TargetSystemsService } from "./target-systems/target-systems.service";

/**
 * Rotation feature shell: renders the page header and the three routed tabs (Access connectors /
 * Target systems / Managed credentials); page-scoped services stay shared across tab
 * navigation since the shell stays mounted.
 *
 * Off the VFO1 flag the header hosts the active tab's primary create action, driven by the active
 * child route, so each tab renders only its list. On it, each tab hosts its own action in its
 * table toolbar.
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
  private readonly accessConnectors = toSignal(this.accessConnectorsService.accessConnectors$, {
    initialValue: [] as AccessConnector[],
  });
  protected readonly hasAccessConnectors = computed(() => this.accessConnectors().length > 0);

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

  /** Open the access connector registration dialog and refresh the shared list on success. */
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
}
