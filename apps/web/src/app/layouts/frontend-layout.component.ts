// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { EnvironmentSelectorComponent } from "../components/environment-selector/environment-selector.component";
import { SharedModule } from "../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-frontend-layout",
  templateUrl: "frontend-layout.component.html",
  imports: [SharedModule, EnvironmentSelectorComponent],
})
export class FrontendLayoutComponent implements OnInit, OnDestroy {
  version: string;
  year = "2015";

  constructor(private platformUtilsService: PlatformUtilsService) {}

  async ngOnInit() {
    this.year = new Date().getFullYear().toString();
    this.version = await this.platformUtilsService.getApplicationVersion();

    document.body.classList.add("layout_frontend");
  }

  ngOnDestroy() {
    document.body.classList.remove("layout_frontend");
  }
}
