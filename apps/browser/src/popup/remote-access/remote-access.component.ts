import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

import { PopupHeaderComponent } from "../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-remote-access",
  standalone: true,
  imports: [PopupPageComponent, PopupHeaderComponent, JslibModule],
  template: `
    <popup-page>
      <popup-header slot="header" [pageTitle]="'remoteAccess' | i18n"> </popup-header>
      <div class="tw-p-4">
        <p class="tw-text-main">Placeholder</p>
      </div>
    </popup-page>
  `,
})
export class RemoteAccessComponent {}
