import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { DevFlags } from "../../../platform/flags";

type InitContextMenuItems = Omit<chrome.contextMenus.CreateProperties, "contexts"> & {
  requiresPremiumAccess?: boolean;
  requiresUnblockedUri?: boolean;
  requiresFeatureFlag?: FeatureFlag;
  /**
   * Gates the item behind a build-time dev flag (dev builds only). Unlike
   * {@link requiresFeatureFlag}, this is resolved synchronously and is never on
   * in production.
   */
  requiresDevFlag?: keyof DevFlags;
};

export { InitContextMenuItems };
