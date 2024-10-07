import { DefaultLoginComponentService, LoginComponentService } from "@bitwarden/auth/angular";

import { flagEnabled } from "../../../platform/flags";

export class ExtensionLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentService
{
  isLoginViaAuthRequestSupported(): boolean {
    return flagEnabled("showPasswordless");
  }
}
