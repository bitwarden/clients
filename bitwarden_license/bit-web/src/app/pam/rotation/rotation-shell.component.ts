import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
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

/**
 * Rotation feature shell: renders the page header and the three routed tabs
 * (Managed credentials / Target systems / Daemons). The shell stays mounted
 * across tab navigation; the page-scoped services (provided at the shell route)
 * are shared by all tabs.
 *
 * The header hosts the primary create action for the active tab — "New target
 * system" and "New daemon" — so each tab renders only its list, not a second
 * header. Which button shows is driven by the active child route.
 *
 * The Managed credentials tab label shows a warning berry when there are
 * configs awaiting a manual rotation confirmation.
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
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  /** organizationId from the route params (inherited via paramsInheritanceStrategy "always"). */
  protected readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  /** The path of the active child route ("target-systems" / "daemons" / ...), driving the header button. */
  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? null),
    ),
    { initialValue: this.route.snapshot.firstChild?.routeConfig?.path ?? null },
  );

  /** Number of configs awaiting a manual rotation confirmation — drives the tab berry. */
  protected readonly awaitingManualCount = toSignal(this.configsService.awaitingManualCount$, {
    initialValue: 0,
  });

  constructor() {
    // Load the configs service whenever the org changes. The effect also re-runs
    // when the user navigates back from a form page (component remounts).
    effect(() => {
      void this.configsService.load(this.organizationId());
    });
  }

  /** Navigate to the target-system create page (sibling of the shell). */
  protected readonly createTargetSystem = (): Promise<boolean> =>
    this.router.navigate(["target-systems", "new"], { relativeTo: this.route });

  /** Open the daemon registration dialog and refresh the shared list on success. */
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
}
