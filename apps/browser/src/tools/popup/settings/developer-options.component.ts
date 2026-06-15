import { ChangeDetectionStrategy, Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlagOverrideComponent } from "@bitwarden/angular/platform/feature-flag-override";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "developer-options.component.html",
  imports: [
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    FeatureFlagOverrideComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeveloperOptionsComponent {}
