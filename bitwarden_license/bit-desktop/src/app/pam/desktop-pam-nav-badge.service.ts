import { PamPendingCountService } from "@bitwarden/bit-pam-components";
import { PamNavBadgeService } from "@bitwarden/desktop/app/pam/pam-nav-badge.service";

/**
 * The desktop nav badge. The counting lives in `PamPendingCountService`, which the web vault
 * shares; this binds it to the desktop's abstract badge service.
 */
export class DesktopPamNavBadgeService
  extends PamPendingCountService
  implements PamNavBadgeService {}
