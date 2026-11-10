import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { from } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { EnvironmentSelectorComponent } from "../components/environment-selector/environment-selector.component";
import { SharedModule } from "../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush once routed pages no longer rely on Default CD
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-frontend-layout",
  templateUrl: "frontend-layout.component.html",
  imports: [SharedModule, EnvironmentSelectorComponent],
})
export class FrontendLayoutComponent implements OnInit, OnDestroy {
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly year = new Date().getFullYear().toString();
  protected readonly version = toSignal(from(this.platformUtilsService.getApplicationVersion()));

  ngOnInit() {
    document.body.classList.add("layout_frontend");
  }

  ngOnDestroy() {
    document.body.classList.remove("layout_frontend");
  }
}
