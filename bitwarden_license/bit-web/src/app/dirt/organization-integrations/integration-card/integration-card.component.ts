import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable, Subject, combineLatest, lastValueFrom, takeUntil } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { OrganizationIntegrationServiceType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-service-type";
import { HecOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/hec-organization-integration-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  HecConnectDialogResult,
  HecConnectDialogResultStatus,
  openHecConnectDialog,
} from "../integration-dialog/index";

@Component({
  selector: "app-integration-card",
  templateUrl: "./integration-card.component.html",
  imports: [SharedModule],
})
export class IntegrationCardComponent implements AfterViewInit, OnDestroy {
  private destroyed$: Subject<void> = new Subject();
  @ViewChild("imageEle") imageEle!: ElementRef<HTMLImageElement>;

  @Input() name: string = "";
  @Input() image: string = "";
  @Input() imageDarkMode: string = "";
  @Input() linkURL: string = "";
  @Input() integrationSettings!: Integration;

  /** Adds relevant `rel` attribute to external links */
  @Input() externalURL?: boolean;

  /**
   * Date of when the new badge should be hidden.
   * When omitted, the new badge is never shown.
   *
   * @example "2024-12-31"
   */
  @Input() newBadgeExpiration?: string;
  @Input() description?: string;
  @Input() canSetupConnection?: boolean;

  organizationId: OrganizationId;

  constructor(
    private themeStateService: ThemeStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE)
    private systemTheme$: Observable<ThemeType>,
    private dialogService: DialogService,
    private activatedRoute: ActivatedRoute,
    private hecOrganizationIntegrationService: HecOrganizationIntegrationService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {
    this.organizationId = this.activatedRoute.snapshot.paramMap.get(
      "organizationId",
    ) as OrganizationId;
  }

  ngAfterViewInit() {
    combineLatest([this.themeStateService.selectedTheme$, this.systemTheme$])
      .pipe(takeUntil(this.destroyed$))
      .subscribe(([theme, systemTheme]) => {
        // When the card doesn't have a dark mode image, exit early
        if (!this.imageDarkMode) {
          return;
        }

        if (theme === ThemeType.System) {
          // When the user's preference is the system theme,
          // use the system theme to determine the image
          const prefersDarkMode = systemTheme === ThemeType.Dark;

          this.imageEle.nativeElement.src = prefersDarkMode ? this.imageDarkMode : this.image;
        } else if (theme === ThemeType.Dark) {
          // When the user's preference is dark mode, use the dark mode image
          this.imageEle.nativeElement.src = this.imageDarkMode;
        } else {
          // Otherwise use the light mode image
          this.imageEle.nativeElement.src = this.image;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /** Show the "new" badge when expiration is in the future */
  showNewBadge() {
    if (!this.newBadgeExpiration) {
      return false;
    }

    const expirationDate = new Date(this.newBadgeExpiration);

    // Do not show the new badge for invalid dates
    if (isNaN(expirationDate.getTime())) {
      return false;
    }

    return expirationDate > new Date();
  }

  get isConnected(): boolean {
    return !!this.integrationSettings.organizationIntegration?.configuration;
  }

  showConnectedBadge(): boolean {
    return this.canSetupConnection ?? false;
  }

  get isUpdateAvailable(): boolean {
    return !!this.integrationSettings.organizationIntegration;
  }

  async setupConnection() {
    // invoke the dialog to connect the integration
    const dialog = openHecConnectDialog(this.dialogService, {
      data: {
        settings: this.integrationSettings,
      },
    });

    const result = await lastValueFrom(dialog.closed);

    // the dialog was cancelled
    if (!result || !result.success) {
      return;
    }

    try {
      if (result.success === HecConnectDialogResultStatus.Delete) {
        await this.deleteHec();
      }
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("failedToDeleteIntegration"),
      });
    }

    try {
      if (result.success === HecConnectDialogResultStatus.Edited) {
        await this.saveHec(result);
      }
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("failedToSaveIntegration"),
      });
    }
  }

  async saveHec(result: HecConnectDialogResult) {
    if (this.isUpdateAvailable) {
      // retrieve org integration and configuration ids
      const orgIntegrationId = this.integrationSettings.organizationIntegration?.id;
      const orgIntegrationConfigurationId =
        this.integrationSettings.organizationIntegration?.integrationConfiguration[0]?.id;

      if (!orgIntegrationId || !orgIntegrationConfigurationId) {
        throw Error("Organization Integration ID or Configuration ID is missing");
      }

      // update existing integration and configuration
      await this.hecOrganizationIntegrationService.updateHec(
        this.organizationId,
        orgIntegrationId,
        orgIntegrationConfigurationId,
        this.integrationSettings.name as OrganizationIntegrationServiceType,
        result.url,
        result.bearerToken,
        result.index,
      );
    } else {
      // create new integration and configuration
      await this.hecOrganizationIntegrationService.saveHec(
        this.organizationId,
        this.integrationSettings.name as OrganizationIntegrationServiceType,
        result.url,
        result.bearerToken,
        result.index,
      );
    }
  }

  async deleteHec() {
    const orgIntegrationId = this.integrationSettings.organizationIntegration?.id;
    const orgIntegrationConfigurationId =
      this.integrationSettings.organizationIntegration?.integrationConfiguration[0]?.id;

    if (!orgIntegrationId || !orgIntegrationConfigurationId) {
      throw Error("Organization Integration ID or Configuration ID is missing");
    }

    await this.hecOrganizationIntegrationService.deleteHec(
      this.organizationId,
      orgIntegrationId,
      orgIntegrationConfigurationId,
    );
  }
}
