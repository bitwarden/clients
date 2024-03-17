import { BehaviorSubject } from "rxjs";

import { SettingsService } from "@bitwarden/common/services/settings.service";

import { browserSession, sessionSync } from "../platform/decorators/session-sync-observable";

@browserSession
export class BrowserSettingsService extends SettingsService {
  @sessionSync({ initializer: (b: boolean) => b })
  protected _disableFavicon: BehaviorSubject<boolean>;
}
