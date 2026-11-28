import { PremiumUpgradeNudgeOptions } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";

export const ATTACHMENTS_NUDGE_OPTIONS: PremiumUpgradeNudgeOptions = {
  titleKey: "attachmentsUpgradeTitle",
  descriptionKey: "attachmentsUpgradeDescription",
  unlockedFeatureKeys: [
    "attachmentsUnlockIds",
    "attachmentsUnlockReceipts",
    "attachmentsUnlockTaxForms",
  ],
  checkoutFeatureNameKey: "attachmentsFeatureName",
};
