// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import {
  EnvironmentService,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { SharedModule } from "../../shared";

@Component({
  selector: "environment-selector",
  templateUrl: "environment-selector.component.html",
  imports: [SharedModule],
})
export class EnvironmentSelectorComponent implements OnInit {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private router: Router,
  ) {}

  protected availableRegions = this.environmentService.availableRegions();
  protected currentRegion?: RegionConfig;

  protected showRegionSelector = false;
  protected routeAndParams: string;

  async ngOnInit() {
    this.showRegionSelector = !this.platformUtilsService.isSelfHost();
    this.routeAndParams = `/#${this.router.url}`;

    const host = Utils.getHost(window.location.href);
    this.currentRegion = this.availableRegions.find((r) => Utils.getHost(r.urls.webVault) === host);
  }
}
