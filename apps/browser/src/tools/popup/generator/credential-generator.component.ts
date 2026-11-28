import { Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { from } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ItemModule } from "@bitwarden/components";
import { GeneratorModule } from "@bitwarden/generator-components";
import { safeProvider } from "@bitwarden/ui-common";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { SitePasswordSettingsService } from "./site-password-settings.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "credential-generator",
  templateUrl: "credential-generator.component.html",
  imports: [
    GeneratorModule,
    CurrentAccountComponent,
    JslibModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    RouterModule,
    ItemModule,
  ],
  providers: [safeProvider(SitePasswordSettingsService)],
})
export class CredentialGeneratorComponent {
  private readonly sitePasswordSettingsService = inject(SitePasswordSettingsService);

  /** `undefined` until the lookup finishes, so the generator starts with the site's settings. */
  protected readonly sitePasswordSettings = toSignal(
    from(this.sitePasswordSettingsService.currentTab()),
  );
}
