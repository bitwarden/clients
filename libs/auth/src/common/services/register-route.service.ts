import { Observable, map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

// This is a temporary service to determine the correct route to use for registration based on the email verification feature flag.
export class RegisterRouteService {
  constructor(private configService: ConfigService) {}

  registerRoute$(): Observable<string> {
    return this.configService.getFeatureFlag$(FeatureFlag.EmailVerification).pipe(
      map((emailVerificationEnabled) => {
        if (emailVerificationEnabled) {
          return "/signup";
        } else {
          return "/register";
        }
      }),
    );
  }
}
