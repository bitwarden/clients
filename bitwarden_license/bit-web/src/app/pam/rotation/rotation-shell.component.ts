import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconModule,
  MenuModule,
  TabsModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AccessConnectorRegisterDialogComponent } from "./access-connectors/access-connector-register-dialog.component";
import { AccessConnectorsService } from "./access-connectors/access-connectors.service";
import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";

/** Header and routed tabs for the rotation feature. The header hosts one Add menu for every tab. */
@Component({
  selector: "app-rotation-shell",
  templateUrl: "./rotation-shell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    I18nPipe,
    HeaderModule,
    TabsModule,
    ButtonModule,
    AsyncActionsModule,
    IconModule,
    MenuModule,
  ],
})
export class RotationShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly configsService = inject(RotationConfigsService);
  private readonly accessConnectorsService = inject(AccessConnectorsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  /** Inherited from the org route, since `paramsInheritanceStrategy` is `"always"`. */
  protected readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  /** Configs awaiting a manual rotation confirmation, for the tab berry. */
  protected readonly awaitingManualCount = toSignal(this.configsService.awaitingManualCount$, {
    initialValue: 0,
  });

  constructor() {
    // Loads on org change, and again on remount when the user navigates back from a form page.
    effect(() => {
      void this.configsService.load(this.organizationId());
    });
  }

  protected readonly createManagedCredential = (): Promise<boolean> =>
    this.router.navigate(["managed-credentials", "new"], { relativeTo: this.route });

  protected readonly createTargetSystem = (): Promise<boolean> =>
    this.router.navigate(["target-systems", "new"], { relativeTo: this.route });

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
