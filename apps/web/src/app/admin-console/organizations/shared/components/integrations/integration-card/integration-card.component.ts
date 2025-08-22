// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
// eslint-disable-next-line no-restricted-imports
import {
  OrganizationIntegrationType,
  OrganizationIntegrationRequest,
  OrganizationIntegrationResponse,
  OrganizationIntegrationApiService,
} from "@bitwarden/bit-common/dirt/integrations/index";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../../../../shared/shared.module";
import { openHecConnectDialog } from "../integration-dialog/index";
import { Integration } from "../models";

@Component({
  selector: "app-integration-card",
  templateUrl: "./integration-card.component.html",
  imports: [SharedModule],
})
export class IntegrationCardComponent implements AfterViewInit, OnDestroy {
  private destroyed$: Subject<void> = new Subject();
  @ViewChild("imageEle") imageEle: ElementRef<HTMLImageElement>;

  @Input() name: string;
  @Input() image: string;
  @Input() imageDarkMode?: string;
  @Input() linkURL: string;
  @Input() integrationSettings: Integration;

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
  @Input() isConnected?: boolean;
  @Input() canSetupConnection?: boolean;

  constructor(
    private themeStateService: ThemeStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE)
    private systemTheme$: Observable<ThemeType>,
    private dialogService: DialogService,
    private activatedRoute: ActivatedRoute,
    private apiService: OrganizationIntegrationApiService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

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

  showConnectedBadge(): boolean {
    return this.isConnected !== undefined;
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

    // save the integration
    try {
      const dbResponse = await this.saveHecIntegration(result.configuration);
      this.isConnected = !!dbResponse.id;
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("failedToSaveIntegration"),
      });
      return;
    }
  }

  async saveHecIntegration(configuration: string): Promise<OrganizationIntegrationResponse> {
    const organizationId = this.activatedRoute.snapshot.paramMap.get(
      "organizationId",
    ) as OrganizationId;

    const request = new OrganizationIntegrationRequest(
      OrganizationIntegrationType.Hec,
      configuration,
    );

    const integrations = await this.apiService.getOrganizationIntegrations(organizationId);
    const existingIntegration = integrations.find(
      (i) => i.type === OrganizationIntegrationType.Hec,
    );

    if (existingIntegration) {
      return await this.apiService.updateOrganizationIntegration(
        organizationId,
        existingIntegration.id,
        request,
      );
    } else {
      return await this.apiService.createOrganizationIntegration(organizationId, request);
    }
  }
}
