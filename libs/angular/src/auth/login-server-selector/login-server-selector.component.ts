import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { AvailableRegionsService } from "@bitwarden/common/platform/abstractions/available-regions.service";
import {
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogService,
  IconModule,
  LinkModule,
  MenuModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SelfHostedEnvConfigDialogComponent } from "../self-hosted-env-config-dialog";

/**
 * Prototype: inline server selector shown directly below the email field on the login screen.
 *
 * Reads and changes the environment through the same services as the shared
 * `environment-selector` (browser/desktop) but renders as "Logging in on: <domain> ⌄".
 */
@Component({
  selector: "auth-login-server-selector",
  templateUrl: "./login-server-selector.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, IconModule, LinkModule, MenuModule],
  host: {
    class: "tw-block",
  },
})
export class LoginServerSelectorComponent {
  private readonly environmentService = inject(EnvironmentService);
  private readonly availableRegionsService = inject(AvailableRegionsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly availableRegions = toSignal(this.availableRegionsService.availableRegions$, {
    initialValue: [] as RegionConfig[],
  });

  /** `undefined` means the current environment is self-hosted. */
  protected readonly selectedRegion = toSignal(
    this.environmentService.globalEnvironment$.pipe(
      map((env) =>
        this.environmentService.availableRegions().find((region) => region.key === env.getRegion()),
      ),
    ),
  );

  protected async selectRegion(region: Region): Promise<void> {
    await this.environmentService.setEnvironment(region);
  }

  protected async selectSelfHosted(): Promise<void> {
    const saved = await SelfHostedEnvConfigDialogComponent.open(this.dialogService);
    if (saved) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("environmentSaved"),
      });
    }
  }
}
