import { ChangeDetectionStrategy, Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  VaultTimeout,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { SessionTimeoutSettingsComponent } from "@bitwarden/key-management-ui";

@Component({
  templateUrl: "session-timeout.component.html",
  imports: [SessionTimeoutSettingsComponent, JslibModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionTimeoutComponent {
  excludeTimeoutTypes: VaultTimeout[] = [
    0, // Web doesn't support "immediately"
    VaultTimeoutStringType.OnIdle, // Web doesn't support "onIdle"
    VaultTimeoutStringType.OnSleep, // Web doesn't support "onSleep"
    VaultTimeoutStringType.OnLocked, // Web doesn't support "onLocked"
  ];
}
