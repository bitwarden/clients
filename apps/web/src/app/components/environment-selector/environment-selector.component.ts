// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Observable } from "rxjs";

import { AvailableRegionsService } from "@bitwarden/common/platform/abstractions/available-regions.service";
import {
  EnvironmentService,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { SharedModule } from "../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "environment-selector",
  templateUrl: "environment-selector.component.html",
  imports: [SharedModule],
})
export class EnvironmentSelectorComponent implements OnInit {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private availableRegionsService: AvailableRegionsService,
    private router: Router,
  ) {}

  protected availableRegions$: Observable<RegionConfig[]> =
    this.availableRegionsService.availableRegions$;
  protected currentRegion?: RegionConfig;

  protected showRegionSelector = false;
  protected routeAndParams: string;

  async ngOnInit() {
    this.showRegionSelector = !this.platformUtilsService.isSelfHost();
    this.routeAndParams = `/#${this.router.url}`;

    const host = Utils.getHost(window.location.href);
    this.currentRegion = this.environmentService
      .availableRegions()
      .find((r) => Utils.getHost(r.urls.webVault) === host);
  }
}
