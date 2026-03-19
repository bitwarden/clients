import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  input,
  OnDestroy,
  viewChild,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable, Subject, combineLatest, lastValueFrom, takeUntil } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import {
  OrgIntegrationBuilder,
  OrgIntegrationConfiguration,
  OrgIntegrationTemplate,
  Schemas,
} from "@bitwarden/bit-common/dirt/organization-integrations/models/integration-builder";
import { OrganizationIntegrationServiceName } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-service-type";
import { OrganizationIntegrationType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-type";
import {
  IntegrationModificationResult,
  OrganizationIntegrationService,
} from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BaseCardComponent,
  CardContentComponent,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  HecConnectDialogResult,
  DatadogConnectDialogResult,
  HuntressConnectDialogResult,
  IntegrationDialogResultStatus,
  openDatadogConnectDialog,
  openHecConnectDialog,
  openHuntressConnectDialog,
} from "../integration-dialog/index";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-integration-card",
  templateUrl: "./integration-card.component.html",
  imports: [SharedModule, BaseCardComponent, CardContentComponent],
})
export class IntegrationCardComponent implements AfterViewInit, OnDestroy {
  private destroyed$: Subject<void> = new Subject();
  readonly imageEle = viewChild.required<ElementRef<HTMLImageElement>>("imageEle");
  readonly name = input.required<string>();
  readonly image = input.required<string>();
  readonly imageDarkMode = input.required<string>();
  readonly linkURL = input.required<string>();
  readonly integrationSettings = input.required<Integration>();
  readonly externalURL = input.required<boolean>();

  /**
   * Date of when the new badge should be hidden.
   * When omitted, the new badge is never shown.
   *
   * @example "2024-12-31"
   */
  readonly newBadgeExpiration = input<string | undefined>(undefined);
  readonly description = input<string>("");
  readonly canSetupConnection = input<boolean>(false);

  organizationId: OrganizationId;

  constructor(
    private themeStateService: ThemeStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE)
    private systemTheme$: Observable<ThemeType>,
    private dialogService: DialogService,
    private activatedRoute: ActivatedRoute,
    private organizationIntegrationService: OrganizationIntegrationService,
    private toastService: ToastService,
    private i18nService: I18nService,
    protected state: IntegrationStateService,
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
        if (!this.imageDarkMode()) {
          return;
        }

        if (theme === ThemeType.System) {
          // When the user's preference is the system theme,
          // use the system theme to determine the image
          const prefersDarkMode = systemTheme === ThemeType.Dark;

          this.imageEle().nativeElement.src = prefersDarkMode ? this.imageDarkMode() : this.image();
        } else if (theme === ThemeType.Dark) {
          // When the user's preference is dark mode, use the dark mode image
          this.imageEle().nativeElement.src = this.imageDarkMode();
        } else {
          // Otherwise use the light mode image
          this.imageEle().nativeElement.src = this.image();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /** Show the "new" badge when expiration is in the future */
  showNewBadge() {
    if (!this.newBadgeExpiration()) {
      return false;
    }

    const expirationDate = new Date(this.newBadgeExpiration() ?? "undefined");

    // Do not show the new badge for invalid dates
    if (isNaN(expirationDate.getTime())) {
      return false;
    }

    return expirationDate > new Date();
  }

  get isConnected(): boolean {
    return !!this.integrationSettings().organizationIntegration?.configuration;
  }

  showConnectedBadge(): boolean {
    return this.canSetupConnection();
  }

  get isUpdateAvailable(): boolean {
    return !!this.integrationSettings().organizationIntegration;
  }

  async setupConnection() {
    if (this.integrationSettings()?.integrationType === null) {
      return;
    }

    if (this.integrationSettings()?.integrationType === OrganizationIntegrationType.Datadog) {
      const dialog = openDatadogConnectDialog(this.dialogService, {
        data: {
          settings: this.integrationSettings(),
        },
      });

      const result = await lastValueFrom(dialog.closed);

      await this.handleIntegrationDialogResult(
        result,
        () => this.deleteDatadog(),
        (res) => this.saveDatadog(res),
      );
    } else if (this.integrationSettings().name === OrganizationIntegrationServiceName.Huntress) {
      // Huntress uses HEC protocol but has its own dialog
      const dialog = openHuntressConnectDialog(this.dialogService, {
        data: {
          settings: this.integrationSettings(),
        },
      });

      const result = await lastValueFrom(dialog.closed);

      await this.handleIntegrationDialogResult(
        result,
        () => this.deleteHuntress(),
        (res) => this.saveHuntress(res),
      );
    } else {
      // invoke the dialog to connect the integration
      const dialog = openHecConnectDialog(this.dialogService, {
        data: {
          settings: this.integrationSettings(),
        },
      });

      const result = await lastValueFrom(dialog.closed);

      await this.handleIntegrationDialogResult(
        result,
        () => this.deleteHec(),
        (res) => this.saveHec(res),
      );
    }
  }

  /**
   * Generic save method
   */
  private async saveIntegration(
    integrationType: OrganizationIntegrationType,
    config: OrgIntegrationConfiguration,
    template: OrgIntegrationTemplate,
  ): Promise<void> {
    let response: IntegrationModificationResult = {
      mustBeOwner: false,
      success: false,
      organizationIntegrationResult: undefined,
    };

    if (this.isUpdateAvailable) {
      // retrieve org integration and configuration ids
      const orgIntegrationId = this.integrationSettings().organizationIntegration?.id;
      const orgIntegrationConfigurationId =
        this.integrationSettings().organizationIntegration?.integrationConfiguration[0]?.id;

      if (!orgIntegrationId || !orgIntegrationConfigurationId) {
        throw Error("Organization Integration ID or Configuration ID is missing");
      }

      // update existing integration and configuration
      response = await this.organizationIntegrationService.update(
        this.organizationId,
        orgIntegrationId,
        integrationType,
        orgIntegrationConfigurationId,
        config,
        template,
      );
    } else {
      // create new integration and configuration
      response = await this.organizationIntegrationService.save(
        this.organizationId,
        integrationType,
        config,
        template,
      );
    }

    if (response.mustBeOwner) {
      this.showMustBeOwnerToast();
      return;
    }

    // update local state with the new integration settings
    if (response.success && response.organizationIntegrationResult) {
      this.state.updateIntegrationSettings(
        this.integrationSettings().name,
        response.organizationIntegrationResult,
      );
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t(
        "integrationConnectedSuccessfully",
        this.integrationSettings().name,
      ),
    });
  }

  /**
   * Generic delete method
   */
  private async deleteIntegration(): Promise<void> {
    const orgIntegrationId = this.integrationSettings().organizationIntegration?.id;
    const orgIntegrationConfigurationId =
      this.integrationSettings().organizationIntegration?.integrationConfiguration[0]?.id;

    if (!orgIntegrationId || !orgIntegrationConfigurationId) {
      throw Error("Organization Integration ID or Configuration ID is missing");
    }

    const response = await this.organizationIntegrationService.delete(
      this.organizationId,
      orgIntegrationId,
      orgIntegrationConfigurationId,
    );

    if (response.mustBeOwner) {
      this.showMustBeOwnerToast();
      return;
    }

    if (response.success) {
      this.state.deleteIntegrationSettings(this.integrationSettings().name);
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("success"),
    });
  }

  /**
   * Generic dialog result handler
   * Handles both delete and edit actions with proper error handling
   */
  private async handleIntegrationDialogResult<T extends { success: string | null }>(
    result: T | undefined,
    deleteCallback: () => Promise<void>,
    saveCallback: (result: T) => Promise<void>,
  ): Promise<void> {
    // User cancelled the dialog or closed it without saving
    if (!result || !result.success) {
      return;
    }

    // Handle delete action
    if (result.success === IntegrationDialogResultStatus.Delete) {
      try {
        await deleteCallback();
      } catch {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("failedToDeleteIntegration"),
        });
      }
      return;
    }

    // Handle edit/save action
    if (result.success === IntegrationDialogResultStatus.Edited) {
      try {
        await saveCallback(result);
      } catch {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("failedToSaveIntegration"),
        });
      }
    }
  }

  async saveHec(result: HecConnectDialogResult) {
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      result.url,
      result.bearerToken,
      this.integrationSettings().name as OrganizationIntegrationServiceName,
    );
    const template = OrgIntegrationBuilder.buildHecTemplate(
      result.index,
      this.integrationSettings().name as OrganizationIntegrationServiceName,
    );

    await this.saveIntegration(OrganizationIntegrationType.Hec, config, template);
  }

  async deleteHec() {
    await this.deleteIntegration();
  }

  async saveHuntress(result: HuntressConnectDialogResult) {
    // Huntress uses "Splunk" scheme for HEC protocol compatibility
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      result.url,
      result.token,
      OrganizationIntegrationServiceName.Huntress,
      Schemas.Splunk,
    );
    // Huntress SIEM doesn't require the index field
    const template = OrgIntegrationBuilder.buildHecTemplate(
      "",
      OrganizationIntegrationServiceName.Huntress,
    );

    await this.saveIntegration(OrganizationIntegrationType.Hec, config, template);
  }

  async deleteHuntress() {
    await this.deleteIntegration();
  }

  async saveDatadog(result: DatadogConnectDialogResult) {
    const config = OrgIntegrationBuilder.buildDataDogConfiguration(result.url, result.apiKey);
    const template = OrgIntegrationBuilder.buildDataDogTemplate(
      this.integrationSettings().name as OrganizationIntegrationServiceName,
    );

    await this.saveIntegration(OrganizationIntegrationType.Datadog, config, template);
  }

  async deleteDatadog() {
    await this.deleteIntegration();
  }

  private showMustBeOwnerToast() {
    this.toastService.showToast({
      variant: "error",
      title: "",
      message: this.i18nService.t("mustBeOrgOwnerToPerformAction"),
    });
  }
}
