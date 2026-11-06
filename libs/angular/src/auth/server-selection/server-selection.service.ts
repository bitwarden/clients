import { inject, Injectable } from "@angular/core";
import { map, Observable, shareReplay } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { AvailableRegionsService } from "@bitwarden/common/platform/abstractions/available-regions.service";
import {
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { SelfHostedEnvConfigDialogComponent } from "../self-hosted-env-config-dialog";

/** A cloud region, or self-hosted when the environment matches no cloud region. */
export type SelectedServer = RegionConfig | typeof Region.SelfHosted;

/**
 * Reads and changes the server for auth forms that show it inline in a field hint, e.g. "Logging in
 * on: bitwarden.com ⌄" under the email field.
 *
 * Provide it on the component that shows the server (`providers: [safeProvider(ServerSelectionService)]`)
 * so its dependencies, such as `DialogService`, resolve from that component's injector.
 */
@Injectable()
export class ServerSelectionService {
  private readonly environmentService = inject(EnvironmentService);
  private readonly availableRegionsService = inject(AvailableRegionsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  private readonly clientType = this.platformUtilsService.getClientType();

  /** The current server. Emits on subscribe and whenever the environment changes. */
  readonly selectedServer$: Observable<SelectedServer> =
    this.environmentService.globalEnvironment$.pipe(
      map(
        (env): SelectedServer =>
          this.environmentService
            .availableRegions()
            .find((region) => region.key === env.getRegion()) ?? Region.SelfHosted,
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  /** The cloud regions that can be chosen. */
  readonly availableRegions$: Observable<RegionConfig[]> =
    this.availableRegionsService.availableRegions$;

  /** Self-hosted environments can only be configured from desktop and the browser extension. */
  readonly selfHostedAvailable =
    this.clientType === ClientType.Desktop || this.clientType === ClientType.Browser;

  /** A self-hosted web vault is tied to its own server, so the server can't be shown or changed. */
  readonly hidden = this.clientType === ClientType.Web && this.platformUtilsService.isSelfHost();

  async selectRegion(region: RegionConfig): Promise<void> {
    await this.environmentService.setEnvironment(region.key);
  }

  /** Opens the self-hosted environment dialog, and confirms with a toast if it's saved. */
  async selectSelfHosted(): Promise<void> {
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
