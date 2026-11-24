import { PremiumUpgradeNudgeOptions } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";

export const TOTP_NUDGE_OPTIONS: PremiumUpgradeNudgeOptions = {
  titleKey: "totpUpgradeTitle",
  descriptionKey: "totpUpgradeDescription",
  image: "totp",
  checkoutFeatureNameKey: "totpFeatureName",
};
