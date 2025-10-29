import { ChangeDetectionStrategy, Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SessionTimeoutSettingsComponent } from "@bitwarden/key-management-ui";

@Component({
  templateUrl: "session-timeout.component.html",
  imports: [SessionTimeoutSettingsComponent, JslibModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionTimeoutComponent {}
