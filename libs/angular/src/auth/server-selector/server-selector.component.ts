import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";
import { outputFromObservable, toSignal } from "@angular/core/rxjs-interop";
import { map, shareReplay } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { AvailableRegionsService } from "@bitwarden/common/platform/abstractions/available-regions.service";
import {
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DialogService,
  IconModule,
  LinkModule,
  MenuModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SelfHostedEnvConfigDialogComponent } from "../self-hosted-env-config-dialog";

/** A cloud region, or self-hosted when the environment matches no cloud region. */
export type SelectedServer = RegionConfig | typeof Region.SelfHosted;

/**
 * Inline server selector shown with auth forms, e.g. "Logging in on: bitwarden.com ⌄".
 *
 * Reads and changes the environment through `EnvironmentService`. Choosing self-hosted opens the
 * self-hosted environment dialog (desktop and browser only). Renders nothing on a self-hosted web
 * vault, where the server can't be changed.
 */
@Component({
  selector: "auth-server-selector",
  templateUrl: "./server-selector.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, IconModule, LinkModule, MenuModule, TypographyModule],
  host: {
    class: "tw-block",
  },
})
export class ServerSelectorComponent {
  private readonly environmentService = inject(EnvironmentService);
  private readonly availableRegionsService = inject(AvailableRegionsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  /** Already-translated label shown before the domain. Defaults to "Logging in on". */
  readonly label = input<string>();

  /** Shows the current server as plain text, without the menu to change it. */
  readonly readonly = input(false, { transform: booleanAttribute });

  private readonly selectedServer$ = this.environmentService.globalEnvironment$.pipe(
    map(
      (env): SelectedServer =>
        this.environmentService
          .availableRegions()
          .find((region) => region.key === env.getRegion()) ?? Region.SelfHosted,
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Emits the current server on load, whenever it changes, and after each selection. */
  readonly selectedRegionChange = outputFromObservable(this.selectedServer$);

  private readonly clientType = this.platformUtilsService.getClientType();

  /** Self-hosted environments can only be configured from desktop and the browser extension. */
  protected readonly selfHostedAvailable =
    this.clientType === ClientType.Desktop || this.clientType === ClientType.Browser;

  /** A self-hosted web vault is tied to its own server. */
  protected readonly hidden =
    this.clientType === ClientType.Web && this.platformUtilsService.isSelfHost();

  protected readonly availableRegions = toSignal(this.availableRegionsService.availableRegions$, {
    initialValue: [] as RegionConfig[],
  });

  protected readonly selectedServer = toSignal(this.selectedServer$);

  protected readonly selectedRegion = computed(() => {
    const server = this.selectedServer();
    return server === Region.SelfHosted ? undefined : server;
  });

  protected async selectRegion(region: RegionConfig): Promise<void> {
    await this.environmentService.setEnvironment(region.key);
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
