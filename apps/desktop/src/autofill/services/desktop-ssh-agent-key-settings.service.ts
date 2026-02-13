import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { SshAgentKeySettings } from "@bitwarden/vault";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

@Injectable()
export class DesktopSshAgentKeySettingsService extends SshAgentKeySettings {
  constructor(private desktopSettingsService: DesktopSettingsService) {
    super();
  }

  isKeyEnabledForAgent$(cipherId: string): Observable<boolean> {
    return this.desktopSettingsService.sshAgentEnabledKeys$.pipe(
      map((keys) => keys[cipherId] === true),
    );
  }

  async setKeyEnabledForAgent(cipherId: string, enabled: boolean): Promise<void> {
    await this.desktopSettingsService.setSshAgentEnabledForKey(cipherId, enabled);
  }
}
