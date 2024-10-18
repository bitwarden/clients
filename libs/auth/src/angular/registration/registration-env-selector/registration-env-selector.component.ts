import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { Subject, from, map, of, pairwise, startWith, switchMap, takeUntil, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ClientType } from "@bitwarden/common/enums";
import {
  Environment,
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, FormFieldModule, SelectModule, ToastService } from "@bitwarden/components";

import { RegistrationSelfHostedEnvConfigDialogComponent } from "../registration-self-hosted-env-config-dialog/registration-self-hosted-env-config-dialog.component";

/**
 * Component for selecting the environment to register with in the email verification registration flow.
 * Outputs the selected region to the parent component so it can respond as necessary.
 */
@Component({
  standalone: true,
  selector: "auth-registration-env-selector",
  templateUrl: "registration-env-selector.component.html",
  imports: [CommonModule, JslibModule, ReactiveFormsModule, FormFieldModule, SelectModule],
})
export class RegistrationEnvSelectorComponent implements OnInit, OnDestroy {
  @Output() selectedRegionChange = new EventEmitter<RegionConfig | Region.SelfHosted | null>();

  ServerEnvironmentType = Region;

  formGroup = this.formBuilder.group({
    selectedRegion: [null as RegionConfig | Region.SelfHosted | null, Validators.required],
  });

  get selectedRegion(): FormControl {
    return this.formGroup.get("selectedRegion") as FormControl;
  }

  availableRegionConfigs: RegionConfig[] = this.environmentService.availableRegions();

  private selectedRegionFromEnv: RegionConfig | Region.SelfHosted;

  hideEnvSelector = false;
  isDesktopOrBrowserExtension = false;

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private environmentService: EnvironmentService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    const clientType = platformUtilsService.getClientType();
    this.isDesktopOrBrowserExtension =
      clientType === ClientType.Desktop || clientType === ClientType.Browser;

    this.hideEnvSelector = clientType === ClientType.Web && this.platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    if (this.hideEnvSelector) {
      return;
    }

    await this.initSelectedRegionAndListenForEnvChanges();
    this.listenForSelectedRegionChanges();
  }

  private async initSelectedRegionAndListenForEnvChanges() {
    this.environmentService.environment$
      .pipe(
        map((env: Environment) => {
          const region: Region = env.getRegion();
          const regionConfig: RegionConfig = this.availableRegionConfigs.find(
            (availableRegionConfig) => availableRegionConfig.key === region,
          );

          if (regionConfig === undefined) {
            // Self hosted does not have a region config.
            return Region.SelfHosted;
          }

          return regionConfig;
        }),
        tap((selectedRegionFromEnv: RegionConfig | Region.SelfHosted) => {
          // Only set the value if it is different from the current value.
          if (selectedRegionFromEnv !== this.selectedRegion.value) {
            // Don't emit to avoid triggering the selectedRegion valueChanges subscription
            // which could loop back to this code.
            this.selectedRegion.setValue(selectedRegionFromEnv, { emitEvent: false });
          }

          // Save this off so we can reset the value to the previously selected region
          // if the self hosted settings are closed without saving.
          this.selectedRegionFromEnv = selectedRegionFromEnv;

          // Emit the initial value
          this.selectedRegionChange.emit(selectedRegionFromEnv);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private listenForSelectedRegionChanges() {
    this.selectedRegion.valueChanges
      .pipe(
        startWith(null), // required so that first user choice is not ignored
        pairwise(),
        switchMap(
          ([prevSelectedRegion, selectedRegion]: [
            RegionConfig | Region.SelfHosted | null,
            RegionConfig | Region.SelfHosted | null,
          ]) => {
            if (selectedRegion === null) {
              this.selectedRegionChange.emit(selectedRegion);
              return of(null);
            }

            if (selectedRegion === Region.SelfHosted) {
              return from(
                RegistrationSelfHostedEnvConfigDialogComponent.open(this.dialogService),
              ).pipe(
                tap((result: boolean | undefined) =>
                  this.handleSelfHostedEnvConfigDialogResult(result, prevSelectedRegion),
                ),
              );
            }

            this.selectedRegionChange.emit(selectedRegion);
            return from(this.environmentService.setEnvironment(selectedRegion.key));
          },
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private handleSelfHostedEnvConfigDialogResult(
    result: boolean | undefined,
    prevSelectedRegion: RegionConfig | Region.SelfHosted | null,
  ) {
    if (result === true) {
      this.selectedRegionChange.emit(Region.SelfHosted);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("environmentSaved"),
      });
      return;
    }

    // Reset the value to the previously selected region or the current env setting
    // if the self hosted env settings dialog is closed without saving.
    if (
      (result === false || result === undefined) &&
      prevSelectedRegion !== null &&
      prevSelectedRegion !== Region.SelfHosted
    ) {
      this.selectedRegionChange.emit(prevSelectedRegion);
      this.selectedRegion.setValue(prevSelectedRegion, { emitEvent: false });
    } else {
      this.selectedRegionChange.emit(this.selectedRegionFromEnv);
      this.selectedRegion.setValue(this.selectedRegionFromEnv, { emitEvent: false });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
