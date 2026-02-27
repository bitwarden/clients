import { Observable } from "rxjs";

/**
 * This interface defines the a contract for a service that prompts the user to upgrade to premium.
 * It ensures that PremiumUpgradePromptService contains a promptForPremium method.
 */
export abstract class PremiumUpgradePromptService {
  abstract promptForPremium(organizationId?: string): Promise<void>;
  abstract upgradeConfirmed$?: Observable<boolean>;
}
