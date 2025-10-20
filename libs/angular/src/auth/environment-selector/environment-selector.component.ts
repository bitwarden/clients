import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { Observable, map, Subject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { SelfHostedEnvConfigDialogComponent } from "@bitwarden/auth/angular";
import {
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogService,
  LinkModule,
  MenuModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  selector: "environment-selector",
  templateUrl: "environment-selector.component.html",
  standalone: true,
  imports: [CommonModule, I18nPipe, MenuModule, LinkModule, TypographyModule],
})
export class EnvironmentSelectorComponent implements OnDestroy {
  protected ServerEnvironmentType = Region;
  protected availableRegions = this.environmentService.availableRegions();
  protected selectedRegion$: Observable<RegionConfig | undefined> =
    this.environmentService.environment$.pipe(
      map((e) => e.getRegion()),
      map((r) => this.availableRegions.find((ar) => ar.key === r)),
    );

  private destroy$ = new Subject<void>();

  constructor(
    public environmentService: EnvironmentService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async toggle(option: Region) {
    if (option === null) {
      return;
    }

    /**
     * Opens the self-hosted settings dialog when the self-hosted option is selected.
     */
    if (option === Region.SelfHosted) {
      const dialogResult = await SelfHostedEnvConfigDialogComponent.open(this.dialogService);
      if (dialogResult) {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("environmentSaved"),
        });
      }
      // Don't proceed to setEnvironment when the self-hosted dialog is cancelled
      return;
    }

    await this.environmentService.setEnvironment(option);
  }
}
