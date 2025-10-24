// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { DialogService, FormFieldModule, SelectModule, ToastService } from "@bitwarden/components";

import { SelfHostedEnvConfigDialogComponent } from "../../self-hosted-env-config-dialog/self-hosted-env-config-dialog.component";

/**
 * Component for selecting the environment to register with in the email verification registration flow.
 * Outputs the selected region to the parent component so it can respond as necessary.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-registration-env-selector",
  templateUrl: "registration-env-selector.component.html",
  imports: [CommonModule, JslibModule, ReactiveFormsModule, FormFieldModule, SelectModule],
})
export class RegistrationEnvSelectorComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
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

  /**
   * Listens for changes to the selected region and updates the form value and emits the selected region.
   */
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

            if (selectedRegion !== Region.SelfHosted) {
              this.selectedRegionChange.emit(selectedRegion);
              return from(this.environmentService.setEnvironment(selectedRegion.key));
            }

            return of(null);
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

  /**
   * Handles the event when the select is closed.
   * If the selected region is self-hosted, opens the self-hosted environment settings dialog.
   */
  protected async onSelectClosed() {
    if (this.selectedRegion.value === Region.SelfHosted) {
      const result = await SelfHostedEnvConfigDialogComponent.open(this.dialogService);
      return this.handleSelfHostedEnvConfigDialogResult(result, this.selectedRegion.value);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
