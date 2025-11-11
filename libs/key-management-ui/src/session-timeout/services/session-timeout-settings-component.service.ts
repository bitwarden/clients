import { Observable } from "rxjs";

import { VaultTimeout, VaultTimeoutOption } from "@bitwarden/common/key-management/vault-timeout";

export abstract class SessionTimeoutSettingsComponentService {
  abstract availableTimeoutOptions$: Observable<VaultTimeoutOption[]>;

  abstract onTimeoutSave(timeout: VaultTimeout): void;
}
