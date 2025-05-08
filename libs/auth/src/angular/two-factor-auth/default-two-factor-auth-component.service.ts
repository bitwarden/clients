import {
  DuoLaunchAction,
  TwoFactorAuthComponentService,
} from "./two-factor-auth-component.service";

export class DefaultTwoFactorAuthComponentService implements TwoFactorAuthComponentService {
  shouldCheckForWebAuthnQueryParamResponse() {
    return false;
  }

  determineDuoLaunchAction(): DuoLaunchAction {
    return DuoLaunchAction.DIRECT_LAUNCH;
  }
}
