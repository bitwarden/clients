import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

type InitContextMenuItems = Omit<chrome.contextMenus.CreateProperties, "contexts"> & {
  requiresPremiumAccess?: boolean;
  requiresUnblockedUri?: boolean;
  requiresFeatureFlagKey?: FeatureFlag;
};

export { InitContextMenuItems };
