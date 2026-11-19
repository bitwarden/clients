import { PamPendingCountService } from "@bitwarden/bit-pam-components";
import { PamNavBadgeService } from "@bitwarden/web-vault/app/pam/pam-nav-badge.service";

/**
 * The web nav badge. The counting lives in `PamPendingCountService`, which the desktop client
 * shares; this binds it to the web vault's abstract badge service.
 */
export class DefaultPamNavBadgeService
  extends PamPendingCountService
  implements PamNavBadgeService {}
