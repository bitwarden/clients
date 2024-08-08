import { firstValueFrom } from "rxjs";

import { DefaultLockComponentService, LockComponentService } from "@bitwarden/auth/angular";

import {
  fido2PopoutSessionData$,
  Fido2SessionData,
} from "../vault/popup/utils/fido2-popout-session-data";

export class ExtensionLockComponentService
  extends DefaultLockComponentService
  implements LockComponentService
{
  async isFido2Session(): Promise<boolean> {
    const fido2SessionData: Fido2SessionData = await firstValueFrom(fido2PopoutSessionData$());
    return fido2SessionData.isFido2Session;
  }
}
