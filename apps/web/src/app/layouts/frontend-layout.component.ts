// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  selector: "app-frontend-layout",
  templateUrl: "frontend-layout.component.html",
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
