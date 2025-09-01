import { IntegrationType } from "@bitwarden/common/enums";

/** Integration or SDK */
export type Integration = {
  name: string;
  image: string;
  /**
   * Optional image shown in dark mode.
   */
  imageDarkMode?: string;
  linkURL: string;
  type: IntegrationType;
  /**
   * Shows the "New" badge until the defined date.
   * When omitted, the badge is never shown.
   *
   * @example "2024-12-31"
   */
  newBadgeExpiration?: string;
  description?: string;
  isConnected?: boolean;
  canSetupConnection?: boolean;
  configuration?: string;
};
