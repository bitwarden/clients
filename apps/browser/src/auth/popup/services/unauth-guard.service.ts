import { Injectable } from "@angular/core";

import { UnauthGuard as BaseUnauthGuardService } from "@bitwarden/angular/auth/guards";

@Injectable()
export class UnauthGuardService extends BaseUnauthGuardService {
  protected homepage = "tabs/current";
}
