import { ChangeDetectionStrategy, Component } from "@angular/core";

import { FeatureFlagOverrideComponent } from "@bitwarden/angular/platform/feature-flag-override";

import { HeaderModule } from "../layouts/header/header.module";
import { SharedModule } from "../shared";

@Component({
  selector: "app-developer-options",
  templateUrl: "developer-options.component.html",
  imports: [SharedModule, HeaderModule, FeatureFlagOverrideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeveloperOptionsComponent {}
