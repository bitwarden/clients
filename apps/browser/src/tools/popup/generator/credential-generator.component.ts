import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ItemModule } from "@bitwarden/components";
import { GeneratorModule } from "@bitwarden/generator-components";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

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
})
export class CredentialGeneratorComponent {}
