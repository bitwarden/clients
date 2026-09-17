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
  DatadogConnectDialogResult,
  IntegrationDialogResultStatus,
  openDatadogConnectDialog,
  openHecConnectDialog,
  openConnectViaHecTokenDialog,
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

    const [isUnique, conflictingIntegrationName] = this.isIntegrationUniqueForTypeAndOrganization();
    if (!isUnique) {
      const organizationIntegrationTypeName = this.getOrganizationIntegrationTypeName(
        this.integrationSettings().integrationType,
      );

      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t(
          "onlyOneIntegrationOfTypeAllowed",
          organizationIntegrationTypeName,
          conflictingIntegrationName,
        ),
      });
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
    } else if (
      this.integrationSettings()?.integrationType === OrganizationIntegrationType.Hec &&
      this.integrationSettings().name !== OrganizationIntegrationServiceName.CrowdStrike
    ) {
      // for now, this will always be Hec via Token Auth
      const name = this.integrationSettings().name as OrganizationIntegrationServiceName;

      const dialog = openConnectViaHecTokenDialog(this.dialogService, {
        data: {
          settings: this.integrationSettings(),
          saveCallback: async (url: string, token: string) => {
            const config = OrgIntegrationBuilder.buildHecConfiguration(
              url,
              token,
              name,
              Schemas.Splunk,
            );
            const template = OrgIntegrationBuilder.buildHecTemplate("", name);
            return this.executeHecSave(config, template, name);
          },
        },
      });

      const result = await lastValueFrom(dialog.closed);

      await this.handleIntegrationDialogResult(result, () =>
        this.deleteConnectViaHecTokenIntegration(),
      );
    } else {
      // The current Crowdstrike configuration.
      // As we get specs for Crowdstrike, this could be Hec via API key auth
      const name = this.integrationSettings().name as OrganizationIntegrationServiceName;

      const dialog = openHecConnectDialog(this.dialogService, {
        data: {
          settings: this.integrationSettings(),
          saveCallback: async (url: string, bearerToken: string, index: string) => {
            const config = OrgIntegrationBuilder.buildHecConfiguration(url, bearerToken, name);
            const template = OrgIntegrationBuilder.buildHecTemplate(index, name);
            return this.executeHecSave(config, template, name);
          },
        },
      });

      const result = await lastValueFrom(dialog.closed);

      await this.handleIntegrationDialogResult(result, () => this.deleteHec());
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
    const response = await this.callSaveOrUpdate(integrationType, config, template);

    if (response.mustBeOwner) {
      this.showMustBeOwnerToast();
      return;
    }

    if (response.anotherIntegrationWithSameTypeExists) {
      const integrationTypeName = this.getOrganizationIntegrationTypeName(integrationType);
      this.showAnotherIntegrationWithSameTypeExistsToast(integrationTypeName);
      return;
    }

    // update local state with the new integration settings
    if (response.success && response.organizationIntegrationResult) {
      // update local state with the new integration settings
      this.state.updateIntegrationSettings(
        this.integrationSettings().name,
        response.organizationIntegrationResult,
      );
    }

    // show success toast
    if (response.success) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t(
          "integrationConnectedSuccessfully",
          this.integrationSettings().name,
        ),
      });
    } else {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("failedToSaveIntegration"),
      });
    }
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

      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("success"),
      });
    } else {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("failedToDeleteIntegration"),
      });
    }
  }

  /**
   * Routes to service save or update based on whether an integration already exists.
   */
  private async callSaveOrUpdate(
    integrationType: OrganizationIntegrationType,
    config: OrgIntegrationConfiguration,
    template: OrgIntegrationTemplate,
  ): Promise<IntegrationModificationResult> {
    if (this.isUpdateAvailable) {
      const orgIntegrationId = this.integrationSettings().organizationIntegration?.id;
      const orgIntegrationConfigurationId =
        this.integrationSettings().organizationIntegration?.integrationConfiguration[0]?.id;

      if (!orgIntegrationId || !orgIntegrationConfigurationId) {
        throw new Error("Organization Integration ID or Configuration ID is missing");
      }

      return this.organizationIntegrationService.update(
        this.organizationId,
        orgIntegrationId,
        integrationType,
        orgIntegrationConfigurationId,
        config,
        template,
      );
    }

    return this.organizationIntegrationService.save(
      this.organizationId,
      integrationType,
      config,
      template,
    );
  }

  /**
   * Calls save or update, handles all HEC-specific response cases, and returns:
   * - a string (server's 400 error message) so the dialog can stay open
   * - null on success (dialog closes with SavedViaCallback)
   * - throws on any other error (dialog closes without result, toast already shown)
   */
  private async executeHecSave(
    config: OrgIntegrationConfiguration,
    template: OrgIntegrationTemplate,
    name: OrganizationIntegrationServiceName,
  ): Promise<string | null> {
    let response: IntegrationModificationResult;
    try {
      response = await this.callSaveOrUpdate(OrganizationIntegrationType.Hec, config, template);
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("failedToSaveIntegration"),
      });
      throw new Error();
    }

    if (response.verificationError) {
      return response.verificationError;
    }

    if (response.mustBeOwner) {
      this.showMustBeOwnerToast();
      throw new Error();
    }

    if (response.anotherIntegrationWithSameTypeExists) {
      this.showAnotherIntegrationWithSameTypeExistsToast(
        this.getOrganizationIntegrationTypeName(OrganizationIntegrationType.Hec),
      );
      throw new Error();
    }

    if (!response.success) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("failedToSaveIntegration"),
      });
      throw new Error();
    }

    if (response.organizationIntegrationResult) {
      this.state.updateIntegrationSettings(name, response.organizationIntegrationResult);
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("integrationConnectedSuccessfully", name),
    });

    return null;
  }

  /**
   * Generic dialog result handler
   * Handles both delete and edit actions with proper error handling
   */
  private async handleIntegrationDialogResult<T extends { success: string | null }>(
    result: T | undefined,
    deleteCallback: () => Promise<void>,
    saveCallback?: (result: T) => Promise<void>,
  ): Promise<void> {
    // User cancelled the dialog or closed it without saving
    if (!result || !result.success) {
      return;
    }

    // Save was completed inside the dialog via callback — nothing more to do
    if (result.success === IntegrationDialogResultStatus.SavedViaCallback) {
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
    if (result.success === IntegrationDialogResultStatus.Edited && saveCallback) {
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

  async deleteHec() {
    await this.deleteIntegration();
  }

  async deleteConnectViaHecTokenIntegration() {
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

  private showAnotherIntegrationWithSameTypeExistsToast(type: string) {
    this.toastService.showToast({
      variant: "error",
      title: "",
      message: this.i18nService.t("anotherIntegrationWithSameTypeExists", type),
    });
  }

  private isIntegrationUniqueForTypeAndOrganization(): [boolean, string] {
    const integrationType = this.integrationSettings().integrationType;
    if (!integrationType) {
      return [true, ""];
    }

    const otherIntegrationOfTheSameType = this.state
      .integrations()
      .filter(
        (i) => i.name !== this.integrationSettings().name && i.integrationType === integrationType,
      )
      .find((integration) => integration.organizationIntegration?.configuration !== undefined);

    const isSameOrganization = this.state.organization()?.id === this.organizationId;

    const isUnique = !otherIntegrationOfTheSameType && isSameOrganization;
    const conflictingName = otherIntegrationOfTheSameType?.name ?? "";

    return [isUnique, conflictingName];
  }

  private getOrganizationIntegrationTypeName(
    integrationType: OrganizationIntegrationType | null | undefined,
  ): string {
    const entry = Object.entries(OrganizationIntegrationType).find(
      ([, value]) => value === integrationType,
    )?.[0];

    return entry ? entry : "";
  }
}
