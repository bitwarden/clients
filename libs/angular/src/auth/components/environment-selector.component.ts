// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { animate, state, style, transition, trigger } from "@angular/animations";
import { ConnectedPosition } from "@angular/cdk/overlay";
import { Component, EventEmitter, Output, Input, OnInit, OnDestroy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable, map, Subject, takeUntil } from "rxjs";

import { SelfHostedEnvConfigDialogComponent } from "@bitwarden/auth/angular";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

export const ExtensionDefaultOverlayPosition: ConnectedPosition[] = [
  {
    originX: "start",
    originY: "top",
    overlayX: "start",
    overlayY: "bottom",
  },
];
export const DesktopDefaultOverlayPosition: ConnectedPosition[] = [
  {
    originX: "start",
    originY: "top",
    overlayX: "start",
    overlayY: "bottom",
  },
];

export interface EnvironmentSelectorRouteData {
  overlayPosition?: ConnectedPosition[];
}

@Component({
  selector: "environment-selector",
  templateUrl: "environment-selector.component.html",
  animations: [
    trigger("transformPanel", [
      state(
        "void",
        style({
          opacity: 0,
        }),
      ),
      transition(
        "void => open",
        animate(
          "100ms linear",
          style({
            opacity: 1,
          }),
        ),
      ),
      transition("* => void", animate("100ms linear", style({ opacity: 0 }))),
    ]),
  ],
})
export class EnvironmentSelectorComponent implements OnInit, OnDestroy {
  @Output() onOpenSelfHostedSettings = new EventEmitter<void>();
  @Input() overlayPosition: ConnectedPosition[] = [
    {
      originX: "start",
      originY: "bottom",
      overlayX: "start",
      overlayY: "top",
    },
  ];

  protected isOpen = false;
  protected ServerEnvironmentType = Region;
  protected availableRegions = this.environmentService.availableRegions();
  protected selectedRegion$: Observable<RegionConfig | undefined> =
    this.environmentService.environment$.pipe(
      map((e) => e.getRegion()),
      map((r) => this.availableRegions.find((ar) => ar.key === r)),
    );

  private destroy$ = new Subject<void>();

  constructor(
    protected environmentService: EnvironmentService,
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private configService: ConfigService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  ngOnInit() {
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      if (data && data["overlayPosition"]) {
        this.overlayPosition = data["overlayPosition"];
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async toggle(option: Region) {
    this.isOpen = !this.isOpen;
    if (option === null) {
      return;
    }

    /**
     * Opens the self-hosted settings dialog.
     *
     * If the `UnauthenticatedExtensionUIRefresh` feature flag is enabled,
     * the self-hosted settings dialog is opened directly. Otherwise, the
     * `onOpenSelfHostedSettings` event is emitted.
     */
    if (option === Region.SelfHosted) {
      if (await this.configService.getFeatureFlag(FeatureFlag.UnauthenticatedExtensionUIRefresh)) {
        if (await SelfHostedEnvConfigDialogComponent.open(this.dialogService)) {
          this.toastService.showToast({
            variant: "success",
            title: null,
            message: this.i18nService.t("environmentSaved"),
          });
        }
      } else {
        this.onOpenSelfHostedSettings.emit();
      }
      return;
    }

    await this.environmentService.setEnvironment(option);
  }

  close() {
    this.isOpen = false;
  }
}
