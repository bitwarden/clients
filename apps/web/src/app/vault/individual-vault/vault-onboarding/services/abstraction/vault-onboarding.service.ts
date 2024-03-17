import { Observable } from "rxjs";

import { VaultOnboardingTasks } from "../vault-onboarding.service";

export abstract class VaultOnboardingService {
  vaultOnboardingState$: Observable<VaultOnboardingTasks>;
  abstract setVaultOnboardingTasks(newState: VaultOnboardingTasks): Promise<void>;
}
