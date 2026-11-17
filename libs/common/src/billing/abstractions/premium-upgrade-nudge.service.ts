export interface PremiumUpgradeNudgeOptions {
  titleKey: string;
  descriptionKey: string;
  unlockedFeatureKeys?: string[];
  imagePath?: string; // bundled UI screenshot;
  checkoutFeatureNameKey?: string; // read only by the external-checkout service; web ignores it
}

export abstract class PremiumUpgradeNudgeService {
  /**
   * Determines if the user has a Premium subscription or should be shown an upgrade nudge.
   * @param options The options for the premium upgrade nudge.
   * @returns A promise that resolves to true if the user has Premium, false if the nudge is shown.
   */
  abstract hasPremiumOrShowUpgradeNudge(options: PremiumUpgradeNudgeOptions): Promise<boolean>;
}
